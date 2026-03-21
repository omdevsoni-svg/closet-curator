import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";

/* ------------------------------------------------------------------ */
/*  GCP Service Account Auth: JWT → Access Token                      */
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
/*  Vercel Serverless Handler                                         */
/* ------------------------------------------------------------------ */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ success: false, error: "Method not allowed" });

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

    if (!bodyImageBase64)
      return res.status(400).json({ success: false, error: "bodyImageBase64 is required" });

    const garments: { base64: string; mimeType: string; label?: string }[] = [];
    if (productImages && Array.isArray(productImages) && productImages.length > 0) {
      for (const img of productImages) {
        garments.push({ base64: img.base64, mimeType: img.mimeType || "image/jpeg", label: img.label });
      }
    } else if (productImageBase64) {
      garments.push({ base64: productImageBase64, mimeType: productMimeType });
    }
    if (garments.length === 0)
      return res.status(400).json({ success: false, error: "At least one product image is required" });

    const saKeyJson = process.env.GCP_SERVICE_ACCOUNT_KEY;
    if (!saKeyJson)
      return res.status(500).json({ success: false, error: "Server misconfigured: missing GCP credentials" });
    const saKey: ServiceAccountKey = JSON.parse(saKeyJson);
    const accessToken = await getAccessToken(saKey);

    const project = "fynd-jio-impetus-non-prod";
    const region = "us-central1";
    const model = "gemini-2.5-flash-image";
    const url = `https://${region}-aiplatform.googleapis.com/v1/projects/${project}/locations/${region}/publishers/google/models/${model}:generateContent`;

    /* ─────────────────────────────────────────────────────────────
       BUILD PROMPT + PARTS
       Strategy:
       1. Show the person FIRST (body + face) as the identity anchor
       2. Show EACH garment with explicit slot label
       3. Build a detailed text prompt that references every garment
          by its slot and describes exactly what to put where
       4. End with explicit verification checklist
    ───────────────────────────────────────────────────────────── */

    const parts: any[] = [];
    const hasFace = !!faceImageBase64;

    // ── PERSON REFERENCE ──
    parts.push({
      text: "[PERSON REFERENCE — do not change this person's identity]\nBelow is the customer. Your output MUST show this EXACT same person: same face, same skin tone, same hair, same body shape.",
    });
    parts.push({ inlineData: { mimeType: bodyMimeType, data: bodyImageBase64 } });

    if (hasFace) {
      parts.push({
        text: "[FACE CLOSE-UP — identity verification]\nSame person's face close-up. Preserve every facial detail exactly.",
      });
      parts.push({ inlineData: { mimeType: faceMimeType, data: faceImageBase64 } });
    }

    // ── GARMENT IMAGES with explicit slot labels ──
    const garmentDescriptions: string[] = [];
    for (let i = 0; i < garments.length; i++) {
      const g = garments[i];
      const label = g.label || `Garment ${i + 1}`;
      // Determine slot from label
      const labelLower = label.toLowerCase();
      let slot = "";
      if (labelLower.includes("top") || labelLower.includes("shirt") || labelLower.includes("tee") || labelLower.includes("polo") || labelLower.includes("hoodie") || labelLower.includes("jacket") || labelLower.includes("blazer") || labelLower.includes("sweater") || labelLower.includes("linen") || labelLower.includes("henley")) {
        slot = "TOPWEAR";
      } else if (labelLower.includes("bottom") || labelLower.includes("pant") || labelLower.includes("jean") || labelLower.includes("chino") || labelLower.includes("trouser") || labelLower.includes("short") || labelLower.includes("jogger")) {
        slot = "BOTTOMWEAR";
      } else if (labelLower.includes("shoe") || labelLower.includes("sneaker") || labelLower.includes("boot") || labelLower.includes("loafer") || labelLower.includes("sandal") || labelLower.includes("leather c") || labelLower.includes("running") || labelLower.includes("oxford") || labelLower.includes("footwear")) {
        slot = "FOOTWEAR";
      } else {
        slot = `GARMENT ${i + 1}`;
      }

      parts.push({
        text: `[${slot}: "${label}"]\nStudy this garment image carefully. Note its exact color, pattern, texture, design details, logos, prints, collar style, and fit. The person MUST wear this EXACT garment — not a simplified version of it.`,
      });
      parts.push({ inlineData: { mimeType: g.mimeType, data: g.base64 } });
      garmentDescriptions.push(`- ${slot}: "${label}" — reproduce this garment exactly as shown, including all design details, patterns, logos, and colors`);
    }

    // ── MAIN INSTRUCTION PROMPT ──
    const garmentList = garmentDescriptions.join("\n");
    const mainPrompt = `[VIRTUAL TRY-ON INSTRUCTION]

Generate a photorealistic full-body image of the person shown above wearing ALL of the following garments together as one complete outfit:

${garmentList}

GARMENT ACCURACY (CRITICAL — read carefully):
- Each garment MUST be reproduced with FULL DETAIL: exact colors, exact patterns, exact logos, exact textures, exact collar/neckline style, exact fit
- Do NOT simplify any garment to just its base color — you must include prints, graphics, text, stripes, patterns, stitching details, and any design elements visible in the garment photos
- ALL garments must appear in the output — topwear on the upper body, bottomwear on the lower body, footwear on the feet
- If 3 garments are provided (top + bottom + shoes), ALL 3 must be visible in the output image. Do NOT skip any.

PERSON IDENTITY (CRITICAL):
- The person MUST be the same person from the reference photo — same face, same skin tone, same hair, same body build
- Do NOT substitute a different person or model
- Keep a natural standing pose, full body visible from head to toe
- Use a clean neutral background

VERIFICATION BEFORE OUTPUT:
1. Is the person's face identical to the reference? If no, fix it.
2. Is the topwear garment shown with all its details (not just base color)? If no, fix it.
3. Is the bottomwear garment shown correctly? If no, fix it.
4. Is the footwear visible and correct? If no, fix it.
5. Are ALL provided garments present in the image? If no, fix it.

Generate the image now.`;

    parts.push({ text: mainPrompt });

    // ── Call Gemini ──
    const geminiRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
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
        error: "AI could not generate a try-on image. " +
          (textResponse ? textResponse.substring(0, 200) : "Try a different photo or clothing item."),
      });
    }

    return res.status(200).json({ success: true, images });
  } catch (err: any) {
    console.error("virtual-tryon error:", err);
    return res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
}
