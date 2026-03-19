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
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.access_token;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ClosetItem {
  id: string;
  name: string;
  category: string;
  color: string;
  tags: string[];
  material?: string;
  gender: string;
  image_url: string;
}

interface ProfileInfo {
  body_type?: string;
  skin_tone?: string;
  model_gender?: string;
}

interface WeatherInfo {
  temp: number;
  condition: string;
  humidity: number;
  windSpeed: number;
}

/* ------------------------------------------------------------------ */
/*  Build the Gemini prompt                                            */
/* ------------------------------------------------------------------ */

function buildPrompt(
  occasion: string,
  items: ClosetItem[],
  profile?: ProfileInfo,
  weather?: WeatherInfo
): string {
  const itemList = items
    .map(
      (item, i) =>
        `${i + 1}. [ID: ${item.id}] "${item.name}" — Category: ${item.category}, Color: ${item.color}, Material: ${item.material || "unknown"}, Tags: [${item.tags.join(", ")}], Gender: ${item.gender}`
    )
    .join("\n");

  let personalization = "";
  if (profile) {
    const parts: string[] = [];
    if (profile.body_type) parts.push(`Body type: ${profile.body_type}`);
    if (profile.skin_tone) parts.push(`Skin tone: ${profile.skin_tone}`);
    if (profile.model_gender) parts.push(`Gender preference: ${profile.model_gender}`);
    if (parts.length > 0) {
      personalization = `\n\nUser profile:\n${parts.join("\n")}
Consider these when making recommendations — suggest items that complement the user's body type, flatter their skin tone, and match their gender preference.`;
    }
  }

  let weatherContext = "";
  if (weather) {
    weatherContext = `\n\nCurrent weather: ${weather.temp}°C, ${weather.condition}, Humidity: ${weather.humidity}%, Wind: ${weather.windSpeed} km/h.
Factor weather into your picks — suggest weather-appropriate fabrics, layers, and styles.`;
  }

  return `You are an expert fashion stylist AI. A user wants outfit recommendations for: "${occasion}".

Here are ALL the clothing items in their closet:
${itemList}
${personalization}${weatherContext}

Your task:
1. Pick 3-5 items from the closet that create a cohesive, stylish outfit for the occasion "${occasion}".
2. ONLY use items from the list above — reference them by their exact ID.
3. Try to pick items from DIFFERENT categories (e.g. a top + bottom + outerwear + footwear) to form a complete outfit.
4. If the closet doesn't have enough variety, pick the best available items and note what's missing.
5. Provide a concise styling tip specific to this outfit combination.
6. Explain why each item was chosen (2-3 words per item).

Return ONLY a valid JSON object in this exact format (no markdown, no code fences):
{
  "item_ids": ["id1", "id2", "id3"],
  "tip": "A specific styling tip for this outfit combination",
  "reasoning": [
    {"id": "id1", "reason": "Why this item was chosen"},
    {"id": "id2", "reason": "Why this item was chosen"},
    {"id": "id3", "reason": "Why this item was chosen"}
  ],
  "missing": "Optional: what key pieces are missing from the closet for this occasion, or null if the outfit is complete"
}`;
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
    const { occasion, items, profile, weather } = req.body as {
      occasion: string;
      items: ClosetItem[];
      profile?: ProfileInfo;
      weather?: WeatherInfo;
    };

    if (!occasion || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: "occasion and items are required",
      });
    }

    // Parse service account key from env
    const saKeyJson = process.env.GCP_SERVICE_ACCOUNT_KEY;
    if (!saKeyJson) {
      return res.status(500).json({
        success: false,
        error: "Server misconfigured: missing GCP credentials",
      });
    }

    const saKey: ServiceAccountKey = JSON.parse(saKeyJson);
    const accessToken = await getAccessToken(saKey);

    // Call Vertex AI Gemini
    const project = "fynd-jio-impetus-non-prod";
    const region = "us-central1";
    const model = "gemini-2.0-flash";
    const url = `https://${region}-aiplatform.googleapis.com/v1/projects/${project}/locations/${region}/publishers/google/models/${model}:generateContent`;

    const prompt = buildPrompt(occasion, items, profile, weather);

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Vertex AI error:", geminiRes.status, errText);
      return res.status(502).json({
        success: false,
        error: `Vertex AI error: ${geminiRes.status}`,
      });
    }

    const data = await geminiRes.json();

    // Extract text from Gemini response
    const rawText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse JSON from response (strip markdown fences if present)
    const jsonStr = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let parsed: {
      item_ids: string[];
      tip: string;
      reasoning: { id: string; reason: string }[];
      missing?: string | null;
    };

    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse Gemini response:", rawText);
      return res.status(502).json({
        success: false,
        error: "AI returned an invalid response. Please try again.",
      });
    }

    return res.status(200).json({
      success: true,
      item_ids: parsed.item_ids,
      tip: parsed.tip,
      reasoning: parsed.reasoning,
      missing: parsed.missing || null,
    });
  } catch (err: any) {
    console.error("Outfit recommendation error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Internal server error",
    });
  }
}
