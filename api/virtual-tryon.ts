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
       v7 — AGGRESSIVE IDENTITY LOCK

       Key changes from v6:
       1. Body image sent 3 TIMES (start, after garments, end) —
          same strategy as triple-face in v5 but for the FULL body
       2. Face sent 2 times (start, end)
       3. EXPLICIT instruction to IGNORE the model/person in garment
          product photos — only use them for clothing design
       4. Temperature 0.0 for maximum determinism
       5. Numbered priority rules with FACE > GARMENTS
       6. "Forensic comparison" language to force pixel-level matching
    ───────────────────────────────────────────────────────────── */

    const parts: any[] = [];
    const hasFace = !!faceImageBase64;

    // ── IDENTITY ANCHOR #1 — Body photo as the PRIMARY reference ──
    parts.push({
      text: `[PHOTO TO EDIT — THIS IS THE MOST IMPORTANT IMAGE]
You are a photo editor. Below is a real photograph of a real customer. Your ONLY job is to change their clothes. Everything else — their face, hair, skin, body — must remain EXACTLY as it appears in this photo. You are performing a SURGICAL clothing replacement, nothing more.`,
    });
    parts.push({ inlineData: { mimeType: bodyMimeType, data: bodyImageBase64 } });

    // ── Face reference ──
    if (hasFace) {
      parts.push({
        text: `[CUSTOMER'S FACE — CLOSE-UP REFERENCE]
This is the same customer's face in detail. Memorize: face shape, jawline, nose, eyes, eyebrows, lips, skin tone, facial hair (or lack thereof), hairline, hair color, hair style. Your output MUST show THIS IDENTICAL face.`,
      });
      parts.push({ inlineData: { mimeType: faceMimeType, data: faceImageBase64 } });
    }

    // ── NEW CLOTHES — with explicit "ignore the model" instruction ──
    parts.push({
      text: `[NEW CLOTHING ITEMS]
Below are product photos of clothing items. IMPORTANT: These product photos may show a DIFFERENT person/mannequin wearing the clothes. COMPLETELY IGNORE any person or model visible in these product images. Extract ONLY the clothing design — colors, patterns, textures, logos, fit style — and apply it to the customer from the photo above.`,
    });

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
        text: `[${slot}: "${label}"] — Extract ONLY the clothing from this image. Ignore any person/model shown.`,
      });
      parts.push({ inlineData: { mimeType: g.mimeType, data: g.base64 } });
      garmentDescriptions.push(`${slot}: "${label}"`);
    }

    // ── IDENTITY ANCHOR #2 — Body photo AGAIN after garments ──
    parts.push({
      text: `[IDENTITY REMINDER — THE CUSTOMER'S BODY AGAIN]
After seeing the garment images above, here is the customer's photo again. This is who you are dressing. Do NOT let the garment product photos influence the person's appearance. The person in your output must match THIS photo exactly.`,
    });
    parts.push({ inlineData: { mimeType: bodyMimeType, data: bodyImageBase64 } });

    if (hasFace) {
      parts.push({
        text: `[IDENTITY REMINDER — THE CUSTOMER'S FACE AGAIN]
And here is their face again. This face MUST appear in your output — identical in every way.`,
      });
      parts.push({ inlineData: { mimeType: faceMimeType, data: faceImageBase64 } });
    }

    // ── EDITING INSTRUCTIONS ──
    const garmentList = garmentDescriptions.join(", ");
    parts.push({
      text: `[FINAL EDITING INSTRUCTIONS]

Edit the customer's photo. Replace ONLY their clothing with: ${garmentList}.

PRIORITY RULES (in order of importance):

RULE 1 — FACE IDENTITY (HIGHEST PRIORITY):
The output person must pass a forensic facial comparison with the customer's reference photos. This means:
- IDENTICAL face shape, jawline contour, chin shape
- IDENTICAL nose shape, bridge width, nostril shape
- IDENTICAL eye shape, eye color, eyebrow shape and thickness
- IDENTICAL lip shape, lip thickness
- IDENTICAL skin tone and complexion (EXACT same shade everywhere)
- IDENTICAL facial hair — if the customer has a beard, the output MUST have the SAME beard; if clean-shaven, output MUST be clean-shaven
- IDENTICAL hair — same color, same style, same length, same hairline
- If ANY facial feature differs from the customer's photo, DISCARD the result and regenerate

RULE 2 — BODY PRESERVATION:
- Same body proportions, height, build, muscle tone, weight as the customer
- Same skin tone on arms, hands, neck — must match face exactly
- Same pose orientation as the original photo

RULE 3 — GARMENT ACCURACY:
- Each new garment reproduced with full detail: colors, patterns, logos, prints, textures
- All garments visible: topwear on upper body, bottomwear on lower body, footwear on feet
- Do NOT simplify garments — include every design detail

RULE 4 — COMPOSITION:
- Full body, head to toe
- Clean neutral background (light gray studio)
- Natural professional lighting

CRITICAL WARNING: The garment product photos show DIFFERENT models/people. Do NOT blend their facial features or body type into your output. The ONLY face and body reference is the customer's photo provided separately.

Generate the edited photo now.`,
    });

    // ── IDENTITY ANCHOR #3 — Body + Face one final time ──
    parts.push({
      text: `[FINAL CHECK — Customer's photo one last time. Your output must show THIS person.]`,
    });
    parts.push({ inlineData: { mimeType: bodyMimeType, data: bodyImageBase64 } });

    if (hasFace) {
      parts.push({
        text: `[FINAL CHECK — Customer's face. Match this exactly. Generate now.]`,
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
          temperature: 0.0,
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
