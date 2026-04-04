import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";

/* ------------------------------------------------------------------ */
/* GCP Service Account Auth                                            */
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
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

/* ------------------------------------------------------------------ */
/* Size Recommendation Prompt                                          */
/* ------------------------------------------------------------------ */
function buildSizePrompt(
  measurements: Record<string, number | string>,
  category: string,
  brand?: string
): string {
  return `You are an expert fashion sizing consultant. Given these body measurements, recommend clothing sizes.

BODY MEASUREMENTS:
${Object.entries(measurements)
  .filter(([_, v]) => v !== null && v !== undefined)
  .map(([k, v]) => `- ${k.replace(/_/g, " ")}: ${v}`)
  .join("\n")}

GARMENT CATEGORY: ${category}
${brand ? `BRAND: ${brand}` : ""}

Based on these measurements, provide size recommendations. Consider that sizing varies by brand and region.

Return ONLY a raw JSON object with this exact structure:
{
  "top_size": "S" | "M" | "L" | "XL" | "XXL",
  "bottom_size": "28" | "30" | "32" | "34" | "36" | "38",
  "dress_size": "XS" | "S" | "M" | "L" | "XL",
  "shirt_size": "S" | "M" | "L" | "XL" | "XXL",
  "eu_size": number,
  "us_size": number,
  "uk_size": number,
  "fit_notes": "Brief 1-sentence note about fit",
  "confidence": "high" | "medium" | "low"
}
No markdown, no code fences, no explanation.`;
}

/* ------------------------------------------------------------------ */
/* Handler                                                              */
/* ------------------------------------------------------------------ */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Use POST" });
  }

  try {
    const { measurements, category, brand } = req.body || {};

    if (!measurements || typeof measurements !== "object") {
      return res.status(400).json({
        success: false,
        error: "measurements object is required",
      });
    }

    // Get GCP access token
    const saKeyJson = process.env.GCP_SERVICE_ACCOUNT_KEY;
    if (!saKeyJson) {
      return res.status(500).json({ success: false, error: "Missing GCP credentials" });
    }
    const saKey: ServiceAccountKey = JSON.parse(saKeyJson);
    const accessToken = await getAccessToken(saKey);

    const project = "fynd-jio-impetus-non-prod";
    const region = "us-central1";
    const prompt = buildSizePrompt(measurements, category || "general", brand);

    const geminiRes = await fetch(
      `https://${region}-aiplatform.googleapis.com/v1/projects/${project}/locations/${region}/publishers/google/models/gemini-2.0-flash:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return res.status(502).json({
        success: false,
        error: `Gemini API error: ${geminiRes.status}`,
      });
    }

    const data = await geminiRes.json();
    let textContent = "";
    for (const c of data?.candidates || []) {
      for (const p of c?.content?.parts || []) {
        if (p.text) textContent += p.text;
      }
    }

    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(502).json({ success: false, error: "Could not parse AI response" });
    }

    const result = JSON.parse(jsonMatch[0]);

    return res.status(200).json({
      success: true,
      sizes: {
        top_size: result.top_size || "M",
        bottom_size: result.bottom_size || "32",
        dress_size: result.dress_size || "M",
        shirt_size: result.shirt_size || "M",
        eu_size: result.eu_size || null,
        us_size: result.us_size || null,
        uk_size: result.uk_size || null,
        fit_notes: result.fit_notes || "",
        confidence: result.confidence || "medium",
      },
    });
  } catch (err: any) {
    console.error("size-recommendation error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Internal server error",
    });
  }
}
