import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";

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
    .update(header + "." + payload)
    .sign(sa.private_key);

  const jwt = header + "." + payload + "." + base64url(signature);

  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + jwt,
  });

  if (!res.ok) {
    throw new Error("Token exchange failed: " + res.status + " " + await res.text());
  }

  const data = await res.json();
  return data.access_token;
}

const CLOTHING_PROMPT = "Analyze this clothing image and return a JSON object with these exact fields:\n- name: a short descriptive name for the clothing item (e.g. \"Blue Denim Jacket\")\n- category: one of: tops, bottoms, dresses, outerwear, activewear, shoes, accessories\n- color: the primary color\n- material: fabric type if identifiable, or best guess (e.g. cotton, polyester, denim, silk, wool, leather)\n- brand: brand name if visible on the item, otherwise empty string\n- tags: array of 2-4 descriptive tags (e.g. [\"casual\", \"summer\", \"lightweight\"])\n- gender: one of: men, women, unisex\n\nReturn ONLY the raw JSON object. No markdown, no code fences, no explanation.";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    const { imageBase64, mimeType = "image/jpeg" } = req.body;
    if (!imageBase64) return res.status(400).json({ success: false, error: "imageBase64 is required" });

    const saKeyJson = process.env.GCP_SERVICE_ACCOUNT_KEY;
    if (!saKeyJson) return res.status(500).json({ success: false, error: "Server misconfigured: missing GCP credentials" });

    const saKey: ServiceAccountKey = JSON.parse(saKeyJson);
    const accessToken = await getAccessToken(saKey);

    const project = "fynd-jio-impetus-non-prod";
    const region = "us-central1";
    const model = "gemini-2.0-flash";
    const url = "https://" + region + "-aiplatform.googleapis.com/v1/projects/" + project + "/locations/" + region + "/publishers/google/models/" + model + ":generateContent";

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: CLOTHING_PROMPT }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Vertex AI error:", geminiRes.status, errText);
      return res.status(502).json({ success: false, error: "Vertex AI error: " + geminiRes.status });
    }

    const data = await geminiRes.json();
    const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = textContent.match(/\{[\\s\\S]*\}/);
    if (!jsonMatch) return res.status(502).json({ success: false, error: "Failed to parse AI response" });

    const attrs = JSON.parse(jsonMatch[0]);
    const validCategories = ["tops", "bottoms", "dresses", "outerwear", "activewear", "shoes", "accessories"];
    if (!validCategories.includes(attrs.category)) attrs.category = "tops";
    if (!["men", "women", "unisex"].includes(attrs.gender)) attrs.gender = "unisex";
    if (!Array.isArray(attrs.tags)) attrs.tags = [];

    return res.status(200).json({ success: true, attributes: attrs });
  } catch (err: any) {
    console.error("process-clothing error:", err);
    return res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
}
