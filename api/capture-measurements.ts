import type { VercelRequest, VercelResponse } from "@vercel/node";

/* ------------------------------------------------------------------ */
/* Captures body measurements from VTO API and stores in profiles      */
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

function getVTOConfig() {
  const url = process.env.VTO_SUPABASE_URL;
  const key = process.env.VTO_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing VTO Supabase env vars");
  return { url, key };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Use POST" });
  }

  try {
    const { userId, imageBase64, mimeType, sessionToken } = req.body || {};

    if (!userId) {
      return res.status(400).json({ success: false, error: "userId is required" });
    }
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: "imageBase64 is required" });
    }

    const vto = getVTOConfig();
    const sb = getSupabaseConfig();

    // Extract user token from Authorization header for RLS
    const authHeader = req.headers.authorization || "";
    const userToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    // 1. Call VTO generate endpoint to get measurements
    const vtoRes = await fetch(`${vto.url}/functions/v1/generate-virtual-tryon`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${vto.key}`,
        ...(sessionToken ? { "x-session-token": sessionToken } : {}),
      },
      body: JSON.stringify({
        fullBodyImage: imageBase64,
        outfitImageUrls: [],
        category: "upper_body",
        garmentDescription: "measurement_capture",
        garmentMeta: {},
      }),
    });

    if (!vtoRes.ok) {
      const errText = await vtoRes.text();
      console.error("VTO API error:", vtoRes.status, errText);
      return res.status(502).json({
        success: false,
        error: `VTO API returned ${vtoRes.status}`,
      });
    }

    const vtoData = await vtoRes.json();
    const measurements = vtoData.measurements;

    if (!measurements) {
      return res.status(200).json({
        success: true,
        measurements: null,
        message: "VTO completed but no measurements returned",
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
      // Still return measurements even if storage fails
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
  } catch (err: any) {
    console.error("capture-measurements error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Internal server error",
    });
  }
}
