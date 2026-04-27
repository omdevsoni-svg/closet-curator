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

If the image DOES contain valid clothing/garment items, COUNT how many DISTINCT garment pieces are visible. A "distinct piece" means a separate wearable item — e.g. a shirt + jeans = 2 items, a dress = 1 item, a top + skirt + jacket = 3 items. Shoes count as 1 item (the pair). Accessories (belt, watch, bag) each count as 1 item.

If there is exactly ONE garment item, return a JSON object with these fields:
- is_garment: true
- item_count: 1
- name: a short descriptive name (e.g. "Blue Denim Jacket")
- category: EXACTLY one of: "Tops", "Bottoms", "Dresses", "Outerwear", "Activewear", "Footwear", "Accessories"
- color: EXACTLY one of: "Black", "White", "Navy", "Blue", "Red", "Green", "Beige", "Grey", "Pink", "Brown", "Cream", "Olive", "Burgundy", "Teal", "Coral", "Lavender", "Purple", "Orange", "Yellow", "Tan", "Charcoal", "Khaki", "Gold", "Maroon", "Mustard", "Rust", "Turquoise", "Ivory", "Multicolor"
- material: fabric type (e.g. "Cotton", "Polyester", "Denim", "Silk", "Wool", "Leather")
- tags: array of 2-4 descriptive tags (e.g. ["casual", "summer", "lightweight"])
- gender: one of: men, women, unisex
- rotation_needed: CLOCKWISE rotation in degrees (0, 90, 180, or 270) to make it upright

If there are MULTIPLE garment items (2 or more), return a JSON object with:
- is_garment: true
- item_count: <number of distinct items>
- items: an ARRAY where each element has: name, category, color, material, tags, gender, rotation_needed (same rules as above)

Rotation rules: for tops/shirts/outerwear the collar/neckline is at the top; for bottoms/pants the waistband is at the top; for footwear/shoes the opening is at the top and sole at the bottom; for dresses the neckline is at the top. If ALREADY upright, use 0.

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

    const buildEnhancePrompt = (targetItem?: string) => {
      const itemDesc = targetItem || "the clothing item";
      return `Extract ONLY ${targetItem ? `the ${targetItem}` : "the COMPLETE clothing item"} from this image. Remove the person/model/mannequin body COMPLETELY - show ONLY the garment as a ghost mannequin / flat lay product photo.

WHAT TO REMOVE:
- The human model's body, face, hands, feet, skin - ALL of it
- Any physical mannequin body (beige/tan plastic torso, neck, hands, stand)
- Background, props, accessories that aren't part of ${itemDesc}
${targetItem ? `- ALL other clothing items that are NOT the ${targetItem} — isolate ONLY this one piece` : ""}

WHAT TO KEEP:
- ONLY the fabric of ${itemDesc}
- Every garment detail: exact color, pattern, fabric texture, buttons, embroidery, logos, collar, sleeves, stitching
- For FOOTWEAR/SHOES: keep the COMPLETE PAIR (both shoes), do NOT crop to a single shoe

ORIENTATION RULES (VERY IMPORTANT):
- The output image MUST have CORRECT upright orientation:
  - For tops/shirts/outerwear: collar/neckline at TOP, hem at BOTTOM
  - For bottoms/pants: waistband at TOP, leg openings at BOTTOM
  - For footwear/shoes: shoe openings at TOP, soles at BOTTOM, toes pointing DOWN
  - For dresses: neckline at TOP, hem at BOTTOM
- If the input image shows the item sideways or at an angle, ROTATE it to the correct upright position in your output

Output: One clean product photo of ONLY ${itemDesc} on a white background in CORRECT upright orientation. NO person or mannequin body visible.`;
    };

    // For the initial parallel call, use a generic enhance prompt (will be refined for multi-item)
    const enhancementPromise = fetch(
      `https://${region}-aiplatform.googleapis.com/v1/projects/${project}/locations/${region}/publishers/google/models/gemini-2.5-flash-image:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: buildEnhancePrompt() },
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

    const parsed = JSON.parse(jsonMatch[0]);

    // Check if the image is a valid garment
    if (parsed.is_garment === false) {
      return res.status(200).json({
        success: false,
        is_garment: false,
        rejection_reason: "Please upload valid garment image, ensure the photo is captured in a well-lit condition.",
      });
    }

    // --- Normalization helpers ---
    const validCategories = ["Tops", "Bottoms", "Dresses", "Outerwear", "Activewear", "Footwear", "Accessories"];
    const categoryMap: Record<string, string> = {
      tops: "Tops", bottoms: "Bottoms", dresses: "Dresses", outerwear: "Outerwear",
      activewear: "Activewear", footwear: "Footwear", shoes: "Footwear", accessories: "Accessories",
    };
    const validColors = ["Black", "White", "Navy", "Blue", "Red", "Green", "Beige", "Grey", "Pink", "Brown", "Cream", "Olive", "Burgundy", "Teal", "Coral", "Lavender", "Purple", "Orange", "Yellow", "Tan", "Charcoal", "Khaki", "Gold", "Maroon", "Mustard", "Rust", "Turquoise", "Ivory", "Multicolor"];
    const colorMap: Record<string, string> = {
      black: "Black", white: "White", navy: "Navy", blue: "Blue", red: "Red",
      green: "Green", beige: "Beige", grey: "Grey", gray: "Grey", pink: "Pink",
      brown: "Brown", cream: "Cream", olive: "Olive", burgundy: "Burgundy",
      teal: "Teal", coral: "Coral", lavender: "Lavender", purple: "Purple",
      orange: "Orange", yellow: "Yellow", tan: "Tan", charcoal: "Charcoal",
      khaki: "Khaki", gold: "Gold", maroon: "Maroon", mustard: "Mustard",
      rust: "Rust", turquoise: "Turquoise", ivory: "Ivory", multicolor: "Multicolor",
      "dark blue": "Navy", "light blue": "Blue", "sky blue": "Blue",
      "dark green": "Green", "forest green": "Green", "light green": "Green",
      "dark grey": "Charcoal", "dark gray": "Charcoal", "light grey": "Grey",
      "light gray": "Grey", "off-white": "Cream", "off white": "Cream",
      "wine": "Burgundy", "wine red": "Burgundy", "dark red": "Burgundy",
      "magenta": "Pink", "hot pink": "Pink", "light pink": "Pink", "rose": "Pink",
      "violet": "Purple", "plum": "Purple", "indigo": "Navy",
      "camel": "Tan", "sand": "Tan", "taupe": "Tan", "nude": "Beige",
      "copper": "Rust", "terracotta": "Rust", "brick": "Rust",
      "silver": "Grey", "golden": "Gold", "bronze": "Brown",
      "mint": "Green", "sage": "Olive", "emerald": "Green", "aqua": "Teal",
      "peach": "Coral", "salmon": "Coral", "fuchsia": "Pink",
      "chocolate": "Brown", "coffee": "Brown", "espresso": "Brown",
      "multi": "Multicolor", "multicolored": "Multicolor", "multi-color": "Multicolor",
      "pattern": "Multicolor", "printed": "Multicolor", "floral": "Multicolor",
    };

    function normalizeAttrs(attrs: any) {
      if (!validCategories.includes(attrs.category)) {
        attrs.category = categoryMap[attrs.category?.toLowerCase()] || "Tops";
      }
      if (!validColors.includes(attrs.color)) {
        attrs.color = colorMap[attrs.color?.toLowerCase()] || (attrs.color ? attrs.color.charAt(0).toUpperCase() + attrs.color.slice(1).toLowerCase() : "");
      }
      if (!["men", "women", "unisex"].includes(attrs.gender)) attrs.gender = "unisex";
      if (!Array.isArray(attrs.tags)) attrs.tags = [];
      delete attrs.brand;
      return attrs;
    }

    // --- Helper to extract enhanced image from Gemini image-gen response ---
    function extractEnhancedImage(enhanceData: any): { mimeType: string; base64: string } | null {
      const eCandidates = enhanceData?.candidates || [];
      for (const candidate of eCandidates) {
        const eParts = candidate?.content?.parts || [];
        for (const part of eParts) {
          if (part.inlineData) {
            return { mimeType: part.inlineData.mimeType, base64: part.inlineData.data };
          }
        }
      }
      return null;
    }

    // --- Determine single vs multi-item ---
    const itemCount = parsed.item_count || 1;
    const isMultiItem = itemCount > 1 && Array.isArray(parsed.items) && parsed.items.length > 1;

    if (!isMultiItem) {
      // SINGLE ITEM path (backward compatible)
      const attrs = normalizeAttrs(parsed);

      // Process enhancement result from parallel call
      let enhancedImage: { mimeType: string; base64: string } | null = null;
      let enhanceDebug = "";
      try {
        if (enhancementResult.status === "fulfilled") {
          const enhanceRes = enhancementResult.value;
          if (enhanceRes.ok) {
            enhancedImage = extractEnhancedImage(await enhanceRes.json());
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
        item_count: 1,
        attributes: attrs,
        ...(enhancedImage ? { enhancedImage } : {}),
        _enhanceDebug: enhanceDebug || (enhancedImage ? "ok" : "no_image_in_response"),
      });
    }

    // MULTI-ITEM path: normalize each item, then run per-item enhancement in parallel
    const normalizedItems = parsed.items.map((item: any) => normalizeAttrs(item));

    // Discard the generic enhancement from the parallel call (it extracted the whole outfit)
    // Run targeted per-item enhancement calls
    const perItemEnhancePromises = normalizedItems.map((item: any) =>
      fetch(
        `https://${region}-aiplatform.googleapis.com/v1/projects/${project}/locations/${region}/publishers/google/models/gemini-2.5-flash-image:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [
              { inlineData: { mimeType, data: imageBase64 } },
              { text: buildEnhancePrompt(`${item.name} (${item.category})`) },
            ]}],
            generationConfig: {
              temperature: 0.5,
              maxOutputTokens: 8192,
              responseModalities: ["TEXT", "IMAGE"],
            },
          }),
        }
      )
    );

    const enhanceResults = await Promise.allSettled(perItemEnhancePromises);

    const itemsWithImages = await Promise.all(
      normalizedItems.map(async (item: any, idx: number) => {
        let enhancedImage: { mimeType: string; base64: string } | null = null;
        let enhanceDebug = "";
        try {
          const result = enhanceResults[idx];
          if (result.status === "fulfilled") {
            const enhanceRes = result.value;
            if (enhanceRes.ok) {
              enhancedImage = extractEnhancedImage(await enhanceRes.json());
            } else {
              const errBody = await enhanceRes.text().catch(() => "");
              enhanceDebug = "HTTP " + enhanceRes.status + ": " + errBody.substring(0, 300);
            }
          } else {
            enhanceDebug = "Enhancement rejected: " + String(result.reason).substring(0, 200);
          }
        } catch (enhErr: any) {
          enhanceDebug = "Exception: " + (enhErr.message || String(enhErr)).substring(0, 200);
        }
        return {
          attributes: item,
          ...(enhancedImage ? { enhancedImage } : {}),
          _enhanceDebug: enhanceDebug || (enhancedImage ? "ok" : "no_image_in_response"),
        };
      })
    );

    return res.status(200).json({
      success: true,
      item_count: normalizedItems.length,
      items: itemsWithImages,
    });
  } catch (err: any) {
    console.error("process-clothing error:", err);
    return res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
}
