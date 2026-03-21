import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";

/* ------------------------------------------------------------------ */
/*  GCP Service Account Auth: JWT → Access Token                      */
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
    throw new Error(
      `Token exchange failed: ${res.status} ${await res.text()}`
    );
  }
  const data = await res.json();
  return data.access_token;
}

/* ------------------------------------------------------------------ */
/*  Image Editing Prompts (NOT generation — editing preserves identity)*/
/* ------------------------------------------------------------------ */

const EDIT_PROMPT_SINGLE = `You are a photo editor. You will receive a photo of a real person followed by a photo of a clothing item.

YOUR TASK: Edit the person's photo to replace ONLY their clothing with the provided garment.

CRITICAL RULES:
1. The output must be an EDITED VERSION of the input photo — NOT a new photo of a different person.
2. The person's face MUST remain COMPLETELY UNCHANGED — same face, same expression, same skin tone, same features.
3. The person's body shape, posture, and proportions MUST remain EXACTLY the same.
4. The person's hair MUST remain EXACTLY the same — color, style, length.
5. The background should remain similar or be a clean neutral background.
6. ONLY the clothing changes. Everything else stays identical to the input photo.

Think of this as Photoshop — you are cutting out the old clothes and pasting the new garment onto the SAME person in the SAME photo. The face and body are LOCKED and cannot be modified.

OUTPUT: The same person from the input photo, with only their clothing changed to the provided garment.`;

function buildEditPromptMulti(count: number): string {
  return `You are a photo editor. You will receive a photo of a real person followed by ${count} photos of clothing items.

YOUR TASK: Edit the person's photo to replace ONLY their clothing with ALL ${count} provided garments worn together as one outfit.

CRITICAL RULES:
1. The output must be an EDITED VERSION of the input photo — NOT a new photo of a different person.
2. The person's face MUST remain COMPLETELY UNCHANGED — same face, same expression, same skin tone, same features.
3. The person's body shape, posture, and proportions MUST remain EXACTLY the same.
4. The person's hair MUST remain EXACTLY the same — color, style, length.
5. The background should remain similar or be a clean neutral background.
6. ONLY the clothing changes. Everything else stays identical to the input photo.
7. Combine all ${count} garments into one cohesive outfit on the person.

Think of this as Photoshop — you are cutting out the old clothes and pasting the new garments onto the SAME person in the SAME photo. The face and body are LOCKED and cannot be modified.

OUTPUT: The same person from the input photo, with only their clothing changed to all ${count} garments combined as one outfit.`;
}

/* ------------------------------------------------------------------ */
/*  Vercel Serverless Handler                                         */
/* ------------------------------------------------------------------ */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    const {
      faceImageBase64,
      bodyImageBase64,
      productImageBase64,
      productImages,
      faceMimeType = "image/jpeg",
      bodyMimeType = "image/jpeg",
      productMimeType = "image/jpeg",
    } = req.body;

    if (!bodyImageBase64) {
      return res
        .status(400)
        .json({ success: false, error: "bodyImageBase64 is required" });
    }

    // Support both single product image (backward compat) and multiple product images
    const garments: { base64: string; mimeType: string; label?: string }[] =
      [];

    if (
      productImages &&
      Array.isArray(productImages) &&
      productImages.length > 0
    ) {
      for (const img of productImages) {
        garments.push({
          base64: img.base64,
          mimeType: img.mimeType || "image/jpeg",
          label: img.label,
        });
      }
    } else if (productImageBase64) {
      garments.push({
        base64: productImageBase64,
        mimeType: productMimeType,
      });
    }

    if (garments.length === 0) {
      return res
        .status(400)
        .json({
          success: false,
          error: "At least one product image is required",
        });
    }

    // Parse service account key from env
    const saKeyJson = process.env.GCP_SERVICE_ACCOUNT_KEY;
    if (!saKeyJson) {
      return res
        .status(500)
        .json({
          success: false,
          error: "Server misconfigured: missing GCP credentials",
        });
    }
    const saKey: ServiceAccountKey = JSON.parse(saKeyJson);
    const accessToken = await getAccessToken(saKey);

    const project = "fynd-jio-impetus-non-prod";
    const region = "us-central1";
    const model = "gemini-2.5-flash-image";
    const url = `https://${region}-aiplatform.googleapis.com/v1/projects/${project}/locations/${region}/publishers/google/models/${model}:generateContent`;

    // ────────────────────────────────────────────────────────
    // IMAGE EDITING APPROACH (not generation)
    // Key insight: User's photo is the BASE being edited.
    // Face image provides the identity ground truth.
    // We frame this as "edit the photo" not "generate a person".
    // ────────────────────────────────────────────────────────

    const parts: any[] = [];
    const hasFace = !!faceImageBase64;

    // STEP 1: Establish the editing task with the instruction prompt FIRST
    const prompt =
      garments.length > 1
        ? buildEditPromptMulti(garments.length)
        : EDIT_PROMPT_SINGLE;
    parts.push({ text: prompt });

    // STEP 2: The person's photo (THIS IS THE BASE IMAGE TO EDIT)
    parts.push({
      text: "Here is the person's photo. This is the photo you must EDIT. The person in your output MUST be this EXACT same person — same face, same skin, same hair, same body. You are only changing their clothes:",
    });
    parts.push({
      inlineData: { mimeType: bodyMimeType, data: bodyImageBase64 },
    });

    // STEP 3: Face close-up for identity verification
    if (hasFace) {
      parts.push({
        text: "Here is a close-up of this person's face for reference. Your output face MUST match this exactly — same skin tone, same facial features, same facial hair, same everything. Use this to verify your output:",
      });
      parts.push({
        inlineData: { mimeType: faceMimeType, data: faceImageBase64 },
      });
    }

    // STEP 4: Garment image(s) — what to dress them in
    for (let i = 0; i < garments.length; i++) {
      const g = garments[i];
      const label = g.label || `Garment ${i + 1}`;
      parts.push({
        text: `Here is the clothing item to put on them: ${label}. Replace their current clothing with this:`,
      });
      parts.push({
        inlineData: { mimeType: g.mimeType, data: g.base64 },
      });
    }

    // STEP 5: Final instruction — reinforce editing, not generation
    parts.push({
      text: "Now edit the person's photo. Change ONLY their clothing to the garment(s) shown above. The person's face, skin tone, hair, and body must remain IDENTICAL to the original photo. Output the edited photo:",
    });

    // STEP 6: Send the person's photo AGAIN as the last image (recency bias)
    parts.push({
      inlineData: { mimeType: bodyMimeType, data: bodyImageBase64 },
    });

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 8192,
          responseModalities: ["TEXT", "IMAGE"],
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Vertex AI error:", geminiRes.status, errText);
      return res.status(502).json({
        success: false,
        error: `Vertex AI error: ${geminiRes.status}`,
        details: errText.substring(0, 500),
      });
    }

    const data = await geminiRes.json();
    const candidates = data?.candidates || [];
    const images: { mimeType: string; base64: string }[] = [];

    // Extract generated images from response
    for (const candidate of candidates) {
      const cParts = candidate?.content?.parts || [];
      for (const part of cParts) {
        if (part.inlineData) {
          images.push({
            mimeType: part.inlineData.mimeType,
            base64: part.inlineData.data,
          });
        }
      }
    }

    if (images.length === 0) {
      const textResponse =
        candidates[0]?.content?.parts?.find((p: any) => p.text)?.text || "";
      console.error("No images in response. Text:", textResponse);
      return res.status(200).json({
        success: false,
        error:
          "AI could not generate a try-on image. " +
          (textResponse
            ? textResponse.substring(0, 200)
            : "Try a different photo or clothing item."),
      });
    }

    return res.status(200).json({ success: true, images });
  } catch (err: any) {
    console.error("virtual-tryon error:", err);
    return res
      .status(500)
      .json({ success: false, error: err.message || "Internal server error" });
  }
}
