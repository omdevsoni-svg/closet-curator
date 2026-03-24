import { supabase } from "./supabase";
// v21: Client-side face composite with Reinhard color correction + feathered mask
import { compositeFaceOntoVTO } from "./face-composite";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/* ------------------------------------------------------------------ */
/*  Helper: convert File â base64 string (no data: prefix)            */
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
/*  Helper: convert image URL â base64 string                         */
/* ------------------------------------------------------------------ */
export const urlToBase64 = async (
  url: string,
  opts?: { maxDim?: number; quality?: number }
): Promise<string> => {
  // v22: Higher resolution inputs for better VTO quality
  const MAX = opts?.maxDim ?? 1536;
  const quality = opts?.quality ?? 0.95;
  const res = await fetch(url);
  const blob = await res.blob();
  // Compress via canvas to keep payload under Vercel 4.5MB limit
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
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(dataUrl.split(",")[1]);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
};

/* ------------------------------------------------------------------ */
/*  AI Attribute Detection â calls Gemini API directly                 */
/* ------------------------------------------------------------------ */
export interface DetectedAttributes {
  name: string;
  category: string;
  color: string;
  material: string;
  tags: string[];
  gender: "men" | "women" | "unisex";
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
    const res = await fetch("/api/process-clothing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64, mimeType }),
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
/*  Virtual Try-On â calls Vercel serverless function with face + body */
/* ------------------------------------------------------------------ */
export interface TryOnResult {
  mimeType: string;
  base64: string;
}

// v18: Face refinement now handled server-side by Gemini in virtual-tryon API
// The canvas-based applyFaceComposite has been replaced with Gemini 2.5 Flash Image
// which produces much better results (understands facial structure vs simple pixel blending)

export const virtualTryOn = async (
  bodyImageBase64: string,
  productImageBase64: string,
  sampleCount = 1,
  personDescription?: string,
  faceImageBase64?: string
): Promise<TryOnResult[]> => {
  try {
    const res = await fetch("/api/virtual-tryon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bodyImageBase64,
        faceImageBase64: faceImageBase64 || undefined,
        productImageBase64,
        personDescription: personDescription || undefined,
      }),
    });

    const data = await res.json();
    if (data.success && data.images) {
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
/*  Virtual Try-On (Multi-Garment) â sends all outfit items at once    */
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
  faceImageBase64?: string
): Promise<TryOnResult[]> => {
  try {
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
      }),
    });

    const data = await res.json();
    if (data.success && data.images) {
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
/*  Virtual Try-On (Sequential) â Imagen 3 VTO, one garment at a time */
/*                                                                      */
/*  Step 1: body photo + topwear â result1                             */
/*  Step 2: result1 (as person) + bottomwear â result2                 */
/*  Step 3: result2 (as person) + footwear â final                     */
/*                                                                      */
/*  Imagen 3 VTO preserves identity automatically â no face refinement  */
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
): Promise<TryOnResult[]> => {
  // v17: Imagen 3 VTO + Smart Quality Tiering â fast intermediates, max quality final
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
      // v17: isFinalStep flag â only the last step gets full quality + upscale
      const isLast = i === garments.length - 1;
      const res = await fetch("/api/virtual-tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: i === 0 ? "single" : "sequential-step",
          bodyImageBase64,
          productImages: [{ base64: garment.base64, mimeType: garment.mimeType || "image/jpeg" }],
          // For step 2+: previous result becomes the person image
          previousResultBase64: previousResultBase64 || undefined,
          isFinalStep: isLast,
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
    try {
      const compositedBase64 = await compositeFaceOntoVTO(
        bodyImageBase64, previousResultBase64, "image/jpeg", previousResultMimeType
      );
      if (compositedBase64) {
        console.log("v21 face composite applied successfully");
        return [{ mimeType: "image/png", base64: compositedBase64 }];
      }
    } catch (compErr) {
      console.warn("Face composite failed (non-fatal), returning raw VTO:", compErr);
    }
    return [{ mimeType: previousResultMimeType, base64: previousResultBase64 }];
  }
  return [];
};

/* ------------------------------------------------------------------ */
/*  AI Outfit Recommendation â calls Gemini via serverless function    */
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
