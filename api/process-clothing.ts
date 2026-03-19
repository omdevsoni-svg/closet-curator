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
{"is_garment": false, "rejection_reason": "Brief explanation of what was detected instead of a garment, and a tip like: Please upload a clear photo of a clothing item with good lighting against a plain background."}

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

    // Call Vertex AI Gemini
    const project = "fynd-jio-impetus-non-prod";
    const region = "us-central1";
    const model = "gemini-2.0-flash";
    const url = `https://${region}-aiplatform.googleapis.com/v1/projects/${project}/locations/${region}/publishers/google/models/${model}:generateContent`;

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType, data: imageBase64 } },
              { text: CLOTHING_PROMPT },
            ],
          },
        ],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Vertex AI error:", geminiRes.status, errText);
      return res.status(502).json({ success: false, error: `Vertex AI error: ${geminiRes.status}` });
    }

    const data = await geminiRes.json();
    const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

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
        rejection_reason: attrs.rejection_reason || "This doesn't appear to be a clothing item. Please upload a clear photo of a garment with good lighting.",
      });
    }

    // Validate and normalize category (match exact dropdown values)
    const validCategories = ["Tops", "Bottoms", "Dresses", "Outerwear", "Activewear", "Footwear", "Accessories"];
    const categoryMap: Record<string, string> = {
      tops: "Tops", bottoms: "Bottoms", dresses: "Dresses", outerwear: "Outerwear",
      activewear: "Activewear", footwear: "Footwear", shoes: "Footwear", accessories: "Accessories",
    };
    if (!validCategories.includes(attrs.category)) {
      attrs.category = categoryMap[attrs.category?.toLowerCase()] || "Tops";
    }

    // Validate and normalize color (match exact dropdown values)
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

    // Ghost mannequin extraction using gemini-2.5-flash-image
    let enhancedImage = null;
    let enhanceDebug = "";
    try {
      const cat = attrs.category || "garment";
      const enhancePrompt = "Extract the COMPLETE " + cat + " from this image. Remove the person/model/mannequin body COMPLETELY - show ONLY the clothing as a ghost mannequin / flat lay product photo. WHAT TO REMOVE: The human model body, face, hands, feet, skin - ALL of it. Any mannequin body. Background, props. WHAT TO KEEP: ONLY the fabric/clothing itself. Every garment detail: exact color, pattern, fabric texture, buttons, embroidery, logos, collar, sleeves, stitching. Output: One clean product photo on a white background. NO person visible.";

      const enhanceModel = "gemini-2.5-flash-image";
      const enhanceUrl = "https://" + region + "-aiplatform.googleapis.com/v1/projects/" + project + "/locations/" + region + "/publishers/google/models/" + enhanceModel + ":generateContent";

      const enhanceRes = await fetch(enhanceUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + accessToken,
        },
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
      });

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
        if (!enhancedImage) enhanceDebug = "ok_response_but_no_image";
      } else {
        const errBody = await enhanceRes.text().catch(() => "");
        enhanceDebug = "HTTP " + enhanceRes.status + ": " + errBody.substring(0, 300);
      }
    } catch (enhErr) {
      enhanceDebug = "Exception: " + String(enhErr).substring(0, 200);
    }

    return res.status(200).json({
      success: true,
      attributes: attrs,
      ...(enhancedImage ? { enhancedImage } : {}),
      _enhanceDebug: enhanceDebug || (enhancedImage ? "ok" : "unknown"),
    });
  } catch (err: any) {
    console.error("process-clothing error:", err);
    return res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
}
