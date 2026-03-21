import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";

/* ------------------------------------------------------------------ */
/*  GCP Service Account Auth: JWT ÃÂ¢ÃÂÃÂ Access Token                       */
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
/*  Virtual Try-On Prompt                                              */
/* ------------------------------------------------------------------ */

const TRYON_PROMPT_SINGLE = `VIRTUAL TRY-ON: Dress the person in the provided garment.

CRITICAL RULE — IDENTITY LOCK:
The person in the OUTPUT must be IDENTICAL to the person in Image 1.
This is NON-NEGOTIABLE. Do NOT generate a different person, model, or face.

IMAGE MAP:
- Image 1: THE PERSON — replicate this person exactly. Copy every facial detail: jawline, nose, eyes, eyebrows, lips, ears, facial hair, skin texture, complexion, hair color, hair length, hair style. Match their body type, height, build, and skin tone.
- Image 2: THE GARMENT — the clothing item to dress them in.

WHAT TO DO:
1. Take the exact person from Image 1 — their real face, real body, real skin.
2. Dress them in the garment from Image 2, replacing only the relevant clothing.
3. Keep the same pose and background style as Image 1.

FORBIDDEN:
- Do NOT change the face in any way.
- Do NOT change skin color or tone.
- Do NOT change hair color, style, or length.
- Do NOT use a stock model or generic person.
- Do NOT alter age, ethnicity, or body type.

OUTPUT: One photorealistic full-body photo showing the EXACT same person wearing the garment.`

function buildMultiGarmentPrompt(count: number): string {
  return `VIRTUAL TRY-ON: Dress the person in ${count} garments.

CRITICAL RULE — IDENTITY LOCK:
The person in the OUTPUT must be IDENTICAL to the person in Images 1 and 2.
This is NON-NEGOTIABLE. Do NOT generate a different person, model, or face.

IMAGE MAP:
- Image 1: FACE REFERENCE — replicate this face pixel-for-pixel. Every detail matters: jawline, nose, eyes, eyebrows, lips, ears, facial hair, skin texture, complexion, hair color, hair length, hair style.
- Image 2: BODY REFERENCE — same person full body. Match height, build, posture, skin tone, body proportions exactly.
- Images 3–${count + 2}: The ${count} garment(s) to dress them in.

WHAT TO DO:
1. Start with the exact person from Images 1–2 — their real face, real body, real skin.
2. Remove their current clothes.
3. Dress them in ALL ${count} provided garments combined as one complete outfit.
4. Keep the same pose and background style as Image 2.

FORBIDDEN:
- Do NOT change the face in any way.
- Do NOT change skin color or tone.
- Do NOT change hair color, style, or length.
- Do NOT use a stock model or generic person.
- Do NOT alter age, ethnicity, or body type.
- Do NOT add or remove glasses, beard, or accessories from the face.

OUTPUT: One photorealistic full-body photo showing the EXACT same person wearing all ${count} garments.`;
  }

/* ------------------------------------------------------------------ */
/*  Vercel Serverless Handler                                          */
/* ------------------------------------------------------------------ */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const {
      faceImageBase64,
      bodyImageBase64,
      productImageBase64,
      productImages,
      faceMimeType = "image/jpeg",
      bodyMimeType = "image/jpeg",
      productMimeType = "image/jpeg",
    } = req.body;

    if (!bodyImageBase64) {
      return res.status(400).json({ success: false, error: "bodyImageBase64 is required" });
    }

    // Support both single product image (backward compat) and multiple product images
    const garments: { base64: string; mimeType: string; label?: string }[] = [];
    if (productImages && Array.isArray(productImages) && productImages.length > 0) {
      for (const img of productImages) {
        garments.push({
          base64: img.base64,
          mimeType: img.mimeType || "image/jpeg",
          label: img.label,
        });
      }
    } else if (productImageBase64) {
      garments.push({ base64: productImageBase64, mimeType: productMimeType });
    }

    if (garments.length === 0) {
      return res.status(400).json({ success: false, error: "At least one product image is required" });
    }

    // Parse service account key from env
    const saKeyJson = process.env.GCP_SERVICE_ACCOUNT_KEY;
    if (!saKeyJson) {
      return res.status(500).json({ success: false, error: "Server misconfigured: missing GCP credentials" });
    }

    const saKey: ServiceAccountKey = JSON.parse(saKeyJson);
    const accessToken = await getAccessToken(saKey);

    const project = "fynd-jio-impetus-non-prod";
    const region = "us-central1";
    const model = "gemini-2.5-flash-image";
    const url = `https://${region}-aiplatform.googleapis.com/v1/projects/${project}/locations/${region}/publishers/google/models/${model}:generateContent`;

    // Build the parts array with all reference images + prompt
    const parts: any[] = [];

    // For multi-garment: send body image TWICE (as face ref + body ref) for stronger identity signal
    if (garments.length > 1) {
      parts.push({ text: "FACE CLOSE-UP REFERENCE Ã¢ÂÂ this is the customer. You MUST reproduce this EXACT face, hair, and skin tone:" });
      parts.push({ inlineData: { mimeType: bodyMimeType, data: bodyImageBase64 } });
      parts.push({ text: "FULL BODY REFERENCE Ã¢ÂÂ same customer. Match their body shape, height, proportions, and pose:" });
      parts.push({ inlineData: { mimeType: bodyMimeType, data: bodyImageBase64 } });
    } else {
      parts.push({ text: "PERSON REFERENCE IMAGE (match this person's face, body, proportions, and skin tone exactly):" });
      parts.push({ inlineData: { mimeType: bodyMimeType, data: bodyImageBase64 } });
    }

    // Add all garment images
    for (let i = 0; i < garments.length; i++) {
      const g = garments[i];
      const label = g.label || `Garment ${i + 1}`;
      parts.push({ text: `CLOTHING ITEM ${i + 1}: ${label} (dress the person in this exact garment):` });
      parts.push({ inlineData: { mimeType: g.mimeType, data: g.base64 } });
    }

    // Add the instruction prompt ÃÂ¢ÃÂÃÂ use multi-garment prompt when more than 1 item
    const prompt = garments.length > 1 ? buildMultiGarmentPrompt(garments.length) : TRYON_PROMPT_SINGLE;
    parts.push({ text: prompt });

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 8192,
          responseModalities: ["TEXT", "IMAGE"],
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Vertex AI error:", geminiRes.status, errText);
      return res.status(502).json({
        success: false,
        error: `Vertex AI error: ${geminiRes.status}`,
        details: errText.substring(0, 500),
      });
    }

    const data = await geminiRes.json();
    const candidates = data?.candidates || [];
    const images: { mimeType: string; base64: string }[] = [];

    // Extract generated images from response
    for (const candidate of candidates) {
      const cParts = candidate?.content?.parts || [];
      for (const part of cParts) {
        if (part.inlineData) {
          images.push({
            mimeType: part.inlineData.mimeType,
            base64: part.inlineData.data,
          });
        }
      }
    }

    if (images.length === 0) {
      // If no images returned, check if there's a text response explaining why
      const textResponse = candidates[0]?.content?.parts?.find((p: any) => p.text)?.text || "";
      console.error("No images in response. Text:", textResponse);
      return res.status(200).json({
        success: false,
        error: "AI could not generate a try-on image. " + (textResponse ? textResponse.substring(0, 200) : "Try a different photo or clothing item."),
      });
    }

    return res.status(200).json({ success: true, images });
  } catch (err: any) {
    console.error("virtual-tryon error:", err);
    return res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
}
