import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";

/* ------------------------------------------------------------------ */
/*  GCP Service Account Auth: JWT â Access Token                       */
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
/*  v22 Virtual Try-On â Imagen 3 VTO + Garment Fidelity Optimization            */
/*                                                                      */
/*  v22 changes (garment quality fix):                                             */
/*  - Intermediate steps: baseSteps=75, JPEG q95 (was 50/q90)    */
/*    â preserves garment details/prints through sequential chain                           */
/*  - Final step: baseSteps=100, PNG, Imagen 4.0 Upscale 2x        */
/*    â max quality where it matters (the result users actually see)    */
/*  - Single-garment mode: always full quality + upscale                */
/*                                                                      */
/*  Uses the dedicated Imagen 3 VTO model which:                        */
/*  - Takes a person image + ONE product image per call                 */
/*  - Automatically handles garment placement (no text prompts needed)  */
/*  - Preserves face identity much better than generative models        */
/*  - Sequential chaining: previous result â personImage for next step  */
/*                                                                      */
/*  Modes:                                                              */
/*  1. "single" â one garment: person + garment â result               */
/*  2. "sequential-step" â chained: previous result becomes person      */
/*     image for next call                                              */
/* ------------------------------------------------------------------ */

const PROJECT = "fynd-jio-impetus-non-prod";
const REGION = "us-central1";
const MODEL = "virtual-try-on-001";
const VTO_URL = `https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${REGION}/publishers/google/models/${MODEL}:predict`;

/* Imagen upscale model for post-processing */
const UPSCALE_MODEL = "imagen-4.0-upscale-preview";
const UPSCALE_URL = `https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${REGION}/publishers/google/models/${UPSCALE_MODEL}:predict`;

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
      isFinalStep = true,          // v17: true for single mode & last sequential step
    } = req.body;

  if (!bodyImageBase64 && !previousResultBase64) { // v28: allow empty body when chaining
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
    // v22: Improved quality tiering â full quality only on final step
    const useFinalQuality = isFinalStep || mode === "single";
    const baseSteps = useFinalQuality ? 100 : 75;
    const outputMime = useFinalQuality ? "image/png" : "image/jpeg";

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
        baseSteps,
        personGeneration: "allow_adult",
        safetySetting: "block_medium_and_above",
        outputOptions: {
          mimeType: outputMime,
          ...(outputMime === "image/jpeg" ? { compressionQuality: 95 } : {}),
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

    // --- Optional: Upscale the result for higher resolution ---
    // v17: Only upscale on final step (single mode or last sequential step)
    const shouldUpscale = req.body.upscale !== false && useFinalQuality;
    if (shouldUpscale && images.length > 0) {
      try {
        const upscaleBody = {
          instances: [
            {
              prompt: "Upscale the image",
              image: { bytesBase64Encoded: images[0].base64 },
            },
          ],
          parameters: {
            sampleCount: 1,
            mode: "upscale",
            upscaleConfig: { upscaleFactor: "x2" },
            outputOptions: {
              mimeType: "image/png",
            },
          },
        };

        const upscaleRes = await fetch(UPSCALE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(upscaleBody),
        });

        if (upscaleRes.ok) {
          const upscaleData = await upscaleRes.json();
          const upscaledPredictions = upscaleData?.predictions || [];
          if (upscaledPredictions.length > 0 && upscaledPredictions[0].bytesBase64Encoded) {
            // Replace with upscaled version
            images[0] = {
              mimeType: upscaledPredictions[0].mimeType || "image/png",
              base64: upscaledPredictions[0].bytesBase64Encoded,
            };
            console.log("Image upscaled successfully via Imagen upscale model");
          }
        } else {
          // Upscale failed â proceed with un-upscaled image (still better with baseSteps=75 + PNG)
          console.warn("Upscale step failed:", upscaleRes.status, await upscaleRes.text().catch(() => ""));
        }
      } catch (upscaleErr) {
        console.warn("Upscale step error (non-fatal):", upscaleErr);
      }
    }

    // --- v20: Gemini Face Refinement DISABLED ---
    // After testing v18 and v19, the Gemini face refinement step consistently
    // produces a different person's face rather than faithfully restoring the
    // original. The raw Imagen VTO + Imagen upscale output preserves identity
    // much better. Keeping the code commented out for future reference.
    const shouldRefineFace = false; // was: useFinalQuality && images.length > 0 && bodyImageBase64;
    if (shouldRefineFace) {
      try {
        const faceRefineModel = "gemini-2.5-flash-image";
        const faceRefineUrl = `https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${REGION}/publishers/google/models/${faceRefineModel}:generateContent`;

        const faceRefinePrompt = `IMAGE 1 is the REFERENCE â the person's REAL face. Study it carefully: the exact warm skin tone, beard texture, eye shape, expression, and facial structure.

IMAGE 2 is a virtual try-on result. The CLOTHES, POSE, and BACKGROUND in Image 2 are perfect and must NOT change. But the FACE in Image 2 has been distorted by AI.

TASK: Replace ONLY the face+neck area in Image 2 with the person's real face from Image 1.

MANDATORY:
- Match the EXACT warm skin tone from Image 1 â do NOT make it paler or cooler
- Copy the beard/facial hair with sharp, crisp edges exactly as in Image 1
- Preserve the exact eye shape, pupil position, and natural expression from Image 1
- Keep the face width and jawline shape identical to Image 1
- Do NOT alter clothing, hands, body, pose, or background from Image 2
- Blend the face seamlessly at the hairline and neck boundary
- Output the FULL image (not cropped)`;

        const faceRefineRes = await fetch(faceRefineUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [
              // v19: Send original FIRST so Gemini sees the ground truth reference first
              { inlineData: { mimeType: "image/jpeg", data: bodyImageBase64 } },
              { inlineData: { mimeType: images[0].mimeType || "image/png", data: images[0].base64 } },
              { text: faceRefinePrompt },
            ]}],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 8192,
              responseModalities: ["IMAGE"],
            },
          }),
        });

        if (faceRefineRes.ok) {
          const faceRefineData = await faceRefineRes.json();
          const frCandidates = faceRefineData?.candidates || [];
          for (const candidate of frCandidates) {
            const frParts = candidate?.content?.parts || [];
            for (const part of frParts) {
              if (part.inlineData) {
                images[0] = {
                  mimeType: part.inlineData.mimeType || "image/png",
                  base64: part.inlineData.data,
                };
                console.log("v19 face refinement applied successfully via Gemini");
                break;
              }
            }
            if (frCandidates.length > 0) break;
          }
        } else {
          const errBody = await faceRefineRes.text().catch(() => "");
          console.warn("Face refinement API error (non-fatal):", faceRefineRes.status, errBody.substring(0, 300));
        }
      } catch (faceErr) {
        console.warn("Face refinement error (non-fatal):", faceErr);
      }
    }

    return res.status(200).json({ success: true, images });
  } catch (err: any) {
    console.error("virtual-tryon error:", err);
    return res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
}
