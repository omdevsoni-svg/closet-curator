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
/*  v15 Virtual Try-On — Imagen 3 Virtual Try-On (virtual-try-on-001) */
/*                                                                      */
/*  Uses the dedicated Imagen 3 VTO model which:                        */
/*  - Takes a person image + ONE product image per call                 */
/*  - Automatically handles garment placement (no text prompts needed)  */
/*  - Preserves face identity much better than generative models        */
/*  - Sequential chaining: previous result → personImage for next step  */
/*                                                                      */
/*  Modes:                                                              */
/*  1. "single" — one garment: person + garment → result               */
/*  2. "sequential-step" — chained: previous result becomes person      */
/*     image for next call                                              */
/* ------------------------------------------------------------------ */

const PROJECT = "fynd-jio-impetus-non-prod";
const REGION = "us-central1";
const MODEL = "virtual-try-on-001";
const VTO_URL = `https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${REGION}/publishers/google/models/${MODEL}:predict`;

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
    const {
      bodyImageBase64,
      productImageBase64,
      productImages,
      // Sequential-step fields
      mode = "single",             // "single" | "sequential-step"
      previousResultBase64,        // result from previous step (becomes personImage)
    } = req.body;

    if (!bodyImageBase64) {
      return res.status(400).json({ success: false, error: "bodyImageBase64 is required" });
    }

    // Parse service account key from env
    const saKeyJson = process.env.GCP_SERVICE_ACCOUNT_KEY;
    if (!saKeyJson) {
      return res.status(500).json({ success: false, error: "Server misconfigured: missing GCP credentials" });
    }

    const saKey: ServiceAccountKey = JSON.parse(saKeyJson);
    const accessToken = await getAccessToken(saKey);

    // --- Determine person image and product image ---
    let personImageBase64: string;
    let garmentBase64: string | null = null;

    if (mode === "sequential-step" && previousResultBase64) {
      // For sequential steps 2+: the previous try-on result IS the person image
      personImageBase64 = previousResultBase64;
    } else {
      // First step or single mode: use the original body photo
      personImageBase64 = bodyImageBase64;
    }

    // Get garment image
    if (productImages && Array.isArray(productImages) && productImages.length > 0) {
      garmentBase64 = productImages[0].base64;
    } else if (productImageBase64) {
      garmentBase64 = productImageBase64;
    }

    if (!garmentBase64) {
      return res.status(400).json({ success: false, error: "At least one product image is required" });
    }

    // --- Build Imagen 3 VTO request ---
    const requestBody = {
      instances: [
        {
          personImage: {
            image: { bytesBase64Encoded: personImageBase64 },
          },
          productImages: [
            {
              image: { bytesBase64Encoded: garmentBase64 },
            },
          ],
        },
      ],
      parameters: {
        sampleCount: 1,
        baseSteps: 32,
        personGeneration: "allow_adult",
        safetySetting: "block_medium_and_above",
        outputOptions: {
          mimeType: "image/jpeg",
          compressionQuality: 80,
        },
      },
    };

    const vtoRes = await fetch(VTO_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!vtoRes.ok) {
      const errText = await vtoRes.text();
      console.error("Imagen 3 VTO error:", vtoRes.status, errText);
      return res.status(502).json({
        success: false,
        error: `Imagen 3 VTO error: ${vtoRes.status}`,
        details: errText.substring(0, 500),
      });
    }

    const data = await vtoRes.json();
    const predictions = data?.predictions || [];
    const images: { mimeType: string; base64: string }[] = [];

    for (const prediction of predictions) {
      if (prediction.bytesBase64Encoded) {
        images.push({
          mimeType: prediction.mimeType || "image/jpeg",
          base64: prediction.bytesBase64Encoded,
        });
      }
    }

    if (images.length === 0) {
      console.error("No images in Imagen 3 VTO response:", JSON.stringify(data).substring(0, 500));
      return res.status(200).json({
        success: false,
        error: "AI could not generate a try-on image. Try a different photo or clothing item.",
      });
    }

    return res.status(200).json({ success: true, images });
  } catch (err: any) {
    console.error("virtual-tryon error:", err);
    return res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
}
