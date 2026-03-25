import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";

/* ------------------------------------------------------------------ */
/*  GCP Service Account Auth (shared pattern)                          */
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
/*  Generate matching ethnic garment product image via Gemini          */
/* ------------------------------------------------------------------ */

const PROJECT = "fynd-jio-impetus-non-prod";
const REGION = "us-central1";
const MODEL = "gemini-2.5-flash-image";

interface SuggestionRequest {
  kurtaImageBase64: string;
  kurtaMimeType?: string;
  kurtaName: string;
  kurtaColor: string;
  missingTypes: ("ethnic-bottom" | "ethnic-footwear")[];
}

interface SuggestedItem {
  role: "ethnic-bottom" | "ethnic-footwear";
  name: string;
  imageBase64: string;
  imageMimeType: string;
}

function buildPrompt(
  role: "ethnic-bottom" | "ethnic-footwear",
  kurtaName: string,
  kurtaColor: string
): string {
  if (role === "ethnic-bottom") {
    return `Look at this kurta carefully — its color, fabric texture, embroidery, and overall style.

Generate a SINGLE product photo of a matching ethnic bottomwear piece that would pair perfectly with this ${kurtaColor} ${kurtaName}.

REQUIREMENTS:
- Choose the most appropriate style: churidar, straight-fit pajama, dhoti pants, or palazzo (based on the kurta's formality)
- Color must complement the kurta — coordinate or contrast elegantly
- Show ONLY the garment on a pure white background — ghost mannequin / flat-lay style
- NO person, NO mannequin body, NO accessories
- Realistic fabric texture and stitching detail
- Full-length view showing the complete garment

Output: ONE clean product photograph only.`;
  }

  return `Look at this kurta carefully — its color, fabric texture, embroidery, and overall style.

Generate a SINGLE product photo of matching ethnic footwear that would pair perfectly with this ${kurtaColor} ${kurtaName}.

REQUIREMENTS:
- Choose the most appropriate style: jutti, mojari, kolhapuri sandal, or ethnic loafer (based on the kurta's formality)
- Color must complement the kurta and the overall ethnic outfit
- Show ONLY the footwear on a pure white background — product photography style
- ONE pair of shoes, angled/side view for best detail
- NO person, NO legs, NO accessories
- Realistic leather/fabric texture with traditional embroidery or design details

Output: ONE clean product photograph only.`;
}

function suggestedName(
  role: "ethnic-bottom" | "ethnic-footwear",
  kurtaColor: string
): string {
  if (role === "ethnic-bottom") {
    return `Matching Churidar Pajama (AI Suggested)`;
  }
  return `Matching Ethnic Jutti (AI Suggested)`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    const {
      kurtaImageBase64,
      kurtaMimeType = "image/jpeg",
      kurtaName,
      kurtaColor,
      missingTypes,
    } = req.body as SuggestionRequest;

    if (!kurtaImageBase64 || !missingTypes?.length) {
      return res.status(400).json({ success: false, error: "kurtaImageBase64 and missingTypes are required" });
    }

    const saKeyJson = process.env.GCP_SERVICE_ACCOUNT_KEY;
    if (!saKeyJson) {
      return res.status(500).json({ success: false, error: "Server misconfigured: missing GCP credentials" });
    }

    const saKey: ServiceAccountKey = JSON.parse(saKeyJson);
    const accessToken = await getAccessToken(saKey);

    const url = `https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${REGION}/publishers/google/models/${MODEL}:generateContent`;

    const suggestions: SuggestedItem[] = [];

    // Generate one image per missing type (sequential to avoid rate limits)
    for (const role of missingTypes) {
      const prompt = buildPrompt(role, kurtaName, kurtaColor);

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
                { inlineData: { mimeType: kurtaMimeType, data: kurtaImageBase64 } },
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 8192,
            responseModalities: ["IMAGE"],
          },
        }),
      });

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        console.error(`Gemini error for ${role}:`, geminiRes.status, errText.substring(0, 300));
        continue; // Skip this one, try the next
      }

      const data = await geminiRes.json();
      const candidates = data?.candidates || [];

      let imageFound = false;
      for (const candidate of candidates) {
        const parts = candidate?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData) {
            suggestions.push({
              role,
              name: suggestedName(role, kurtaColor),
              imageBase64: part.inlineData.data,
              imageMimeType: part.inlineData.mimeType || "image/png",
            });
            imageFound = true;
            break;
          }
        }
        if (imageFound) break;
      }

      if (!imageFound) {
        console.warn(`No image generated for ${role}`);
      }
    }

    if (suggestions.length === 0) {
      return res.status(200).json({
        success: false,
        error: "AI could not generate matching garment images. Please try again.",
      });
    }

    return res.status(200).json({ success: true, suggestions });
  } catch (err: any) {
    console.error("suggest-ethnic-pair error:", err);
    return res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
}
