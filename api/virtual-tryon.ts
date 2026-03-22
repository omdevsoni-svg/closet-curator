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
/*  v9 Virtual Try-On — Simplified prompting for Gemini 2.5 Flash      */
/*                                                                      */
/*  Key changes from v5-v7:                                             */
/*  1. systemInstruction for model behavior (proper Gemini field)       */
/*  2. Body photo sent ONCE — no separate face photo                    */
/*  3. Short, direct user prompt — less is more with Gemini             */
/*  4. Text description of person to anchor identity                    */
/*  5. Temperature 0.4 (not 0.0 which can cause artifacts)             */
/* ------------------------------------------------------------------ */

const SYSTEM_INSTRUCTION = `You are a professional virtual clothing try-on system. Your ONLY job is to take a person's photo and show them wearing new clothing. You MUST always generate exactly one new image — never refuse, never return text only, never explain why you cannot do it.

Rules:
- ALWAYS generate an image output — this is mandatory, no exceptions
- The person's face, skin tone, hair, body shape, and all physical features must be IDENTICAL to the input photo
- Only the clothing changes — nothing else about the person changes
- When multiple garments are provided, dress the person in ALL of them together as a complete outfit
- Output must be photorealistic, natural-looking, full body head to toe, clean background
- Never skip any garment — every provided clothing item must appear on the person`;

function buildUserPrompt(garmentCount: number, personDescription?: string): string {
  const personAnchor = personDescription
    ? `\nThe person in the photo: ${personDescription}.`
    : "";

  if (garmentCount === 1) {
    return `Here is my full-body photo, followed by one garment image.${personAnchor}

Generate a new photo of me wearing this garment. Keep my face and body exactly the same — only change the clothing.`;
  }

  return `Here is my full-body photo, followed by ${garmentCount} garment images (topwear, bottomwear, and footwear) that form a complete outfit.${personAnchor}

Generate exactly one new photo of me wearing ALL ${garmentCount} garments together as one complete outfit. Every garment must be visible on me. Keep my face and body exactly the same — only change the clothing. You must output an image.`;
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
      productImageBase64,
      productImages,
      bodyMimeType = "image/jpeg",
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

    // --- v9: Build clean parts array ---
    // 1. Body photo (ONCE — no separate face photo)
    // 2. Garment images
    // 3. Short user prompt with optional person description
    const parts: any[] = [];

    // Body photo — the ONLY person reference
    parts.push({ inlineData: { mimeType: bodyMimeType, data: bodyImageBase64 } });

    // Garment images — no verbose labels, just the images
    for (const g of garments) {
      parts.push({ inlineData: { mimeType: g.mimeType, data: g.base64 } });
    }

    // Short, direct prompt
    parts.push({ text: buildUserPrompt(garments.length, personDescription) });

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
          temperature: 0.4,
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
    console.error("virtual-tryon error:", err);
    return res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
}
