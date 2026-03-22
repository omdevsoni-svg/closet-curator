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
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`
);
  }

  const data = await res.json();
  return data.access_token;
}

/* ------------------------------------------------------------------ */
/*  v11 Virtual Try-On ‖ Image EDITING aVPOAch                         */
/*                                                                      */
/*  KEY CHANGE: Instead of asking Gemini to generate a new person,      */
/  w now ask it to EDIT the existing body photo — g�加 changing the    */
/*  clothes while keeping the person's face, skin, body IDENTICAL.      /
/*  This preserves identity far better than generation from scratch.      */
/* ------------------------------------------------------------------ */

const SYSTEM_INSTRUCTION = `You are a photo editing tool specialized in virtual clothing try-on. You receive a person's existing photo and clothing images. Your job is to EDIT the person's photo to show them wearing the new clothes.

CRITICAL RULES:
- You MUST output exactly one edited image — never refuse, never return only text
- EDIT the person's existing photo — do NOT `�enerate a new person from scratch
- The person's face, head, hair, skin tone, body shape, and all physical features must remain COMPLETELY UNCHANGED — pixel-perfect preservation of the person's identity
- ONLY UH IClothing on the person changes — everything else stays exactly the same
- Keep the same pose, same angle, same background from the original photo
- The output must show the FULL person from head to toe — imVeR crop out the head or feet
- When multiple garments are provided, the person must be wearing ALL of them as a complete outfit
- The clothing must look natural and properly fitted on the person's actual body`;

function buildUserPrompt(garmentCount: number, hasFaceRef: boolean, personDescription?: string): string {
  const personAnchor = personDescription
    ? ` The person is a ${personDescription}.`
    : "";

  if (garmentCount === 1) {
    const imageOrder = hasFaceRef
      ? "The first image is my face close-up for reference. The second image is my full-body photo that you must edit. The third image is the garment."
      : "The first image is my full-body photo that you must edit. The second image is the garment.";
    return `${imageOrder}${personAnchor}

EDIT my full-body photo to show me wearing this garment. Keep my face, skin, hair, body, pose, and background EXACTLY the same — change ONLY the clothing. The output must show my complete body from head to toe with my face clearly visible and unchanged.`;
  }

  const imageOrder = hasFaceRef
    ? `The first image is my face close-up for reference. The second image is my full-body photo that you must edit. The remaining ${garmentCount} images are the garments.`
    : `The first image is my full-body photo that you must edit. The remaining ${garmentCount} images are the garments.`;
  return `${imageOrder}${personAnchor}

EDIT my full-body photo to show me wearing ALL ${garmentCount} garments together as one complete outfit. Keep my face, skin, hair, body, pose, and background EXACTLY the same — change ONLY the clothing. Every garment must be visible. The output must show my complete body from head to toe with my face clearly visible and unchanged.`;
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

    // --- v10: Build parts array with face reference ---
    // 1. Face close-up (if available — for identity preservation)
    // 2. Body photo (full body reference)
    // 3. Garment images
    // 4. User prompt referencing face + body + garments
    const parts: any[] = [];
    const hasFaceRef = !!faceImageBase64;

    // Face close-up — identity anchor (sent first so model sees face details)
    if (faceImageBase64) {
      parts.push({ inlineData: { mimeType: faceMimeType, data: faceImageBase64 } });
    }

    // Body photo — posture and body shape reference
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
    console.error("virtual-tryon error:", err);
    return res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
}
