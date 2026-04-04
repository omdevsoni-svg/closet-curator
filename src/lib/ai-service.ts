import { supabase } from "./supabase";
// v21: Client-side face composite with Reinhard color correction + feathered mask
import { compositeFaceOntoVTO } from "./face-composite";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/* ------------------------------------------------------------------ */
/*  v29: Compress base64 image to reduce payload for Vercel limits    */
/* ------------------------------------------------------------------ */
const compressBase64Image = (
  base64: string,
  mimeType = "image/jpeg",
  maxDim = 1024,
  quality = 0.65
): Promise<string> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
        else { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(dataUrl.split(",")[1]);
    };
    img.onerror = () => resolve(base64); // fallback to original
    img.src = `data:${mimeType};base64,${base64}`;
  });

/* ------------------------------------------------------------------ */
/*  Helper: convert File -> base64 string (no data: prefix)            */
/* ------------------------------------------------------------------ */
export const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data:image/...;base64, prefix
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/* ------------------------------------------------------------------ */
/*  Helper: convert image URL -> base64 string                         */
/* ------------------------------------------------------------------ */
export const urlToBase64 = async (
  url: string,
  opts?: { maxDim?: number; quality?: number; removeBackground?: boolean }
): Promise<string> => {
  // v23: Background removal for garment images + PNG preservation
  // VTO model needs clean garment on white/transparent background.
  // AI-generated garment images often have grey/colored backgrounds that
  // confuse the model about garment boundaries (collar, hem, sleeve length).
  const MAX = opts?.maxDim ?? 1536;
  const quality = opts?.quality ?? 0.95;
  const removeBg = opts?.removeBackground ?? false;
  const res = await fetch(url);
  const blob = await res.blob();
  const isPng = blob.type === "image/png" || url.toLowerCase().includes(".png");

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      // v23: Remove background for garment images
      if (removeBg) {
        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;

        // Sample background color from corners (10x10 pixel areas)
        const samples: number[][] = [];
        const sampleSize = 10;
        for (let sy = 0; sy < sampleSize; sy++) {
          for (let sx = 0; sx < sampleSize; sx++) {
            // Top-left corner
            const i1 = (sy * w + sx) * 4;
            samples.push([d[i1], d[i1+1], d[i1+2]]);
            // Top-right corner
            const i2 = (sy * w + (w - 1 - sx)) * 4;
            samples.push([d[i2], d[i2+1], d[i2+2]]);
            // Bottom-left corner
            const i3 = ((h - 1 - sy) * w + sx) * 4;
            samples.push([d[i3], d[i3+1], d[i3+2]]);
            // Bottom-right corner
            const i4 = ((h - 1 - sy) * w + (w - 1 - sx)) * 4;
            samples.push([d[i4], d[i4+1], d[i4+2]]);
          }
        }

        // Average background color
        const bgR = Math.round(samples.reduce((s, c) => s + c[0], 0) / samples.length);
        const bgG = Math.round(samples.reduce((s, c) => s + c[1], 0) / samples.length);
        const bgB = Math.round(samples.reduce((s, c) => s + c[2], 0) / samples.length);

        // Replace pixels similar to background with pure white
        // Use a generous threshold to catch gradient backgrounds
        const threshold = 40;
        for (let i = 0; i < d.length; i += 4) {
          const dr = Math.abs(d[i] - bgR);
          const dg = Math.abs(d[i+1] - bgG);
          const db = Math.abs(d[i+2] - bgB);
          if (dr < threshold && dg < threshold && db < threshold) {
            d[i] = 255;     // R
            d[i+1] = 255;   // G
            d[i+2] = 255;   // B
            d[i+3] = 255;   // A (fully opaque white)
          }
        }
        ctx.putImageData(imgData, 0, 0);
        console.log(`v23 background removed: bg=(${bgR},${bgG},${bgB}), threshold=${threshold}`);
      }

      // Always output as PNG for garment images (preserves edges), JPEG for body photos
      const outputFormat = (removeBg || isPng) ? "image/png" : "image/jpeg";
      const dataUrl = outputFormat === "image/jpeg"
        ? canvas.toDataURL("image/jpeg", quality)
        : canvas.toDataURL("image/png");
      resolve(dataUrl.split(",")[1]);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
};

/* ------------------------------------------------------------------ */
/*  AI Attribute Detection -- calls Gemini API directly                 */
/* ------------------------------------------------------------------ */
export interface DetectedAttributes {
  name: string;
  category: string;
  color: string;
  material: string;
  tags: string[];
  gender: "men" | "women" | "unisex";
  rotation_needed?: number; // 0, 90, 180, or 270 degrees clockwise
}

export type DetectionResult =
  | { success: true; attributes: DetectedAttributes; enhancedImage?: { mimeType: string; base64: string } }
  | { success: false; is_garment: false; rejection_reason: string }
  | { success: false; error: string };

export const detectClothingAttributes = async (
  imageBase64: string,
  mimeType = "image/jpeg"
): Promise<DetectionResult> => {
  try {
    // v30: Pre-compress image before sending to API
    // 1536px @ q0.85 is more than enough for attribute detection + ghost mannequin
    // Reduces upload payload by 50-80% and speeds up Gemini processing (~1-2s saved)
    const compressed = await compressBase64Image(imageBase64, mimeType, 1536, 0.85);

    const res = await fetch("/api/process-clothing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: compressed, mimeType: "image/jpeg" }),
    });

    const data = await res.json();

    // Non-garment image rejected
    if (data.is_garment === false) {
      return { success: false, is_garment: false, rejection_reason: data.rejection_reason };
    }

    if (data.success && data.attributes) {
      return {
        success: true,
        attributes: data.attributes as DetectedAttributes,
        ...(data.enhancedImage ? { enhancedImage: data.enhancedImage } : {}),
      };
    }
    return { success: false, error: data.error || "AI detection failed" };
  } catch (err) {
    console.error("detectClothingAttributes error:", err);
    return { success: false, error: "Network error during detection" };
  }
};

/* ------------------------------------------------------------------ */
/*  Virtual Try-On -- calls Vercel serverless function with face + body */
/* ------------------------------------------------------------------ */
export interface TryOnResult {
  mimeType: string;
  base64: string;
}

// v18: Face refinement now handled server-side by Gemini in virtual-tryon API
// The canvas-based applyFaceComposite has been replaced with Gemini 2.5 Flash Image
// which produces much better results (understands facial structure vs simple pixel blending)

/* ------------------------------------------------------------------ */
/*  v30: Background upscale helper -- called after VTO preview shown    */
/*  Same Imagen 4.0 2x upscale, just runs async after user sees result */
/* ------------------------------------------------------------------ */
const upscaleInBackground = async (base64: string): Promise<TryOnResult | null> => {
  try {
    const res = await fetch("/api/upscale-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: base64 }),
    });
    const data = await res.json();
    if (data.success && data.image) {
      console.log("v30 deferred upscale completed");
      return data.image as TryOnResult;
    }
  } catch (e) { console.warn("Deferred upscale failed (non-fatal):", e); }
  return null;
};

export const virtualTryOn = async (
  bodyImageBase64: string,
  productImageBase64: string,
  sampleCount = 1,
  personDescription?: string,
  faceImageBase64?: string,
  onUpscaled?: (result: TryOnResult) => void,
): Promise<TryOnResult[]> => {
  try {
    // v30: Skip upscale server-side -- return preview faster, upscale in background
    const res = await fetch("/api/virtual-tryon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bodyImageBase64,
        faceImageBase64: faceImageBase64 || undefined,
        productImageBase64,
        personDescription: personDescription || undefined,
        upscale: false,
      }),
    });

    const data = await res.json();
    if (data.success && data.images) {
      // v21: Apply client-side face composite
      const results = data.images as TryOnResult[];
      if (results.length > 0) {
        try {
          const composited = await compositeFaceOntoVTO(
            bodyImageBase64, results[0].base64, "image/jpeg", results[0].mimeType
          );
          if (composited) {
            results[0] = { mimeType: "image/png", base64: composited };
            console.log("v21 face composite applied (single)");
          }
        } catch (e) { console.warn("Face composite failed (non-fatal):", e); }

        // v30: Fire background upscale -- non-blocking, swaps in HD when ready
        if (onUpscaled) {
          upscaleInBackground(results[0].base64).then((upscaled) => {
            if (upscaled) onUpscaled(upscaled);
          });
        }
      }
      return results;
    }
    console.error("Virtual try-on failed:", data.error, data.details);
    return [];
  } catch (err) {
    console.error("virtualTryOn error:", err);
    return [];
  }
};

/* ------------------------------------------------------------------ */
/*  Virtual Try-On (Multi-Garment) -- sends all outfit items at once    */
/* ------------------------------------------------------------------ */
export interface GarmentInput {
  base64: string;
  mimeType?: string;
  label?: string;
}

export const virtualTryOnMulti = async (
  bodyImageBase64: string,
  garments: GarmentInput[],
  personDescription?: string,
  faceImageBase64?: string,
  onUpscaled?: (result: TryOnResult) => void,
): Promise<TryOnResult[]> => {
  try {
    // v30: Skip upscale server-side
    const res = await fetch("/api/virtual-tryon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bodyImageBase64,
        faceImageBase64: faceImageBase64 || undefined,
        productImages: garments.map((g) => ({
          base64: g.base64,
          mimeType: g.mimeType || "image/jpeg",
          label: g.label,
        })),
        personDescription: personDescription || undefined,
        upscale: false,
      }),
    });

    const data = await res.json();
    if (data.success && data.images) {
      // v21: Apply client-side face composite
      const results = data.images as TryOnResult[];
      if (results.length > 0) {
        try {
          const composited = await compositeFaceOntoVTO(
            bodyImageBase64, results[0].base64, "image/jpeg", results[0].mimeType
          );
          if (composited) {
            results[0] = { mimeType: "image/png", base64: composited };
            console.log("v21 face composite applied (multi)");
          }
        } catch (e) { console.warn("Face composite failed (non-fatal):", e); }

        // v30: Fire background upscale
        if (onUpscaled) {
          upscaleInBackground(results[0].base64).then((upscaled) => {
            if (upscaled) onUpscaled(upscaled);
          });
        }
      }
      return results;
    }
    console.error("Virtual try-on (multi) failed:", data.error, data.details);
    return [];
  } catch (err) {
    console.error("virtualTryOnMulti error:", err);
    return [];
  }
};

/* ------------------------------------------------------------------ */
/*  Virtual Try-On (Sequential) -- Imagen 3 VTO, one garment at a time */
/*                                                                      */
/*  Step 1: body photo + topwear -> result1                             */
/*  Step 2: result1 (as person) + bottomwear -> result2                 */
/*  Step 3: result2 (as person) + footwear -> final                     */
/*                                                                      */
/*  Imagen 3 VTO preserves identity automatically -- no face refinement  */
/*  needed. Previous result becomes the personImage for the next step.  */
/* ------------------------------------------------------------------ */

export interface SequentialGarment {
  base64: string;
  mimeType?: string;
  label: string;       // e.g. "topwear: Puma Graphic Tee"
  category: string;    // e.g. "topwear", "bottomwear", "shoes"
}

export interface SequentialProgress {
  stepIndex: number;   // 0-based
  totalSteps: number;
  garmentLabel: string;
  status: "starting" | "done" | "error";
}

export const virtualTryOnSequential = async (
  bodyImageBase64: string,
  garments: SequentialGarment[],
  _personDescription?: string,
  onProgress?: (progress: SequentialProgress) => void,
  _faceImageBase64?: string,
  onUpscaled?: (result: TryOnResult) => void,
): Promise<TryOnResult[]> => {
  // v17: Imagen 3 VTO + Smart Quality Tiering -- fast intermediates, max quality final
  // v30: Final step skips server-side upscale -- deferred to background
  const totalSteps = garments.length;
  let previousResultBase64: string | null = null;
  let previousResultMimeType = "image/jpeg";

  for (let i = 0; i < garments.length; i++) {
    const garment = garments[i];

    onProgress?.({
      stepIndex: i,
      totalSteps,
      garmentLabel: garment.label,
      status: "starting",
    });

    try {
      const isLast = i === garments.length - 1;

      // v29: Compress previousResultBase64 to stay under Vercel's ~4.5MB payload limit
      let compressedPrev = previousResultBase64 || undefined;
      if (previousResultBase64 && i > 0) {
        compressedPrev = await compressBase64Image(previousResultBase64, previousResultMimeType, 1024, 0.65);
        console.log(`v29: Compressed prev result from ${previousResultBase64.length} to ${compressedPrev.length} chars`);
      }

      // v30: Skip upscale on ALL steps (including final) -- deferred to background
      const res = await fetch("/api/virtual-tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: i === 0 ? "single" : "sequential-step",
          bodyImageBase64: (i === 0 || !previousResultBase64) ? bodyImageBase64 : '',
          productImages: [{ base64: garment.base64, mimeType: garment.mimeType || "image/jpeg" }],
          previousResultBase64: compressedPrev,
          isFinalStep: isLast,
          upscale: false,
        }),
      });

      const data = await res.json();

      if (data.success && data.images && data.images.length > 0) {
        previousResultBase64 = data.images[0].base64;
        previousResultMimeType = data.images[0].mimeType;

        onProgress?.({
          stepIndex: i,
          totalSteps,
          garmentLabel: garment.label,
          status: "done",
        });
      } else {
        console.error(`Sequential step ${i + 1}/${totalSteps} failed:`, data.error);
        onProgress?.({ stepIndex: i, totalSteps, garmentLabel: garment.label, status: "error" });
        if (previousResultBase64) {
          // v18: Face refinement handled server-side on final step
          return [{ mimeType: previousResultMimeType, base64: previousResultBase64 }];
        }
        return [];
      }
    } catch (err) {
      console.error(`Sequential step ${i + 1}/${totalSteps} error:`, err);
      onProgress?.({ stepIndex: i, totalSteps, garmentLabel: garment.label, status: "error" });
      if (previousResultBase64) {
        return [{ mimeType: previousResultMimeType, base64: previousResultBase64 }];
      }
      return [];
    }
  }

  if (previousResultBase64) {
    // v21: Client-side face composite -- restore original face onto VTO result
    // with Reinhard color correction and multi-layer feathered mask
    let finalResult: TryOnResult = { mimeType: previousResultMimeType, base64: previousResultBase64 };
    try {
      const compositedBase64 = await compositeFaceOntoVTO(
        bodyImageBase64,
        previousResultBase64,
        "image/jpeg",
        previousResultMimeType
      );
      if (compositedBase64) {
        console.log("v21 face composite applied successfully");
        finalResult = { mimeType: "image/png", base64: compositedBase64 };
      }
    } catch (compErr) {
      console.warn("Face composite failed (non-fatal), returning raw VTO:", compErr);
    }

    // v30: Fire background upscale -- non-blocking, swaps in HD when ready
    if (onUpscaled) {
      upscaleInBackground(finalResult.base64).then((upscaled) => {
        if (upscaled) onUpscaled(upscaled);
      });
    }

    return [finalResult];
  }
  return [];
};

/* ------------------------------------------------------------------ */
/*  AI Outfit Recommendation -- calls Gemini via serverless function    */
/* ------------------------------------------------------------------ */

export interface RecommendationRequest {
  occasion: string;
  items: {
    id: string;
    name: string;
    category: string;
    color: string;
    tags: string[];
    material?: string;
    gender: string;
    image_url: string;
  }[];
  profile?: {
    body_type?: string;
    skin_tone?: string;
    model_gender?: string;
  };
  weather?: {
    temp: number;
    condition: string;
    humidity: number;
    windSpeed: number;
  };
}

export interface OutfitSlot {
  slot: string;
  item_id: string;
}

export interface OutfitCombination {
  label: string;
  slots: OutfitSlot[];
  item_ids: string[];
  tip: string;
  reasoning: { id: string; reason: string }[];
  missing: string | null;
}

export interface RecommendationResponse {
  success: true;
  combinations: OutfitCombination[];
}

/** @deprecated Use RecommendationResponse.combinations instead */
export interface LegacyRecommendationResponse {
  success: true;
  item_ids: string[];
  tip: string;
  reasoning: { id: string; reason: string }[];
  missing: string | null;
}

export const getOutfitRecommendation = async (
  request: RecommendationRequest
): Promise<RecommendationResponse | { success: false; error: string }> => {
  try {
    const res = await fetch("/api/outfit-recommendation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    const data = await res.json();
    if (data.success) {
      // Handle both new (combinations) and legacy (flat) response formats
      if (data.combinations) {
        return data as RecommendationResponse;
      }
      // Legacy fallback: wrap single result into combinations array
      return {
        success: true,
        combinations: [
          {
            label: "Recommended Look",
            slots: [],
            item_ids: data.item_ids,
            tip: data.tip,
            reasoning: data.reasoning,
            missing: data.missing || null,
          },
        ],
      };
    }
    return { success: false, error: data.error || "Recommendation failed" };
  } catch (err) {
    console.error("getOutfitRecommendation error:", err);
    return { success: false, error: "Network error during recommendation" };
  }
};

/* ------------------------------------------------------------------ */
/*  Upload try-on result to Supabase Storage                          */
/* ------------------------------------------------------------------ */
export const uploadTryOnImage = async (
  userId: string,
  base64Data: string
): Promise<string | null> => {
  try {
    // Convert base64 to blob
    const byteChars = atob(base64Data);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteArray[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([byteArray], { type: "image/png" });
    const fileName = `${userId}/${Date.now()}_tryon.png`;

    const { error } = await supabase.storage
      .from("tryon-images")
      .upload(fileName, blob, { upsert: true });

    if (error) {
      console.error("uploadTryOnImage error:", error);
      return null;
    }

    const { data } = supabase.storage.from("tryon-images").getPublicUrl(fileName);
    return data.publicUrl;
  } catch (err) {
    console.error("uploadTryOnImage error:", err);
    return null;
  }
};

/* ------------------------------------------------------------------ */
/*  Suggest matching ethnic bottomwear/footwear via AI image gen       */
/* ------------------------------------------------------------------ */

export interface SuggestedEthnicItem {
  role: "ethnic-bottom" | "ethnic-footwear";
  name: string;
  imageBase64: string;
  imageMimeType: string;
  /** Data URL for display in <img> tags */
  imageDataUrl: string;
}

export const suggestEthnicPairing = async (
  kurtaImageUrl: string,
  kurtaName: string,
  kurtaColor: string,
  missingTypes: ("ethnic-bottom" | "ethnic-footwear")[]
): Promise<{ success: boolean; suggestions: SuggestedEthnicItem[]; error?: string }> => {
  try {
    // Convert kurta image URL to base64 for the API
    const kurtaBase64 = await urlToBase64(kurtaImageUrl, { maxDim: 1024, quality: 0.9 });

    const apiUrl = SUPABASE_URL
      ? `${window.location.origin}/api/suggest-ethnic-pair`
      : "/api/suggest-ethnic-pair";

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kurtaImageBase64: kurtaBase64,
        kurtaMimeType: "image/jpeg",
        kurtaName,
        kurtaColor,
        missingTypes,
      }),
    });

    const data = await res.json();

    if (!data.success) {
      return { success: false, suggestions: [], error: data.error };
    }

    // Build data URLs for display
    const suggestions: SuggestedEthnicItem[] = data.suggestions.map(
      (s: { role: "ethnic-bottom" | "ethnic-footwear"; name: string; imageBase64: string; imageMimeType: string }) => ({
        ...s,
        imageDataUrl: `data:${s.imageMimeType};base64,${s.imageBase64}`,
      })
    );

    return { success: true, suggestions };
  } catch (err: any) {
    console.error("suggestEthnicPairing error:", err);
    return { success: false, suggestions: [], error: err.message || "Failed to generate suggestions" };
  }
};


/* ------------------------------------------------------------------ */
/* Body type & skin tone detection from full-body photo               */
/* ------------------------------------------------------------------ */
export interface BodyAttributes {
  body_type: "rectangle" | "hourglass" | "inverted_triangle" | "pear";
  skin_tone: "Light" | "Fair" | "Medium" | "Olive" | "Tan" | "Dark" | "Deep";
  confidence: "high" | "medium" | "low";
}

export async function detectBodyAttributes(
  file: File
): Promise<BodyAttributes> {
  try {
    const base64 = await fileToBase64(file);
    const compressed = await compressBase64Image(base64, 800, 0.8);

    const response = await fetch("/api/detect-body-type", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: compressed.replace(/^data:[^;]+;base64,/, ""),
        mimeType: file.type || "image/jpeg",
      }),
    });

    if (!response.ok) {
      throw new Error("Body detection API returned " + response.status);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Body detection failed");
    }

    return {
      body_type: data.body_type,
      skin_tone: data.skin_tone,
      confidence: data.confidence,
    };
  } catch (error) {
    console.error("detectBodyAttributes error:", error);
    throw error;
  }
}
