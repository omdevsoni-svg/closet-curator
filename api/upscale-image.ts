import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";

/* ------------------------------------------------------------------ */
/*  v30: Standalone upscale endpoint for deferred VTO upscaling        */
/*                                                                      */
/*  VTO now returns the base result immediately (no upscale wait).      */
/*  Client shows the preview, then calls this endpoint in the           */
/*  background. When done, client swaps in the HD version.              */
/*  Same Imagen 4.0 Upscale 2x — identical output, just async.         */
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

const PROJECT = "fynd-jio-impetus-non-prod";
const REGION = "us-central1";
const UPSCALE_MODEL = "imagen-4.0-upscale-preview";
const UPSCALE_URL = `https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${REGION}/publishers/google/models/${UPSCALE_MODEL}:predict`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: "imageBase64 is required" });
    }

    const saKeyJson = process.env.GCP_SERVICE_ACCOUNT_KEY;
    if (!saKeyJson) {
      return res.status(500).json({ success: false, error: "Server misconfigured: missing GCP credentials" });
    }

    const saKey: ServiceAccountKey = JSON.parse(saKeyJson);
    const accessToken = await getAccessToken(saKey);

    const upscaleBody = {
      instances: [
        {
          prompt: "Upscale the image",
          image: { bytesBase64Encoded: imageBase64 },
        },
      ],
      parameters: {
        sampleCount: 1,
        mode: "upscale",
        upscaleConfig: { upscaleFactor: "x2" },
        outputOptions: { mimeType: "image/png" },
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

    if (!upscaleRes.ok) {
      const errText = await upscaleRes.text();
      console.error("Upscale error:", upscaleRes.status, errText);
      return res.status(502).json({ success: false, error: `Upscale error: ${upscaleRes.status}` });
    }

    const data = await upscaleRes.json();
    const predictions = data?.predictions || [];

    if (predictions.length > 0 && predictions[0].bytesBase64Encoded) {
      return res.status(200).json({
        success: true,
        image: {
          mimeType: predictions[0].mimeType || "image/png",
          base64: predictions[0].bytesBase64Encoded,
        },
      });
    }

    return res.status(200).json({ success: false, error: "Upscale returned no image" });
  } catch (err: any) {
    console.error("upscale-image error:", err);
    return res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
}
