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
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
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
    throw new Error(
      `Token exchange failed: ${res.status} ${await res.text()}`
    );
  }
  const data = await res.json();
  return data.access_token;
}

/* ------------------------------------------------------------------ */
/*  Virtual Try-On Prompts                                              */
/* ------------------------------------------------------------------ */

const TRYON_PROMPT_SINGLE = `VIRTUAL TRY-ON: Dress the person in the provided garment.

ABSOLUTE RULE — IDENTITY LOCK (HIGHEST PRIORITY):
The OUTPUT image MUST show the EXACT SAME PERSON from the reference photos.
This means: same face, same skin color, same ethnicity, same body type, same hair.
Violation of identity is a FAILURE. The person must be recognizable as the same individual.

IMAGE MAP:
- Image 1: FACE & IDENTITY REFERENCE — Study this face carefully. Memorize every detail: exact skin tone and complexion (DO NOT lighten or darken), facial structure, jawline shape, nose shape, eye shape and color, eyebrow thickness and shape, lip shape, facial hair pattern, hair color and style, forehead size, cheekbone structure.
- Image 2: FULL BODY REFERENCE — Same person. Match their exact body type, height, build, weight, posture, and proportions.
- Image 3: THE GARMENT — dress the person in this clothing item.

STRICT PROCESS:
1. Start with the EXACT person from Images 1-2 — do NOT create a new person.
2. Keep their EXACT skin color (critical — do not make lighter or darker).
3. Keep their EXACT face (critical — do not substitute a model).
4. Only change their clothing to the garment from Image 3.
5. Maintain a similar pose and neutral background.

ABSOLUTELY FORBIDDEN:
- Changing the person's skin color or complexion in ANY way
- Substituting a different face or model
- Making the person thinner, taller, or different body type
- Changing hair color, style, length, or facial hair
- Altering ethnicity, age, or any identifying features
- Using a stock photo model instead of the actual person

OUTPUT: One photorealistic full-body photo showing this EXACT person wearing the garment.`;

function buildMultiGarmentPrompt(count: number): string {
  return `VIRTUAL TRY-ON: Dress the person in ${count} garments as one complete outfit.

ABSOLUTE RULE — IDENTITY LOCK (HIGHEST PRIORITY):
The OUTPUT image MUST show the EXACT SAME PERSON from the reference photos.
This means: same face, same skin color, same ethnicity, same body type, same hair.
Violation of identity is a FAILURE. The person must be recognizable as the same individual.

IMAGE MAP:
- Image 1: FACE & IDENTITY REFERENCE — Study this face carefully. Memorize every detail: exact skin tone and complexion (DO NOT lighten or darken), facial structure, jawline shape, nose shape, eye shape and color, eyebrow thickness and shape, lip shape, facial hair pattern, hair color and style, forehead size, cheekbone structure.
- Image 2: FULL BODY REFERENCE — Same person full body. Match their exact body type, height, build, weight, posture, and proportions.
- Images 3–${count + 2}: The ${count} garment(s) to dress them in.

STRICT PROCESS:
1. Start with the EXACT person from Images 1-2 — do NOT create a new person.
2. Keep their EXACT skin color (critical — do not make lighter or darker).
3. Keep their EXACT face (critical — do not substitute a model).
4. Remove their current clothes.
5. Dress them in ALL ${count} garments combined as one outfit.
6. Maintain a similar pose and neutral background.

ABSOLUTELY FORBIDDEN:
- Changing the person's skin color or complexion in ANY way
- Substituting a different face or model
- Making the person thinner, taller, or different body type
- Changing hair color, style, length, or facial hair
- Altering ethnicity, age, or any identifying features
- Using a stock photo model instead of the actual person

OUTPUT: One photorealistic full-body photo showing this EXACT person wearing all ${count} garments.`;
}

/* ------------------------------------------------------------------ */
/*  Vercel Serverless Handler                                           */
/* ------------------------------------------------------------------ */

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
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
      return res
        .status(400)
        .json({ success: false, error: "bodyImageBase64 is required" });
    }

    // Support both single product image (backward compat) and multiple product images
    const garments: { base64: string; mimeType: string; label?: string }[] =
      [];
    if (
      productImages &&
      Array.isArray(productImages) &&
      productImages.length > 0
    ) {
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
      return res
        .status(400)
        .json({ success: false, error: "At least one product image is required" });
    }

    // Parse service account key from env
    const saKeyJson = process.env.GCP_SERVICE_ACCOUNT_KEY;
    if (!saKeyJson) {
      return res
        .status(500)
        .json({ success: false, error: "Server misconfigured: missing GCP credentials" });
    }
    const saKey: ServiceAccountKey = JSON.parse(saKeyJson);
    const accessToken = await getAccessToken(saKey);

    const project = "fynd-jio-impetus-non-prod";
    const region = "us-central1";
    const model = "gemini-2.5-flash-image";
    const url = `https://${region}-aiplatform.googleapis.com/v1/projects/${project}/locations/${region}/publishers/google/models/${model}:generateContent`;

    // Build the parts array with all reference images + prompt
    const parts: any[] = [];

    // ALWAYS send body image TWICE — once as face reference, once as full body reference
    // This gives the model a stronger identity signal regardless of garment count
    parts.push({
      text: "IMAGE 1 — FACE & IDENTITY REFERENCE: This is the REAL CUSTOMER. You MUST reproduce this EXACT face, skin color, and features. Study every detail of this face — skin tone, facial structure, hair, facial hair. This person's identity MUST be preserved in the output:",
    });
    parts.push({
      inlineData: { mimeType: bodyMimeType, data: bodyImageBase64 },
    });

    parts.push({
      text: "IMAGE 2 — FULL BODY REFERENCE: Same customer as Image 1. Match their exact body shape, height, weight, proportions, and skin tone. The output person must look like THIS person, not a model:",
    });
    parts.push({
      inlineData: { mimeType: bodyMimeType, data: bodyImageBase64 },
    });

    // Add all garment images
    for (let i = 0; i < garments.length; i++) {
      const g = garments[i];
      const label = g.label || `Garment ${i + 1}`;
      const imgNum = i + 3;
      parts.push({
        text: `IMAGE ${imgNum} — CLOTHING ITEM ${i + 1}: ${label} (dress the person in this exact garment):`,
      });
      parts.push({ inlineData: { mimeType: g.mimeType, data: g.base64 } });
    }

    // Add the instruction prompt
    const prompt =
      garments.length > 1
        ? buildMultiGarmentPrompt(garments.length)
        : TRYON_PROMPT_SINGLE;
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
          temperature: 0.1,
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
      const textResponse =
        candidates[0]?.content?.parts?.find((p: any) => p.text)?.text || "";
      console.error("No images in response. Text:", textResponse);
      return res.status(200).json({
        success: false,
        error:
          "AI could not generate a try-on image. " +
          (textResponse
            ? textResponse.substring(0, 200)
            : "Try a different photo or clothing item."),
      });
    }

    return res.status(200).json({ success: true, images });
  } catch (err: any) {
    console.error("virtual-tryon error:", err);
    return res
      .status(500)
      .json({ success: false, error: err.message || "Internal server error" });
  }
}
