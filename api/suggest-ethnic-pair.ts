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
  kurtaColor: string,
  attempt: number = 0
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

  // Footwear prompts — vary slightly by attempt to improve reliability
  const footwearStyles = [
    `Generate a product photo of a pair of traditional Indian jutti/mojari shoes that would match this ${kurtaColor} ${kurtaName}. The juttis should be ornate with embroidery or zari work. Show the pair of shoes on a pure white background in product photography style. Side angle view showing intricate details. Realistic texture. Clean product photo only.`,
    `Create an e-commerce product image of ethnic Indian footwear — a pair of handcrafted kolhapuri chappals or embroidered mojari that complement this ${kurtaColor} ${kurtaName}. Pure white background, studio lighting, angled view showing the pair. No person or legs — just the shoes. High quality product photography.`,
    `Product photography of a pair of elegant Indian ethnic shoes (jutti or mojari) to match this ${kurtaColor} kurta. The shoes should feature traditional embroidery, beadwork, or thread work with colors that coordinate with the kurta. White background, professional e-commerce style photo. Show both shoes arranged neatly.`,
  ];

  return footwearStyles[attempt % footwearStyles.length];
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
    const MAX_RETRIES = 2; // Up to 3 attempts per item (0, 1, 2)

    // Generate one image per missing type with retry logic
    for (const role of missingTypes) {
      let imageFound = false;

      for (let attempt = 0; attempt <= MAX_RETRIES && !imageFound; attempt++) {
        const prompt = buildPrompt(role, kurtaName, kurtaColor, attempt);

        if (attempt > 0) {
          console.log(`Retry ${attempt}/${MAX_RETRIES} for ${role} image generation`);
        }

        try {
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
                temperature: 0.8 + attempt * 0.1, // Slightly increase creativity on retry
                maxOutputTokens: 8192,
                responseModalities: ["IMAGE", "TEXT"],
              },
              safetySettings: [
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
              ],
            }),
          });

          if (!geminiRes.ok) {
            const errText = await geminiRes.text();
            console.error(`Gemini error for ${role} (attempt ${attempt}):`, geminiRes.status, errText.substring(0, 300));
            continue; // Retry
          }

          const data = await geminiRes.json();
          const candidates = data?.candidates || [];

          // Log response shape for debugging
          const finishReason = candidates[0]?.finishReason || "unknown";
          const partTypes = (candidates[0]?.content?.parts || []).map((p: any) =>
            p.inlineData ? `image/${p.inlineData.mimeType}` : p.text ? `text(${p.text.substring(0, 50)})` : "unknown"
          );
          console.log(`${role} attempt ${attempt}: finishReason=${finishReason}, parts=[${partTypes.join(", ")}]`);

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
            console.warn(`No image in response for ${role} (attempt ${attempt}), finishReason=${finishReason}`);
          }
        } catch (err: any) {
          console.error(`Exception generating ${role} (attempt ${attempt}):`, err.message);
        }
      }

      if (!imageFound) {
        console.error(`FAILED: Could not generate image for ${role} after ${MAX_RETRIES + 1} attempts`);
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
