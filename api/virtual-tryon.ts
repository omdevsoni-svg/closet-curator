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
       BUILD PROMPT + PARTS — v5 Triple-Face Identity Anchor

       Strategy:
       1. FACE first as primary identity anchor (face close-up)
       2. Body photo as pose/build reference
       3. Each garment with slot labels
       4. FACE again as mid-prompt reinforcement
       5. Main instruction with strong identity language
       6. FACE a third time at the end as final anchor

       The key insight: Gemini tends to "forget" the face when it
       sees many garment images. By repeating the face 3 times
       (beginning, middle, end), we force identity preservation.
    ───────────────────────────────────────────────────────────── */

    const parts: any[] = [];
    const hasFace = !!faceImageBase64;

    // ── FACE ANCHOR #1 — The very first thing the model sees ──
    if (hasFace) {
      parts.push({
        text: `[IDENTITY LOCK — THIS IS THE MOST IMPORTANT IMAGE IN THIS ENTIRE REQUEST]
This is the customer's face. You MUST memorize every detail: face shape, jawline, nose shape, eye shape, eyebrows, lips, skin tone, facial hair, hairline, hair color, hair style. The output image MUST show THIS EXACT face — not a similar face, not an approximation, but THIS person's actual face reproduced with photographic accuracy.`,
      });
      parts.push({ inlineData: { mimeType: faceMimeType, data: faceImageBase64 } });
    }

    // ── BODY REFERENCE — pose and build ──
    parts.push({
      text: `[BODY REFERENCE — same person's full body]
This shows the customer's full body. Match their exact body proportions, height, build, and skin tone. ${hasFace ? "This is the SAME person whose face you just saw above." : "Preserve this person's identity exactly."}`,
    });
    parts.push({ inlineData: { mimeType: bodyMimeType, data: bodyImageBase64 } });

    // ── GARMENT IMAGES with explicit slot labels ──
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
        text: `[${slot}: "${label}"]\nStudy this garment carefully. Note its exact color, pattern, texture, design details, logos, prints, collar style, and fit. The person MUST wear this EXACT garment — not a simplified version.`,
      });
      parts.push({ inlineData: { mimeType: g.mimeType, data: g.base64 } });
      garmentDescriptions.push(`- ${slot}: "${label}" — reproduce exactly as shown with ALL design details, patterns, logos, and colors`);
    }

    // ── FACE ANCHOR #2 — Mid-prompt reinforcement after garments ──
    if (hasFace) {
      parts.push({
        text: `[FACE REMINDER — Same customer as above. Do NOT forget this face.]
Here is the customer's face again. After seeing all the garments above, remember: the person wearing these clothes MUST have THIS EXACT face. Do not generate a generic model or a different person.`,
      });
      parts.push({ inlineData: { mimeType: faceMimeType, data: faceImageBase64 } });
    }

    // ── MAIN INSTRUCTION PROMPT ──
    const garmentList = garmentDescriptions.join("\n");
    const mainPrompt = `[VIRTUAL TRY-ON — PHOTO EDITING TASK]

You are a photo editor. Your task is to create a photorealistic image showing the SPECIFIC customer from the reference photos wearing a new outfit. This is NOT about generating a random model — it is about dressing THIS SPECIFIC PERSON in new clothes.

OUTFIT TO APPLY:
${garmentList}

RULE #1 — FACE IDENTITY (HIGHEST PRIORITY):
- The generated person MUST be the SAME person from the face and body reference photos
- Reproduce their EXACT facial features: face shape, nose, eyes, eyebrows, lips, jawline, facial hair, hairline
- Reproduce their EXACT skin tone, hair color, and hair style
- If the output face looks even slightly different from the reference, REGENERATE
- Think of it as: you are photoshopping clothes onto the customer's existing photo

RULE #2 — GARMENT ACCURACY:
- Each garment must be reproduced with FULL DETAIL: exact colors, patterns, logos, textures, collar/neckline style, fit
- Do NOT simplify any garment to just its base color — include prints, graphics, text, stripes, stitching details
- ALL garments must appear: topwear on upper body, bottomwear on lower body, footwear on feet
- If 3 garments are provided, ALL 3 must be visible. Do NOT skip any.

RULE #3 — COMPOSITION:
- Natural standing pose, full body visible from head to toe
- Clean neutral background (light gray or white studio backdrop)
- Professional fashion photography style lighting

Generate the image now.`;

    parts.push({ text: mainPrompt });

    // ── FACE ANCHOR #3 — Final reminder right before generation ──
    if (hasFace) {
      parts.push({
        text: `[FINAL IDENTITY CHECK — Last look at the customer's face before you generate]
This face MUST appear in your output. Generate now.`,
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
          temperature: 0.3,
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
