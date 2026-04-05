import type { VercelRequest, VercelResponse } from "@vercel/node";

/* ------------------------------------------------------------------ */
/* Captures body measurements using Gemini Vision + stores in profiles */
/* ------------------------------------------------------------------ */

function getSupabaseConfig() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return { url, key };
}

function getGeminiKey() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (key) return key;

  const gcpJson = process.env.GCP_SERVICE_ACCOUNT_KEY;
  if (gcpJson) {
    try {
      const parsed = JSON.parse(gcpJson);
      if (parsed.api_key) return parsed.api_key;
    } catch { /* not JSON or no api_key field */ }
  }

  throw new Error("Missing Gemini/Google AI API key. Set GEMINI_API_KEY env var.");
}

const GEMINI_PROMPT = `You are a body measurement estimation AI. Analyze this full-body photo and estimate the person's body measurements.

Return ONLY a valid JSON object with these fields (all numeric values in cm, sizes as strings):
{
  "chest": <number in cm>,
  "waist": <number in cm>,
  "hips": <number in cm>,
  "shoulder_width": <number in cm>,
  "inseam": <number in cm or null>,
  "recommended_size": "<XS|S|M|L|XL|XXL>",
  "recommended_trouser": "<26|28|30|32|34|36|38|40>",
  "confidence": "<low|medium|high>"
}

Use visual cues like body proportions, build, and clothing fit to make reasonable estimates. If you cannot determine a measurement, use null. Always provide recommended_size and recommended_trouser as your best estimate.

Return ONLY the JSON object, no explanation or markdown.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Use POST" });
  }

  try {
    const { userId, imageBase64 } = req.body || {};

    if (!userId) {
      return res.status(400).json({ success: false, error: "userId is required" });
    }
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: "imageBase64 is required" });
    }

    const geminiKey = getGeminiKey();
    const sb = getSupabaseConfig();

    const authHeader = req.headers.authorization || "";
    const userToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    // 1. Call Gemini Vision API to analyze body photo
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: GEMINI_PROMPT },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 512,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error:", geminiRes.status, errText);
      return res.status(502).json({
        success: false,
        error: `Gemini API returned ${geminiRes.status}`,
        detail: errText,
      });
    }

    const geminiData = await geminiRes.json();
    const textContent =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse JSON from Gemini response (strip markdown fences if present)
    let measurements = null;
    try {
      const jsonStr = textContent
        .replace(/\`\`\`json\s*/g, "")
        .replace(/\`\`\`\s*/g, "")
        .trim();
      measurements = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("Failed to parse Gemini response:", textContent);
      return res.status(200).json({
        success: false,
        error: "Could not parse measurements from AI response",
        raw: textContent,
      });
    }

    if (!measurements) {
      return res.status(200).json({
        success: true,
        measurements: null,
        message: "Gemini completed but no measurements returned",
      });
    }

    // 2. Store measurements in the profiles table
    const patchRes = await fetch(
      `${sb.url}/rest/v1/profiles?id=eq.${userId}`,
      {
        method: "PATCH",
        headers: {
          apikey: sb.key,
          Authorization: userToken ? `Bearer ${userToken}` : `Bearer ${sb.key}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          body_measurements: measurements,
        }),
      }
    );

    if (!patchRes.ok) {
      console.error("Supabase PATCH error:", patchRes.status);
      return res.status(200).json({
        success: true,
        measurements,
        stored: false,
        message: "Measurements captured but storage failed",
      });
    }

    return res.status(200).json({
      success: true,
      measurements,
      stored: true,
    });
  } catch (err) {
    console.error("capture-measurements error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Internal server error",
    });
  }
}
