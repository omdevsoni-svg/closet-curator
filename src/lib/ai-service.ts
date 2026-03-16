import { supabase } from "./supabase";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/* ------------------------------------------------------------------ */
/*  Helper: convert File → base64 string (no data: prefix)            */
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
/*  Helper: convert image URL → base64 string                         */
/* ------------------------------------------------------------------ */
export const urlToBase64 = async (url: string): Promise<string> => {
  const res = await fetch(url);
  const blob = await res.blob();
  return fileToBase64(blob as File);
};

/* ------------------------------------------------------------------ */
/*  AI Attribute Detection — calls Gemini API directly                 */
/* ------------------------------------------------------------------ */
export interface DetectedAttributes {
  name: string;
  category: string;
  color: string;
  material: string;
  brand: string;
  tags: string[];
  gender: "men" | "women" | "unisex";
}

export const detectClothingAttributes = async (
  imageBase64: string,
  mimeType = "image/jpeg"
): Promise<DetectedAttributes | null> => {
  try {
    // Call our Vercel serverless function (handles GCP auth + Vertex AI)
    const res = await fetch("/api/process-clothing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64, mimeType }),
    });

    const data = await res.json();
    if (data.success && data.attributes) {
      return data.attributes as DetectedAttributes;
    }
    console.error("AI detection failed:", data.error);
    return null;
  } catch (err) {
    console.error("detectClothingAttributes error:", err);
    return null;
  }
};

/* ------------------------------------------------------------------ */
/*  Virtual Try-On — calls virtual-tryon Edge Function                 */
/* ------------------------------------------------------------------ */
export interface TryOnResult {
  mimeType: string;
  base64: string;
}

export const virtualTryOn = async (
  personImageBase64: string,
  productImageBase64: string,
  sampleCount = 1
): Promise<TryOnResult[]> => {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/virtual-tryon`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ personImageBase64, productImageBase64, sampleCount }),
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
