import { supabase } from "./supabase";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/* ------------------------------------------------------------------ */
/* Helper: convert File Ã¢ÂÂ base64 string (no data: prefix)             */
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
/* Helper: convert image URL Ã¢ÂÂ base64 string                          */
/* ------------------------------------------------------------------ */
export const urlToBase64 = async (url: string): Promise<string> => {
  const res = await fetch(url);
  const blob = await res.blob();
  return fileToBase64(blob as File);
};

/* ------------------------------------------------------------------ */
/* Helper: compress a base64 image to max dimension & JPEG quality    */
/* Keeps payload small so multi-garment requests don't exceed limits  */
/* ------------------------------------------------------------------ */
export const compressBase64Image = (
  base64: string,
  maxDim = 768,
  quality = 0.75,
  inputMime = "image/jpeg"
): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height / width) * maxDim);
          width = maxDim;
        } else {
          width = Math.round((width / height) * maxDim);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(dataUrl.split(",")[1]);
    };
    img.onerror = () => reject(new Error("Failed to load image for compression"));
    img.src = `data:${inputMime};base64,${base64}`;
  });

/* ------------------------------------------------------------------ */
/* AI Attribute Detection Ã¢ÂÂ calls Gemini API directly                  */
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
/* Virtual Try-On Ã¢ÂÂ calls Vercel serverless function with face + body */
/* ------------------------------------------------------------------ */
export interface TryOnResult {
  mimeType: string;
  base64: string;
}

export const virtualTryOn = async (
  bodyImageBase64: string,
  productImageBase64: string,
  sampleCount = 1,
  faceImageBase64?: string
): Promise<TryOnResult[]> => {
  try {
    const res = await fetch("/api/virtual-tryon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        faceImageBase64: faceImageBase64 || undefined,
        bodyImageBase64,
        productImageBase64,
      }),
    });

    const data = await res.json();
    if (data.success && data.images) {
      return data.images as TryOnResult[];
    }
    console.error("Virtual try-on failed:", data.error, data.details);
    return [];
  } catch (err) {
    console.error("virtualTryOn error:", err);
    return [];
  }
};

/* ------------------------------------------------------------------ */
/* Virtual Try-On (Multi-Garment) Ã¢ÂÂ sends all outfit items at once    */
/* Compresses all images first to stay within payload limits          */
/* ------------------------------------------------------------------ */
export interface GarmentInput {
  base64: string;
  mimeType?: string;
  label?: string;
}

export const virtualTryOnMulti = async (
  bodyImageBase64: string,
  garments: GarmentInput[],
  faceImageBase64?: string
): Promise<TryOnResult[]> => {
  try {
    // Compress body image and all garment images to reduce payload
    const compressedBody = await compressBase64Image(bodyImageBase64, 1280, 0.92);
    const compressedGarments = await Promise.all(
      garments.map(async (g) => ({
        base64: await compressBase64Image(g.base64, 512, 0.70, g.mimeType || "image/jpeg"),
        mimeType: "image/jpeg",
        label: g.label,
      }))
    );

    console.log(
      "[virtualTryOnMulti] Sending",
      compressedGarments.length,
      "garments. Payload sizes Ã¢ÂÂ body:",
      Math.round(compressedBody.length / 1024) + "KB",
      "garments:",
      compressedGarments.map((g) => Math.round(g.base64.length / 1024) + "KB").join(", ")
    );

    const res = await fetch("/api/virtual-tryon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        faceImageBase64: faceImageBase64 ? await compressBase64Image(faceImageBase64, 512, 0.70) : undefined,
        bodyImageBase64: compressedBody,
        productImages: compressedGarments,
      }),
    });

    const data = await res.json();
    if (data.success && data.images) {
      return data.images as TryOnResult[];
    }

    // Surface the actual error for debugging
    const errMsg = data.error || "Unknown error";
    const details = data.details || "";
    console.error("Virtual try-on (multi) failed:", errMsg, details);

    // Throw so the caller can display the real error
    throw new Error(errMsg);
  } catch (err: any) {
    console.error("virtualTryOnMulti error:", err);
    throw err; // Re-throw so handleTryOn can show the real message
  }
};

/* ------------------------------------------------------------------ */
/* AI Outfit Recommendation Ã¢ÂÂ calls Gemini via serverless function    */
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
/* Upload try-on result to Supabase Storage                           */
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
