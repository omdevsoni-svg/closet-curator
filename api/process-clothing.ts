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
/*  Clothing analysis prompt                                           */
/* ------------------------------------------------------------------ */

const CLOTHING_PROMPT = `First, determine if this image contains a clothing item, garment, footwear, or fashion accessory. If the image does NOT contain any clothing/garment/footwear/accessory (e.g. it shows a person without focus on clothing, a random object, food, scenery, animal, etc.), return this exact JSON:
{"is_garment": false, "rejection_reason": "Please upload valid garment image, ensure the photo is captured in a well-lit condition."}

If the image DOES contain a valid clothing/garment item, analyze it and return a JSON object with these exact fields:
- is_garment: true
- name: a short descriptive name for the clothing item (e.g. "Blue Denim Jacket")
- category: EXACTLY one of these values: "Tops", "Bottoms", "Dresses", "Outerwear", "Activewear", "Footwear", "Accessories"
- color: EXACTLY one of these values: "Black", "White", "Navy", "Blue", "Red", "Green", "Beige", "Grey", "Pink", "Brown"
- material: fabric type if identifiable, or best guess (e.g. "Cotton", "Polyester", "Denim", "Silk", "Wool", "Leather")
- tags: array of 2-4 descriptive tags (e.g. ["casual", "summer", "lightweight"])
- gender: one of: men, women, unisex

Return ONLY the raw JSON object. No markdown, no code fences, no explanation.`;

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
    const { imageBase64, mimeType = "image/jpeg" } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ success: false, error: "imageBase64 is required" });
    }

    // Parse service account key from env
    const saKeyJson = process.env.GCP_SERVICE_ACCOUNT_KEY;
    if (!saKeyJson) {
      return res.status(500).json({ success: false, error: "Server misconfigured: missing GCP credentials" });
    }

    const saKey: ServiceAccountKey = JSON.parse(saKeyJson);

    // Get access token
    const accessToken = await getAccessToken(saKey);

    const project = "fynd-jio-impetus-non-prod";
    const region = "us-central1";

    /* ---------------------------------------------------------------- */
    /*  v30: PARALLEL detection + enhancement                            */
    /*                                                                    */
    /*  Previously these ran sequentially (detection → wait → enhance).   */
    /*  Now both fire simultaneously with Promise.allSettled.              */
    /*  Enhancement uses generic "clothing item" instead of detected      */
    /*  category — the model sees the actual image so the extraction      */
    /*  quality is identical. Saves ~3-5s per upload.                     */
    /* ---------------------------------------------------------------- */

    // --- Build both requests in parallel ---

    const detectionPromise = fetch(
      `https://${region}-aiplatform.googleapis.com/v1/projects/${project}/locations/${region}/publishers/google/models/gemini-2.0-flash:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: CLOTHING_PROMPT },
          ]}],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
        }),
      }
    );

    const enhancePrompt = `Extract the COMPLETE clothing item from this image. Remove the person/model/mannequin body COMPLETELY - show ONLY the clothing as a ghost mannequin / flat lay product photo.

WHAT TO REMOVE:
- The human model's body, face, hands, feet, skin - ALL of it
- Any physical mannequin body (beige/tan plastic torso, neck, hands, stand)
- Background, props, accessories that aren't part of the garment

WHAT TO KEEP:
- ONLY the fabric/clothing itself
- ALL layers of the outfit together as one complete look
- Every garment detail: exact color, pattern, fabric texture, buttons, embroidery, logos, collar, sleeves, stitching

Output: One clean product photo of the COMPLETE outfit on a white background. NO person or mannequin body visible.`;

    const enhancementPromise = fetch(
      `https://${region}-aiplatform.googleapis.com/v1/projects/${project}/locations/${region}/publishers/google/models/gemini-2.5-flash-image:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: enhancePrompt },
          ]}],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 8192,
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
      }
    );

    // Fire both in parallel
    const [detectionResult, enhancementResult] = await Promise.allSettled([
      detectionPromise,
      enhancementPromise,
    ]);

    // --- Process detection result ---
    if (detectionResult.status === "rejected") {
      console.error("Detection call rejected:", detectionResult.reason);
      return res.status(502).json({ success: false, error: "AI detection call failed" });
    }

    const geminiRes = detectionResult.value;
    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Vertex AI error:", geminiRes.status, errText);
      return res.status(502).json({ success: false, error: `Vertex AI error: ${geminiRes.status}` });
    }

    const data = await geminiRes.json();

    // Extract text content from all parts
    let textContent = "";
    const candidates = data?.candidates || [];
    for (const candidate of candidates) {
      const cParts = candidate?.content?.parts || [];
      for (const part of cParts) {
        if (part.text) textContent += part.text;
      }
    }
    if (!textContent) textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Extract JSON from response
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Could not parse Gemini response:", textContent);
      return res.status(502).json({ success: false, error: "Failed to parse AI response" });
    }

    const attrs = JSON.parse(jsonMatch[0]);

    // Check if the image is a valid garment
    if (attrs.is_garment === false) {
      return res.status(200).json({
        success: false,
        is_garment: false,
        rejection_reason: "Please upload valid garment image, ensure the photo is captured in a well-lit condition.",
      });
    }

    // Validate and normalize category
    const validCategories = ["Tops", "Bottoms", "Dresses", "Outerwear", "Activewear", "Footwear", "Accessories"];
    const categoryMap: Record<string, string> = {
      tops: "Tops", bottoms: "Bottoms", dresses: "Dresses", outerwear: "Outerwear",
      activewear: "Activewear", footwear: "Footwear", shoes: "Footwear", accessories: "Accessories",
    };
    if (!validCategories.includes(attrs.category)) {
      attrs.category = categoryMap[attrs.category?.toLowerCase()] || "Tops";
    }

    // Validate and normalize color
    const validColors = ["Black", "White", "Navy", "Blue", "Red", "Green", "Beige", "Grey", "Pink", "Brown"];
    const colorMap: Record<string, string> = {
      black: "Black", white: "White", navy: "Navy", blue: "Blue", red: "Red",
      green: "Green", beige: "Beige", grey: "Grey", gray: "Grey", pink: "Pink", brown: "Brown",
    };
    if (!validColors.includes(attrs.color)) {
      attrs.color = colorMap[attrs.color?.toLowerCase()] || "";
    }

    // Normalize gender
    if (!["men", "women", "unisex"].includes(attrs.gender)) attrs.gender = "unisex";
    if (!Array.isArray(attrs.tags)) attrs.tags = [];

    // Remove brand — this should be user-provided only
    delete attrs.brand;

    // --- Process enhancement result (already completed in parallel) ---
    let enhancedImage: { mimeType: string; base64: string } | null = null;
    let enhanceDebug = "";
    try {
      if (enhancementResult.status === "fulfilled") {
        const enhanceRes = enhancementResult.value;
        if (enhanceRes.ok) {
          const enhanceData = await enhanceRes.json();
          const eCandidates = enhanceData?.candidates || [];
          for (const candidate of eCandidates) {
            const eParts = candidate?.content?.parts || [];
            for (const part of eParts) {
              if (part.inlineData) {
                enhancedImage = { mimeType: part.inlineData.mimeType, base64: part.inlineData.data };
                break;
              }
            }
            if (enhancedImage) break;
          }
        } else {
          const errBody = await enhanceRes.text().catch(() => "");
          console.error("Image enhancement API error:", enhanceRes.status, errBody);
          enhanceDebug = "HTTP " + enhanceRes.status + ": " + errBody.substring(0, 300);
        }
      } else {
        enhanceDebug = "Enhancement rejected: " + String(enhancementResult.reason).substring(0, 200);
      }
    } catch (enhErr: any) {
      console.warn("Image enhancement failed:", enhErr);
      enhanceDebug = "Exception: " + (enhErr.message || String(enhErr)).substring(0, 200);
    }

    return res.status(200).json({
      success: true,
      attributes: attrs,
      ...(enhancedImage ? { enhancedImage } : {}),
      _enhanceDebug: enhanceDebug || (enhancedImage ? "ok" : "no_image_in_response"),
    });
  } catch (err: any) {
    console.error("process-clothing error:", err);
    return res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
}
