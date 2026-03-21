import type { VercelRequest, VercelResponse } from "@vercel/node";

/* ------------------------------------------------------------------ */
/*  v8 — Replicate IDM-VTON: Dedicated Virtual Try-On Model           */
/*                                                                      */
/*  IDM-VTON is specifically trained for virtual try-on. It segments    */
/*  the clothing region and inpaints ONLY the clothes while keeping     */
/*  the person's face, body, pose pixel-perfect.                        */
/*                                                                      */
/*  For multi-garment outfits, we chain calls:                          */
/*    1. Apply topwear to person photo → result1                        */
/*    2. Apply bottomwear to result1 → result2 (face still preserved)   */
/*  Shoes are not supported by IDM-VTON and are skipped.                */
/* ------------------------------------------------------------------ */

export const config = {
  maxDuration: 300, // Allow up to 5 minutes for multi-garment chaining
};

/* ─── Replicate Prediction Helper ─── */

async function runVTON(
  apiToken: string,
  humanImg: string,
  garmImg: string,
  category: string,
  garmentDes: string
): Promise<string> {
  // Create prediction using the model endpoint (auto-selects latest version)
  const createRes = await fetch(
    "https://api.replicate.com/v1/models/cuuupid/idm-vton/predictions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        Prefer: "wait", // Block up to 60s for result
      },
      body: JSON.stringify({
        input: {
          human_img: humanImg,
          garm_img: garmImg,
          category: category,
          garment_des: garmentDes || "clothing item",
          seed: 42,
        },
      }),
    }
  );

  if (!createRes.ok) {
    const errText = await createRes.text();
    console.error("Replicate create error:", createRes.status, errText);
    throw new Error(`Replicate API error: ${createRes.status} — ${errText.substring(0, 300)}`);
  }

  const prediction = await createRes.json();

  // If completed immediately (Prefer: wait worked)
  if (prediction.status === "succeeded" && prediction.output) {
    // output can be a string URL or an array — handle both
    const output = Array.isArray(prediction.output)
      ? prediction.output[0]
      : prediction.output;
    return output;
  }

  // If still processing, poll every 2s for up to 4 minutes
  if (
    prediction.status === "processing" ||
    prediction.status === "starting"
  ) {
    const pollUrl =
      prediction.urls?.get ||
      `https://api.replicate.com/v1/predictions/${prediction.id}`;

    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const pollRes = await fetch(pollUrl, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      const pollData = await pollRes.json();

      if (pollData.status === "succeeded" && pollData.output) {
        const output = Array.isArray(pollData.output)
          ? pollData.output[0]
          : pollData.output;
        return output;
      }
      if (
        pollData.status === "failed" ||
        pollData.status === "canceled"
      ) {
        throw new Error(
          `VTON prediction failed: ${pollData.error || "unknown error"}`
        );
      }
    }
    throw new Error("VTON prediction timed out after 4 minutes");
  }

  if (prediction.status === "failed") {
    throw new Error(
      `VTON prediction failed: ${prediction.error || "unknown error"}`
    );
  }

  throw new Error(
    `Unexpected prediction status: ${prediction.status}`
  );
}

/* ─── Garment Categorization ─── */

function categorizeGarment(label: string): {
  category: "upper_body" | "lower_body" | "dresses" | "footwear";
} {
  const l = label.toLowerCase();

  // Footwear (not supported by IDM-VTON — will be skipped)
  if (
    l.includes("shoe") || l.includes("sneaker") || l.includes("boot") ||
    l.includes("loafer") || l.includes("sandal") || l.includes("slipper") ||
    l.includes("running") || l.includes("oxford") || l.includes("footwear") ||
    l.includes("slip-on") || l.includes("moccasin") || l.includes("heel")
  ) {
    return { category: "footwear" };
  }

  // Lower body
  if (
    l.includes("pant") || l.includes("jean") || l.includes("chino") ||
    l.includes("trouser") || l.includes("short") || l.includes("jogger") ||
    l.includes("cargo") || l.includes("skirt") || l.includes("legging") ||
    l.includes("bottom")
  ) {
    return { category: "lower_body" };
  }

  // Dresses
  if (
    l.includes("dress") || l.includes("gown") || l.includes("romper") ||
    l.includes("jumpsuit") || l.includes("saree") || l.includes("sari")
  ) {
    return { category: "dresses" };
  }

  // Default: upper body
  return { category: "upper_body" };
}

/* ─── Main Handler ─── */

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });

  try {
    const {
      bodyImageBase64,
      productImageBase64,
      productImages,
      bodyMimeType = "image/jpeg",
      productMimeType = "image/jpeg",
    } = req.body;

    if (!bodyImageBase64)
      return res
        .status(400)
        .json({ success: false, error: "bodyImageBase64 is required" });

    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken)
      return res.status(500).json({
        success: false,
        error: "Server misconfigured: missing REPLICATE_API_TOKEN",
      });

    // ── Parse garments ──
    const garments: {
      base64: string;
      mimeType: string;
      label: string;
    }[] = [];

    if (
      productImages &&
      Array.isArray(productImages) &&
      productImages.length > 0
    ) {
      for (const img of productImages) {
        garments.push({
          base64: img.base64,
          mimeType: img.mimeType || "image/jpeg",
          label: img.label || "clothing item",
        });
      }
    } else if (productImageBase64) {
      garments.push({
        base64: productImageBase64,
        mimeType: productMimeType,
        label: "clothing item",
      });
    }

    if (garments.length === 0)
      return res.status(400).json({
        success: false,
        error: "At least one product image is required",
      });

    // ── Categorize and filter ──
    const categorized = garments.map((g) => ({
      ...g,
      ...categorizeGarment(g.label),
    }));

    // Separate supported vs unsupported
    const supported = categorized.filter(
      (g) => g.category !== "footwear"
    );
    const skippedShoes = categorized.filter(
      (g) => g.category === "footwear"
    );

    if (supported.length === 0) {
      return res.status(400).json({
        success: false,
        error:
          "Footwear-only try-on is not yet supported. Please select a top or bottom garment.",
      });
    }

    // Sort: upper_body/dresses first, then lower_body
    supported.sort((a, b) => {
      const order: Record<string, number> = {
        upper_body: 0,
        dresses: 0,
        lower_body: 1,
      };
      return (order[a.category] ?? 2) - (order[b.category] ?? 2);
    });

    console.log(
      `[VTON] Processing ${supported.length} garment(s), skipped ${skippedShoes.length} shoe(s)`
    );
    console.log(
      `[VTON] Order:`,
      supported.map((g) => `${g.category}: ${g.label}`)
    );

    // ── Chain VTON calls ──
    let currentPersonImg = `data:${bodyMimeType};base64,${bodyImageBase64}`;

    for (let i = 0; i < supported.length; i++) {
      const garment = supported[i];
      const garmImg = `data:${garment.mimeType};base64,${garment.base64}`;

      console.log(
        `[VTON] Pass ${i + 1}/${supported.length}: ${garment.category} — "${garment.label}"`
      );

      const resultUrl = await runVTON(
        apiToken,
        currentPersonImg,
        garmImg,
        garment.category,
        garment.label
      );

      console.log(`[VTON] Pass ${i + 1} complete, result: ${resultUrl.substring(0, 80)}...`);

      // Use the result URL as the person image for the next garment
      currentPersonImg = resultUrl;
    }

    // ── Download final result and convert to base64 ──
    const imgRes = await fetch(currentPersonImg);
    if (!imgRes.ok) {
      throw new Error(
        `Failed to download result image: ${imgRes.status}`
      );
    }
    const imgBuf = await imgRes.arrayBuffer();
    const base64Result = Buffer.from(imgBuf).toString("base64");
    const resultMimeType =
      imgRes.headers.get("content-type") || "image/png";

    const noteAboutShoes =
      skippedShoes.length > 0
        ? ` (Note: ${skippedShoes.map((s) => s.label).join(", ")} skipped — footwear try-on not yet supported)`
        : "";

    return res.status(200).json({
      success: true,
      images: [{ mimeType: resultMimeType, base64: base64Result }],
      note: noteAboutShoes || undefined,
    });
  } catch (err: any) {
    console.error("virtual-tryon error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Internal server error",
    });
  }
}
