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
       v6 — IMAGE EDITING APPROACH

       Instead of asking Gemini to GENERATE a new person, we ask
       it to EDIT the existing body photo — only replacing clothes.
       This preserves the original face/body pixels.

       Structure:
       1. "Here is a photo of a person" [body image]
       2. "Here are the new clothes" [garment images]
       3. "Edit the photo: replace ONLY the clothes, keep the
          person's face, body, skin, hair EXACTLY as they are"
    ───────────────────────────────────────────────────────────── */

    const parts: any[] = [];
    const hasFace = !!faceImageBase64;

    // ── THE PHOTO TO EDIT — this is the primary input ──
    parts.push({
      text: `Edit this photo of a person. You will replace ONLY their clothing — everything else about the person (face, skin, hair, body shape, pose) must remain EXACTLY as it appears in this photo. Do NOT change, alter, or regenerate the person's face in any way. Treat the face as frozen pixels that cannot be modified.`,
    });
    parts.push({ inlineData: { mimeType: bodyMimeType, data: bodyImageBase64 } });

    // ── Face reference for extra identity anchoring ──
    if (hasFace) {
      parts.push({
        text: `This is a close-up of the same person's face. The edited output MUST have this IDENTICAL face — same features, same skin tone, same facial hair, same expression. Do NOT alter any facial features.`,
      });
      parts.push({ inlineData: { mimeType: faceMimeType, data: faceImageBase64 } });
    }

    // ── NEW CLOTHES TO DRESS THEM IN ──
    const garmentDescriptions: string[] = [];
    for (let i = 0; i < garments.length; i++) {
      const g = garments[i];
      const label = g.label || `Garment ${i + 1}`;
      const labelLower = label.toLowerCase();
      let slot = "";
      if (labelLower.includes("top") || labelLower.includes("shirt") || labelLower.includes("tee") || labelLower.includes("polo") || labelLower.includes("hoodie") || labelLower.includes("jacket") || labelLower.includes("blazer") || labelLower.includes("sweater") || labelLower.includes("linen") || labelLower.includes("henley") || labelLower.includes("kurta") || labelLower.includes("vest")) {
        slot = "TOPWEAR";
      } else if (labelLower.includes("bottom") || labelLower.includes("pant") || labelLower.includes("jean") || labelLower.includes("chino") || labelLower.includes("trouser") || labelLower.includes("short") || labelLower.includes("jogger") || labelLower.includes("cargo")) {
        slot = "BOTTOMWEAR";
      } else if (labelLower.includes("shoe") || labelLower.includes("sneaker") || labelLower.includes("boot") || labelLower.includes("loafer") || labelLower.includes("sandal") || labelLower.includes("leather c") || labelLower.includes("running") || labelLower.includes("oxford") || labelLower.includes("footwear") || labelLower.includes("slip-on") || labelLower.includes("moccasin")) {
        slot = "FOOTWEAR";
      } else {
        slot = `GARMENT ${i + 1}`;
      }

      parts.push({
        text: `[NEW ${slot}: "${label}"] — Replace their current ${slot.toLowerCase()} with this exact garment. Reproduce every detail: color, pattern, logos, prints, texture, fit.`,
      });
      parts.push({ inlineData: { mimeType: g.mimeType, data: g.base64 } });
      garmentDescriptions.push(`${slot}: "${label}"`);
    }

    // ── EDITING INSTRUCTIONS ──
    const garmentList = garmentDescriptions.join(", ");
    parts.push({
      text: `[EDITING INSTRUCTIONS]

Edit the original photo by replacing the person's current clothes with: ${garmentList}.

WHAT TO CHANGE:
- Replace the clothing ONLY with the new garments shown above
- Each garment must be rendered with FULL detail — exact colors, patterns, logos, prints, textures
- All garments must appear: topwear on upper body, bottomwear on lower body, footwear on feet

WHAT MUST NOT CHANGE (CRITICAL):
- The person's FACE must be pixel-perfect identical to the original photo — same eyes, nose, mouth, jawline, skin tone, facial hair, expression
- The person's HAIR must be identical — same style, color, length
- The person's BODY PROPORTIONS must be identical — same height, build, weight
- The person's SKIN TONE must be identical everywhere
- Think of this as Photoshop: you are selecting ONLY the clothing regions and replacing them. The face and body are on a locked layer that cannot be edited.

OUTPUT:
- Full body photo, head to toe, same person, new clothes only
- Clean neutral background
- Natural lighting

Edit the photo now — change clothes only, preserve everything else exactly.`,
    });

    // ── Face anchor at the very end ──
    if (hasFace) {
      parts.push({
        text: `[FINAL CHECK] The output face must match this face exactly. Change nothing about the person — only their clothes.`,
      });
      parts.push({ inlineData: { mimeType: faceMimeType, data: faceImageBase64 } });
    }

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
