import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";

/* ------------------------------------------------------------------ */
/* GCP Service Account Auth (same pattern as process-clothing.ts)      */
/* ------------------------------------------------------------------ */
interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri: string;
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken(sa: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: sa.token_uri,
      iat: now,
      exp: now + 3600,
    })
  );
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(`${header}.${payload}`)
    .sign(sa.private_key);
  const jwt = `${header}.${payload}.${base64url(signature)}`;
  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token;
}

/* ------------------------------------------------------------------ */
/* Body analysis prompt                                                */
/* ------------------------------------------------------------------ */const BODY_ANALYSIS_PROMPT = `You are an expert body type analyst and fashion stylist. Analyze this full-body photograph to detect the person's body type and skin tone.

BODY TYPE DETECTION:
Carefully examine the person's body proportions â shoulders, bust/chest, waist, and hips â to determine their body type. Use these definitions:

- "rectangle": Shoulders, waist, and hips are roughly the same width. Minimal waist definition. Straight silhouette.
- "hourglass": Shoulders and hips are roughly equal in width, with a clearly defined narrower waist. Curvy silhouette.
- "inverted_triangle": Shoulders are noticeably wider than the hips. Broad upper body tapering to narrower lower body.
- "pear": Hips are wider than the shoulders. Narrower upper body with fuller hips/thighs.

SKIN TONE DETECTON:
Examine exposed skin areas (face, arms, hands) and determine the closest skin tone category:
- "Light": Very fair, porcelain skin
- "Fair": Light skin with some warm undertones
- "Medium": Moderate skin tone, neither very light nor dark
- "Olive": Medium with greenish/yellowish undertones
- "Tan": Warm golden-brown skin
- "Dark": Rich dark brown skin
- "Deep": Very deep, dark skin

IMPORTANT RULES:
- Focus on actual body proportions, not clothing shape
- If the person is wearing loose/baggy clothing that obscures proportions, make your best estimate based on visible cues
- If this is NOT a photo of a person's body (e.g. it's an object, animal, or just a face), return: {"error": "Please upload a full-body photo for accurate body type detection."}
- Be accurate and objective in your assessment

Return ONLY a raw JSON object with these exact fields:
{
  "body_type": "rectangle" | "hourglass" | "inverted_triangle" | "pear",
  "skin_tone": "Light" | "Fair" | "Medium" | "Olive" | "Tan" | "Dark" | "Deep",
  "confidence": "high" | "medium" | "low"
}

No markdown, no code fences, no explanation. Just the JSON.`;

/* ------------------------------------------------------------------ */
/* Vercel Serverless Handler                                           */
/* ------------------------------------------------------------------ */export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { imageBase64, mimeType = "image/jpeg" } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: "imageBase64 is required" });
    }

    const saKeyJson = process.env.GCP_SERVICE_ACCOUNT_KEY;
    if (!saKeyJson) {
      return res.status(500).json({ success: false, error: "Server misconfigured: missing GCP credentials" });
    }
    const saKey: ServiceAccountKey = JSON.parse(saKeyJson);
    const accessToken = await getAccessToken(saKey);

    const project = "fynd-jio-impetus-non-prod";
    const region = "us-central1";

    const geminiRes = await fetch(
      `https://${region}-aiplatform.googleapis.com/v1/projects/${project}/locations/${region}/publishers/google/models/gemini-2.0-flash:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { inlineData: { mimeType, data: imageBase64 } },
              { text: BODY_ANALYSIS_PROMPT },
            ],
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Vertex AI error:", geminiRes.status, errText);
      return res.status(502).json({ success: false, error: `Vertex AI error: ${geminiRes.status}` });
    }

    const data = await geminiRes.json();
    let textContent = "";
    const candidates = data?.candidates || [];
    for (const candidate of candidates) {
      const cParts = candidate?.content?.parts || [];
      for (const part of cParts) {
        if (part.text) textContent += part.text;
      }
    }

    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Could not parse Gemini response:", textContent);
      return res.status(502).json({ success: false, error: "Failed to parse AI response" });
    }

    const result = JSON.parse(jsonMatch[0]);

    if (result.error) {
      return res.status(200).json({ success: false, error: result.error });
    }

    // Validate body_type
    const validBodyTypes = ["rectangle", "hourglass", "inverted_triangle", "pear"];
    if (!validBodyTypes.includes(result.body_type)) {
      result.body_type = "rectangle";
    }

    // Validate skin_tone
    const validSkinTones = ["Light", "Fair", "Medium", "Olive", "Tan", "Dark", "Deep"];
    if (!validSkinTones.includes(result.skin_tone)) {
      result.skin_tone = "Medium";
    }

    return res.status(200).json({
      success: true,
      body_type: result.body_type,
      skin_tone: result.skin_tone,
      confidence: result.confidence || "medium",
    });
  } catch (err: any) {
    console.error("detect-body-type error:", err);
    return res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
}
