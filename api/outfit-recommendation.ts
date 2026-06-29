import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";

/* ------------------------------------------------------------------ */
/*  GCP Service Account Auth: JWT -> Access Token                       */
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
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.access_token;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ClosetItem {
  id: string;
  name: string;
  category: string;
  color: string;
  tags: string[];
  material?: string;
  gender: string;
  image_url: string;
}

interface ProfileInfo {
  body_type?: string;
  skin_tone?: string;
  model_gender?: string;
}

interface WeatherInfo {
  temp: number;
  condition: string;
  humidity: number;
  windSpeed: number;
}

/* ------------------------------------------------------------------ */
/*  Build the Gemini prompt -- now returns 3 combinations               */
/* ------------------------------------------------------------------ */

function buildPrompt(
  occasion: string,
  items: ClosetItem[],
  profile?: ProfileInfo,
  weather?: WeatherInfo
): string {
  const itemList = items
    .map(
      (item, i) =>
        `${i + 1}. [ID: ${item.id}] "${item.name}" -- Category: ${item.category}, Color: ${item.color}, Material: ${item.material || "unknown"}, Tags: [${item.tags.join(", ")}], Gender: ${item.gender}`
    )
    .join("\n");

  let personalization = "";
  if (profile) {
    const parts: string[] = [];
    if (profile.body_type) parts.push(`Body type: ${profile.body_type}`);
    if (profile.skin_tone) parts.push(`Skin tone: ${profile.skin_tone}`);
    if (profile.model_gender) parts.push(`Gender preference: ${profile.model_gender}`);
    if (parts.length > 0) {
      personalization = `\n\nUser profile:\n${parts.join("\n")}
Consider these when making recommendations -- suggest items that complement the user's body type, flatter their skin tone, and match their gender preference.`;
    }
  }

  let weatherContext = "";
  if (weather) {
    weatherContext = `\n\nCurrent weather: ${weather.temp}°C, ${weather.condition}, Humidity: ${weather.humidity}%, Wind: ${weather.windSpeed} km/h.
Factor weather into your picks -- suggest weather-appropriate fabrics, layers, and styles.`;
  }

  return `You are an expert fashion stylist AI. A user wants outfit recommendations for: "${occasion}".

Here are ALL the clothing items in their closet:
${itemList}
${personalization}${weatherContext}

Your task:
1. Create exactly 3 DIFFERENT outfit combinations for the occasion "${occasion}".
2. Each combination should be a COMPLETE outfit with items from different categories.
3. For each combination, structure items into SLOTS:
   - For men or unisex: "topwear", "bottomwear", "footwear" (3 slots)
   - For women: either "topwear"+"bottomwear"+"footwear" (3 slots) OR "dress"+"footwear" (2 slots) if a dress/gown/one-piece is chosen
4. ONLY use items from the list above -- reference them by their exact ID.
5. Each combination should have a DISTINCT style direction (e.g. one classic, one trendy, one relaxed).
6. Give each combination a short creative label (2-3 words, e.g. "Classic Elegance", "Street Smart").
7. Provide a styling tip and reasoning for each combination.
8. If the closet is missing key pieces, note what's missing.
9. Try to avoid reusing the same item across all 3 combinations when possible.

Return ONLY a valid JSON object in this exact format (no markdown, no code fences):
{
  "combinations": [
    {
      "label": "Creative Style Label",
      "slots": [
        {"slot": "topwear", "item_id": "id1"},
        {"slot": "bottomwear", "item_id": "id2"},
        {"slot": "footwear", "item_id": "id3"}
      ],
      "item_ids": ["id1", "id2", "id3"],
      "tip": "A specific styling tip for this combination",
      "reasoning": [
        {"id": "id1", "reason": "Why this item was chosen"},
        {"id": "id2", "reason": "Why this item was chosen"}
      ],
      "missing": "What key pieces are missing, or null"
    },
    {
      "label": "Another Style Label",
      "slots": [
        {"slot": "topwear", "item_id": "id4"},
        {"slot": "bottomwear", "item_id": "id5"},
        {"slot": "footwear", "item_id": "id6"}
      ],
      "item_ids": ["id4", "id5", "id6"],
      "tip": "Styling tip for this combination",
      "reasoning": [
        {"id": "id4", "reason": "Why chosen"},
        {"id": "id5", "reason": "Why chosen"}
      ],
      "missing": null
    },
    {
      "label": "Third Style Label",
      "slots": [
        {"slot": "topwear", "item_id": "id7"},
        {"slot": "bottomwear", "item_id": "id8"},
        {"slot": "footwear", "item_id": "id9"}
      ],
      "item_ids": ["id7", "id8", "id9"],
      "tip": "Styling tip for this combination",
      "reasoning": [
        {"id": "id7", "reason": "Why chosen"},
        {"id": "id8", "reason": "Why chosen"}
      ],
      "missing": null
    }
  ]
}

IMPORTANT: If the closet has fewer items and you cannot make 3 truly different combinations, return as many distinct ones as you can (minimum 1). Each combination MUST have at least 2 items.`;
}

/* ------------------------------------------------------------------ */
/*  Controlled-generation response schema (forces valid JSON)          */
/* ------------------------------------------------------------------ */

// Vertex AI OpenAPI subset: type names are UPPERCASE.
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    combinations: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          label: { type: "STRING" },
          slots: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                slot: { type: "STRING" },
                item_id: { type: "STRING" },
              },
              required: ["slot", "item_id"],
            },
          },
          item_ids: { type: "ARRAY", items: { type: "STRING" } },
          tip: { type: "STRING" },
          reasoning: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                id: { type: "STRING" },
                reason: { type: "STRING" },
              },
              required: ["id", "reason"],
            },
          },
          missing: { type: "STRING" },
        },
        required: ["label", "slots", "item_ids", "tip"],
      },
    },
  },
  required: ["combinations"],
};

interface Combination {
  label: string;
  slots: { slot: string; item_id: string }[];
  item_ids: string[];
  tip: string;
  reasoning: { id: string; reason: string }[];
  missing?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Slot classification (mirrors the frontend SLOT_DEFS)               */
/* ------------------------------------------------------------------ */

type Slot = "topwear" | "bottomwear" | "footwear" | "dress";

const ACTIVEWEAR_BOTTOM_RE = /legging|jogger|short|pant|trouser|track|tight|capri|sweatpant/i;

function slotForItem(item: ClosetItem): Slot | null {
  switch ((item.category || "").toLowerCase()) {
    case "tops":
    case "outerwear":
      return "topwear";
    case "bottoms":
      return "bottomwear";
    case "footwear":
      return "footwear";
    case "dresses":
      return "dress";
    case "activewear":
      return ACTIVEWEAR_BOTTOM_RE.test(`${item.name} ${(item.tags || []).join(" ")}`)
        ? "bottomwear"
        : "topwear";
    default:
      return null; // Accessories / unknown — not a primary slot
  }
}

// neutral (or unset) profile accepts everything; otherwise matching gender + unisex.
function genderOk(item: ClosetItem, modelGender?: string): boolean {
  if (!modelGender || modelGender === "neutral") return true;
  const g = (item.gender || "unisex").toLowerCase();
  return g === "unisex" || g === modelGender;
}

/* ------------------------------------------------------------------ */
/*  Tolerant JSON parsing + validation against the real closet         */
/* ------------------------------------------------------------------ */

function parseCombosLoose(rawText: string): Combination[] {
  if (!rawText) return [];
  // responseMimeType already yields clean JSON, but stay defensive.
  const txt = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const tryParse = (s: string): any => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };
  let obj = tryParse(txt);
  if (!obj) {
    const first = txt.indexOf("{");
    const last = txt.lastIndexOf("}");
    if (first !== -1 && last > first) obj = tryParse(txt.slice(first, last + 1));
  }
  if (!obj || !Array.isArray(obj.combinations)) return [];
  return obj.combinations as Combination[];
}

// Drop any item_id the AI invented; keep only combos with >= 2 real items.
function sanitizeCombinations(combos: Combination[], items: ClosetItem[]): Combination[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const out: Combination[] = [];
  for (const c of combos || []) {
    if (!c) continue;
    const validSlots = (Array.isArray(c.slots) ? c.slots : []).filter(
      (s) => s && byId.has(s.item_id)
    );
    const validIds = (Array.isArray(c.item_ids) ? c.item_ids : []).filter((id) => byId.has(id));
    const idSet = new Set<string>([...validIds, ...validSlots.map((s) => s.item_id)]);
    if (idSet.size < 2) continue;
    out.push({
      label: typeof c.label === "string" && c.label.trim() ? c.label : "Your Outfit",
      slots: validSlots,
      item_ids: Array.from(idSet),
      tip: typeof c.tip === "string" ? c.tip : "",
      reasoning: Array.isArray(c.reasoning)
        ? c.reasoning.filter((r) => r && byId.has(r.id))
        : [],
      missing: c.missing ?? null,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Deterministic fallback — builds outfits with no AI at all          */
/* ------------------------------------------------------------------ */

function buildFallbackCombinations(
  occasion: string,
  items: ClosetItem[],
  profile?: ProfileInfo
): Combination[] {
  const modelGender = profile?.model_gender;

  // Prefer gender-compatible items, but never let a slot go empty over gender.
  const pick = (slot: Slot): ClosetItem[] => {
    const all = items.filter((i) => slotForItem(i) === slot);
    const preferred = all.filter((i) => genderOk(i, modelGender));
    return preferred.length > 0 ? preferred : all;
  };

  const tops = pick("topwear");
  const bottoms = pick("bottomwear");
  const shoes = pick("footwear");
  const dresses = pick("dress");

  const occ = occasion.toLowerCase();
  const cap = occasion.charAt(0).toUpperCase() + occasion.slice(1);
  const LABELS = [`${cap} Staple`, `Smart ${cap}`, `Easy ${cap}`];
  const combos: Combination[] = [];
  const seen = new Set<string>();

  const addCombo = (chosen: (ClosetItem | undefined)[]) => {
    const valid = chosen.filter(Boolean) as ClosetItem[];
    if (valid.length < 2 || combos.length >= 3) return;
    const sig = valid
      .map((i) => i.id)
      .sort()
      .join("|");
    if (seen.has(sig)) return;
    seen.add(sig);
    combos.push({
      label: LABELS[combos.length % LABELS.length],
      slots: valid.map((i) => ({ slot: slotForItem(i) as string, item_id: i.id })),
      item_ids: valid.map((i) => i.id),
      tip: `A balanced ${occ} outfit pulled straight from your closet.`,
      reasoning: valid.map((i) => ({
        id: i.id,
        reason: `${i.name} is a versatile ${occ} pick.`,
      })),
      missing: null,
    });
  };

  // Strategy 1: separates (top + bottom [+ shoes]).
  const sep = Math.max(tops.length, bottoms.length);
  for (let i = 0; i < sep && combos.length < 3; i++) {
    const top = tops[i % tops.length];
    const bottom = bottoms[i % bottoms.length];
    if (!top || !bottom) break;
    const shoe = shoes.length ? shoes[i % shoes.length] : undefined;
    addCombo([top, bottom, shoe]);
  }

  // Strategy 2: dress (+ shoes).
  for (let i = 0; i < dresses.length && combos.length < 3; i++) {
    const shoe = shoes.length ? shoes[i % shoes.length] : undefined;
    if (shoe) addCombo([dresses[i], shoe]);
  }

  return combos;
}

/* ------------------------------------------------------------------ */
/*  Single AI attempt (time-bounded). Returns combos + a diag string.  */
/*  useSchema=false drops responseSchema (in case Vertex rejects it).  */
/* ------------------------------------------------------------------ */

async function callGeminiOutfits(
  accessToken: string,
  url: string,
  prompt: string,
  timeoutMs: number,
  useSchema: boolean
): Promise<{ combos: Combination[]; diag: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const generationConfig: Record<string, unknown> = {
      temperature: 0.8,
      maxOutputTokens: 8192,
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: "application/json",
    };
    if (useSchema) generationConfig.responseSchema = RESPONSE_SCHEMA;

    const geminiRes = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig,
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => "");
      throw new Error(`http ${geminiRes.status}: ${errText.slice(0, 300)}`);
    }

    const data = await geminiRes.json();
    const cand = data?.candidates?.[0];
    const finishReason = cand?.finishReason || "none";
    const rawText = cand?.content?.parts?.[0]?.text || "";
    const combos = parseCombosLoose(rawText);
    const diag = `schema=${useSchema} finishReason=${finishReason} rawLen=${rawText.length} parsed=${combos.length}`;
    return { combos, diag };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/*  Vercel Serverless Handler                                          */
/* ------------------------------------------------------------------ */

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
    const body = (req.body || {}) as {
      occasion?: string;
      items?: ClosetItem[];
      profile?: ProfileInfo;
      weather?: WeatherInfo;
    };
    const items = Array.isArray(body.items) ? body.items.filter((i) => i && i.id) : [];
    const profile = body.profile;
    const weather = body.weather;
    const occasion = (body.occasion && String(body.occasion).trim()) || "everyday";

    // Need at least two items before any outfit is possible.
    if (items.length < 2) {
      return res.status(400).json({
        success: false,
        error: "Add at least 2 clothing items to your closet to get outfit recommendations.",
      });
    }

    // Deterministic fallback computed up front — guarantees we always have an answer.
    const fallback = buildFallbackCombinations(occasion, items, profile);

    // Best-quality path: Gemini. Never let its failure become the user's failure.
    let aiCombos: Combination[] = [];
    const diags: string[] = [];
    try {
      const saKeyJson = process.env.GCP_SERVICE_ACCOUNT_KEY;
      if (saKeyJson) {
        const saKey: ServiceAccountKey = JSON.parse(saKeyJson);
        const accessToken = await getAccessToken(saKey);
        const url =
          "https://us-central1-aiplatform.googleapis.com/v1/projects/fynd-jio-impetus-non-prod/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent";
        const prompt = buildPrompt(occasion, items, profile, weather);

        const start = Date.now();
        const AI_BUDGET_MS = 9000; // stay well under the serverless timeout
        const MAX_ATTEMPTS = 2;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          const remaining = AI_BUDGET_MS - (Date.now() - start);
          if (remaining < 2500) break;
          // Attempt 1 uses the strict schema; a retry drops it in case Vertex
          // rejects the responseSchema (which would 400 every time otherwise).
          const useSchema = attempt === 1;
          try {
            const { combos, diag } = await callGeminiOutfits(
              accessToken,
              url,
              prompt,
              Math.min(7000, remaining),
              useSchema
            );
            const clean = sanitizeCombinations(combos, items);
            if (clean.length === 0 && combos.length > 0) {
              // AI returned combos but none survived ID validation — show the mismatch.
              const aiIds = combos.flatMap((c) => c.item_ids || []).slice(0, 4);
              const closetIds = items.map((i) => i.id).slice(0, 4);
              diags.push(
                `a${attempt} ${diag} sanitized=0 aiIds=${JSON.stringify(aiIds)} closetIds=${JSON.stringify(closetIds)}`
              );
            } else {
              diags.push(`a${attempt} ${diag} sanitized=${clean.length}`);
            }
            if (clean.length > 0) {
              aiCombos = clean;
              break;
            }
          } catch (e) {
            diags.push(`a${attempt} schema=${useSchema} ERROR ${(e as Error).message}`);
            console.error(`Outfit AI attempt ${attempt} failed:`, (e as Error).message);
          }
          if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 400));
        }
      } else {
        diags.push("GCP_SERVICE_ACCOUNT_KEY missing");
        console.warn("GCP_SERVICE_ACCOUNT_KEY missing — serving deterministic fallback.");
      }
    } catch (e) {
      diags.push(`auth/setup ERROR ${(e as Error).message}`);
      console.error("Outfit AI path error (falling back):", (e as Error).message);
    }

    const combinations = aiCombos.length > 0 ? aiCombos : fallback;

    if (combinations.length === 0) {
      // >= 2 items present, but they can't form an outfit (e.g. two pairs of shoes).
      return res.status(200).json({
        success: false,
        error:
          "Couldn't assemble an outfit from your current items. Try adding a top, a bottom, or a dress.",
      });
    }

    const source = aiCombos.length > 0 ? "ai" : "fallback";
    return res.status(200).json({
      success: true,
      source,
      // Always surface the AI-path trace so we can diagnose from the Network tab.
      debug: { reason: diags.join(" | ") || "unknown", items: items.length },
      combinations,
    });
  } catch (err: any) {
    // Last resort: even on an unexpected error, try to serve the deterministic fallback.
    console.error("Outfit recommendation error:", err);
    try {
      const b = (req.body || {}) as { occasion?: string; items?: ClosetItem[]; profile?: ProfileInfo };
      const items = Array.isArray(b.items) ? b.items.filter((i) => i && i.id) : [];
      const occasion = (b.occasion && String(b.occasion).trim()) || "everyday";
      const fb = buildFallbackCombinations(occasion, items, b.profile);
      if (fb.length > 0) {
        return res.status(200).json({ success: true, source: "fallback", combinations: fb });
      }
    } catch (e) {
      console.error("Fallback also failed:", (e as Error).message);
    }
    return res.status(500).json({
      success: false,
      error: "Couldn't generate recommendations right now. Please try again.",
    });
  }
}
