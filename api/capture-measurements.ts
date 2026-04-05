import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";

/* ------------------------------------------------------------------ */
/* Body measurements via Vertex AI (Gemini) + GCP Service Account      */
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

/* ---------- GCP Service Account -> OAuth2 Access Token ------------ */

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

function getServiceAccount(): ServiceAccount {
  const raw = process.env.GCP_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GCP_SERVICE_ACCOUNT_KEY env var is missing");
  const sa = JSON.parse(raw);
  if (!sa.client_email || !sa.private_key || !sa.project_id) {
    throw new Error("GCP_SERVICE_ACCOUNT_KEY is missing required fields");
  }
  return sa;
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );

  const signInput = header + "." + payload;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signInput);
  const signature = base64url(sign.sign(sa.private_key));

  const jwt = signInput + "." + signature;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error("OAuth2 token exchange failed: " + errText);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

/* ---------- Measurement Prompt ------------------------------------ */

const MEASURE_PROMPT = `You are a body measurement estimation AI. Analyze this full-body photo and estimate the person's body measurements.

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

/* ---------- Handler ----------------------------------------------- */

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
    if (!userId) return res.status(400).json({ success: false, error: "userId is required" });
    if (!imageBase64) return res.status(400).json({ success: false, error: "imageBase64 is required" });

    const sa = getServiceAccount();
    const sb = getSupabaseConfig();
    const accessToken = await getAccessToken(sa);

    const authHeader = req.headers.authorization || "";
    const userToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    // 1. Call Vertex AI Gemini to analyze body photo
    const project = sa.project_id;
    const region = "us-central1";
    const model = "gemini-2.5-flash";
    const vertexUrl = `https://${region}-aiplatform.googleapis.com/v1/projects/${project}/locations/${region}/publishers/google/models/${model}:generateContent`;

    const geminiRes = await fetch(vertexUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: MEASURE_PROMPT },
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
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Vertex AI error:", geminiRes.status, errText);
      return res.status(502).json({
        success: false,
        error: `Vertex AI returned ${geminiRes.status}`,
        detail: errText,
      });
    }

    const geminiData = await geminiRes.json();
    const textContent =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse JSON from response
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

    // 2. Store measurements in profiles table
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
        body: JSON.stringify({ body_measurements: measurements }),
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

    return res.status(200).json({ success: true, measurements, stored: true });
  } catch (err: any) {
    console.error("capture-measurements error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Internal server error",
    });
  }
}
