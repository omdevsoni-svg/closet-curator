import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";

/* ------------------------------------------------------------------ */
/*  GCP Service Account Auth: JWT → Access Token                       */
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
/*  v11 Virtual Try-On — Image EDITING approach                         */
/*                                                                      */
/*  KEY CHANGE: Instead of asking Gemini to generate a new person,      */
/*  we now ask it to EDIT the existing body photo — only changing the    */
/*  clothes while keeping the person's face, skin, body IDENTICAL.      */
/*  This preserves identity far better than generation from scratch.     */
/* ------------------------------------------------------------------ */

const SYSTEM_INSTRUCTION = `You are a photo editor. You receive a person's photo and one or more clothing item images. You MUST edit the person's photo so they appear wearing the new clothing. Do NOT create a new person — keep the EXACT same person from the input photo.

ABSOLUTE RULES:
- Output exactly one image — never refuse, never return only text
- The person's face MUST be identical to the input photo — same face shape, same eyes, same nose, same mouth, same beard/facial hair, same skin color, same hair. Do NOT alter the face in any way.
- The person's skin tone and complexion MUST remain exactly the same as the input
- Keep the same body shape, same pose, same camera angle
- ONLY replace the clothing — nothing else changes
- Show the FULL person from head to toe in the output — never crop the head
- When given multiple garments, dress the person in ALL of them`;

function buildUserPrompt(garmentCount: number, hasFaceRef: boolean, personDescription?: string): string {
  const personAnchor = personDescription
    ? ` I am a ${personDescription}.`
    : "";

  // v11b: Only use body photo — skip face close-up to avoid confusing the model
  // The body photo already contains the face, so sending a separate face photo
  // can cause the model to blend/average the two, producing a different face.
  if (garmentCount === 1) {
    return `The first image is MY photo — this is what I actually look like. The second image is a garment.${personAnchor}

Edit my photo to show me wearing this garment. My face, skin tone, hair, beard, and body must stay EXACTLY as they are in my photo — do not change my appearance at all. Only swap the clothes. Show my full body head to toe.`;
  }

  return `The first image is MY photo — this is what I actually look like. The remaining ${garmentCount} images are garments that form a complete outfit.${personAnchor}

Edit my photo to show me wearing ALL ${garmentCount} garments together. My face, skin tone, hair, beard, and body must stay EXACTLY as they are in my photo — do not change my appearance at all. Only swap the clothes. Every garment must be visible. Show my full body head to toe.`;
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
      bodyImageBase64,
      faceImageBase64,
      productImageBase64,
      productImages,
      bodyMimeType = "image/jpeg",
      faceMimeType = "image/jpeg",
      productMimeType = "image/jpeg",
      personDescription,
    } = req.body;

    if (!bodyImageBase64) {
      return res.status(400).json({ success: false, error: "bodyImageBase64 is required" });
    }

    // Collect garment images — support both single (backward compat) and multi
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

    // --- v11b: Build parts array — body photo only (no face close-up) ---
    // Sending a separate face close-up confuses the model into blending faces.
    // The body photo already contains the face, so just send:
    // 1. Body photo (the person to edit)
    // 2. Garment images
    // 3. User prompt
    const parts: any[] = [];
    const hasFaceRef = false; // v11b: deliberately skip face photo

    // Body photo — THE person reference (contains face + body)
    parts.push({ inlineData: { mimeType: bodyMimeType, data: bodyImageBase64 } });

    // Garment images
    for (const g of garments) {
      parts.push({ inlineData: { mimeType: g.mimeType, data: g.base64 } });
    }

    // Prompt that references both face and body
    parts.push({ text: buildUserPrompt(garments.length, hasFaceRef, personDescription) });

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        // v9: Use systemInstruction (proper Gemini field)
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.2,
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
      const textResponse = candidates[0]?.content?.parts?.find((p: any) => p.text)?.text || "";
      console.error("No images in response. Text:", textResponse);
      return res.status(200).json({
        success: false,
        error: "AI could not generate a try-on image. " + (textResponse ? textResponse.substring(0, 200) : "Try a different photo or clothing item."),
      });
    }

    return res.status(200).json({ success: true, images });
  } catch (err: any) {
    console.error("Virtual-tryon error:", err);
    return res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
}
