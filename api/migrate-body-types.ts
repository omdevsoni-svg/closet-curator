import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";

/* ------------------------------------------------------------------ */
/* Supabase client (server-side, uses service role key to bypass RLS) */
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

async function supabaseQuery(
  url: string,
  key: string,
  path: string,
  options: RequestInit = {},
  userToken?: string
) {
  const res = await fetch(`${url}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: userToken ? `Bearer ${userToken}` : `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: options.method === "PATCH" ? "return=minimal" : "return=representation",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${options.method || "GET"} ${path} failed: ${res.status} ${text}`);
  }
  if (options.method === "PATCH") return null;
  return res.json();
}

/* ------------------------------------------------------------------ */
/* GCP Service Account Auth (same as detect-body-type.ts)             */
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
/* Body analysis prompt (same as detect-body-type.ts)                 */
/* ------------------------------------------------------------------ */
const BODY_ANALYSIS_PROMPT = `You are an expert body type analyst and fashion stylist. Analyze this full-body photograph to detect the person's body type and skin tone.

BODY TYPE DETECTION:
Carefully examine the person's body proportions â shoulders, bust/chest, waist, and hips â to determine their body type:
- "rectangle": Shoulders, waist, and hips are roughly the same width.
- "hourglass": Shoulders and hips equal, with a clearly defined narrower waist.
- "inverted_triangle": Shoulders noticeably wider than the hips.
- "pear": Hips wider than the shoulders.

SKIN TONE DETECTION:
- "Light" | "Fair" | "Medium" | "Olive" | "Tan" | "Dark" | "Deep"

Return ONLY a raw JSON object:
{
  "body_type": "rectangle" | "hourglass" | "inverted_triangle" | "pear",
  "skin_tone": "Light" | "Fair" | "Medium" | "Olive" | "Tan" | "Dark" | "Deep",
  "confidence": "high" | "medium" | "low"
}
No markdown, no code fences, no explanation.`;

/* ------------------------------------------------------------------ */
/* Fetch image and convert to base64                                  */
/* ------------------------------------------------------------------ */
async function imageUrlToBase64(imageUrl: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { base64: buffer.toString("base64"), mimeType: contentType };
}

/* ------------------------------------------------------------------ */
/* Analyze one profile image via Gemini                               */
/* ------------------------------------------------------------------ */
async function analyzeBodyImage(
  imageUrl: string,
  accessToken: string
): Promise<{ body_type: string; skin_tone: string; confidence: string } | null> {
  try {
    const { base64, mimeType } = await imageUrlToBase64(imageUrl);

    const project = "fynd-jio-impetus-non-prod";
    const region = "us-central1";

    const geminiRes = await fetch(
      `https://${region}-aiplatform.googleapis.com/v1/projects/${project}/locations/${region}/publishers/google/models/gemini-2.0-flash:generateContent`,
      {
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
                { inlineData: { mimeType, data: base64 } },
                { text: BODY_ANALYSIS_PROMPT },
              ],
            },
          ],
          generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
        }),
      }
    );

    if (!geminiRes.ok) {
      console.error(`Gemini error for image: ${geminiRes.status}`);
      return null;
    }

    const data = await geminiRes.json();
    let textContent = "";
    for (const c of data?.candidates || []) {
      for (const p of c?.content?.parts || []) {
        if (p.text) textContent += p.text;
      }
    }

    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const result = JSON.parse(jsonMatch[0]);
    if (result.error) return null;

    const validBodyTypes = ["rectangle", "hourglass", "inverted_triangle", "pear"];
    const validSkinTones = ["Light", "Fair", "Medium", "Olive", "Tan", "Dark", "Deep"];

    return {
      body_type: validBodyTypes.includes(result.body_type) ? result.body_type : "rectangle",
      skin_tone: validSkinTones.includes(result.skin_tone) ? result.skin_tone : "Medium",
      confidence: result.confidence || "medium",
    };
  } catch (err) {
    console.error("analyzeBodyImage error:", err);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Vercel Serverless Handler                                          */
/* ------------------------------------------------------------------ */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
  }

  try {
    // 1. Get GCP access token
    const saKeyJson = process.env.GCP_SERVICE_ACCOUNT_KEY;
    if (!saKeyJson) {
      return res.status(500).json({ success: false, error: "Missing GCP credentials" });
    }
    const saKey: ServiceAccountKey = JSON.parse(saKeyJson);
    const accessToken = await getAccessToken(saKey);

    // 2. Get Supabase config
    const { url: sbUrl, key: sbKey } = getSupabaseConfig();

    // 3. Extract user token from Authorization header (to bypass RLS with user session)
    const authHeader = req.headers.authorization || "";
    const userToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    // 4. Fetch all profiles that have a body_image_url
    const profiles = await supabaseQuery(
      sbUrl,
      sbKey,
      "/profiles?body_image_url=not.is.null&select=id,body_image_url,body_type,skin_tone",
      {},
      userToken
    );

    if (!profiles || profiles.length === 0) {
      return res.status(200).json({ success: true, message: "No profiles with body photos found", updated: 0 });
    }

    // 4. Process each profile
    const results: Array<{ id: string; status: string; body_type?: string; skin_tone?: string }> = [];

    for (const profile of profiles) {
      try {
        console.log(`Processing profile ${profile.id}...`);
        const analysis = await analyzeBodyImage(profile.body_image_url, accessToken);

        if (analysis) {
          // Update profile in Supabase
          await supabaseQuery(sbUrl, sbKey, `/profiles?id=eq.${profile.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              body_type: analysis.body_type,
              skin_tone: analysis.skin_tone,
            }),
          }, userToken);

          results.push({
            id: profile.id,
            status: "updated",
            body_type: analysis.body_type,
            skin_tone: analysis.skin_tone,
          });
        } else {
          results.push({ id: profile.id, status: "skipped - analysis failed" });
        }
      } catch (profileErr: any) {
        console.error(`Error processing profile ${profile.id}:`, profileErr);
        results.push({ id: profile.id, status: `error: ${profileErr.message}` });
      }
    }

    const updated = results.filter((r) => r.status === "updated").length;
    return res.status(200).json({
      success: true,
      total: profiles.length,
      updated,
      skipped: profiles.length - updated,
      results,
    });
  } catch (err: any) {
    console.error("migrate-body-types error:", err);
    return res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
}
