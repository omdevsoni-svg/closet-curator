import { supabase } from "./supabase";
import heic2any from "heic2any";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
export interface ClothingItem {
  id: string;
  user_id: string;
  name: string;
  category: string;
  color: string;
  tags: string[];
  purchase_type: "new" | "pre-loved";
  price?: number;
  image_url: string;
  gender: "women" | "men" | "unisex";
  brand?: string;
  material?: string;
  favorite: boolean;
  archived?: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  body_type: string;
  skin_tone: string;
  model_gender: "women" | "men" | "neutral";
  face_image_url?: string;
  body_image_url?: string;
  notif_outfits: boolean;
  notif_gaps: boolean;
  personalization: boolean;
  created_at: string;
  updated_at: string;
}

export interface StylistHistory {
  id: string;
  user_id: string;
  occasion: string;
  prompt?: string;
  result_items: { name: string; image_url: string; item_id?: string }[];
  tip: string;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/*  Profile operations                                                 */
/* ------------------------------------------------------------------ */
export const getProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) {
    console.error("getProfile error:", error);
    return null;
  }
  return data;
};

export const updateProfile = async (
  userId: string,
  updates: Partial<Omit<Profile, "id" | "created_at">>
) => {
  const { data, error } = await supabase
    .from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select()
    .single();
  if (error) console.error("updateProfile error:", error);
  return { data, error };
};

/* ------------------------------------------------------------------ */
/*  Closet item operations                                             */
/* ------------------------------------------------------------------ */
export const getClosetItems = async (userId: string): Promise<ClothingItem[]> => {
  const { data, error } = await supabase
    .from("closet_items")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getClosetItems error:", error);
    return [];
  }
  return data ?? [];
};

export const addClosetItem = async (
  item: Omit<ClothingItem, "id" | "created_at">
): Promise<ClothingItem | null> => {
  const { data, error } = await supabase
    .from("closet_items")
    .insert(item)
    .select()
    .single();
  if (error) {
    console.error("addClosetItem error:", error);
    return null;
  }
  return data;
};

export const deleteClosetItem = async (itemId: string) => {
  const { error } = await supabase
    .from("closet_items")
    .delete()
    .eq("id", itemId);
  if (error) console.error("deleteClosetItem error:", error);
  return { error };
};

export const updateClosetItem = async (
  itemId: string,
  updates: Partial<Omit<ClothingItem, "id" | "user_id" | "created_at">>
) => {
  const { data, error } = await supabase
    .from("closet_items")
    .update(updates)
    .eq("id", itemId)
    .select()
    .single();
  if (error) console.error("updateClosetItem error:", error);
  return data as ClothingItem | null;
};

export const toggleFavorite = async (itemId: string, favorite: boolean) => {
  const { error } = await supabase
    .from("closet_items")
    .update({ favorite })
    .eq("id", itemId);
  if (error) console.error("toggleFavorite error:", error);
  return { error };
};

export const toggleArchive = async (itemId: string, archived: boolean) => {
  const { error } = await supabase
    .from("closet_items")
    .update({ archived })
    .eq("id", itemId);
  if (error) console.error("toggleArchive error:", error);
  return { error };
};

/* ------------------------------------------------------------------ */
/*  Helper: detect if a file is HEIC/HEIF format                       */
/* ------------------------------------------------------------------ */
const isHeicFile = (file: File): boolean => {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const heicTypes = ["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"];
  return heicTypes.includes(file.type) || ["heic", "heif"].includes(ext);
};

/* ------------------------------------------------------------------ */
/*  Helper: convert HEIC/HEIF to JPEG using heic2any library           */
/*  (browsers cannot natively decode Apple's HEIC format)              */
/* ------------------------------------------------------------------ */
const convertHeicToJpeg = async (file: File): Promise<Blob> => {
  const result = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.9,
  });
  // heic2any can return a single Blob or an array
  return Array.isArray(result) ? result[0] : result;
};

/* ------------------------------------------------------------------ */
/*  Helper: convert any browser-supported image to JPEG via canvas     */
/* ------------------------------------------------------------------ */
const toJpegViaCanvas = (file: File): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error("Canvas not supported")); return; }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          blob ? resolve(blob) : reject(new Error("toBlob failed"));
        },
        "image/jpeg",
        0.9
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });

/* ------------------------------------------------------------------ */
/*  Image upload to Supabase Storage                                   */
/* ------------------------------------------------------------------ */
export const uploadImage = async (
  bucket: string,
  userId: string,
  file: File
): Promise<string | null> => {
  const webFriendly = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
  let uploadBlob: File | Blob = file;
  let ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  let contentType = file.type || "application/octet-stream";

  try {
    if (isHeicFile(file)) {
      // HEIC/HEIF: browsers cannot decode these â use heic2any JS decoder
      uploadBlob = await convertHeicToJpeg(file);
      ext = "jpg";
      contentType = "image/jpeg";
    } else if (!webFriendly.includes(file.type)) {
      // Other non-standard formats: try canvas conversion
      uploadBlob = await toJpegViaCanvas(file);
      ext = "jpg";
      contentType = "image/jpeg";
    }
  } catch (err) {
    console.error("Image conversion failed, uploading original:", err);
    // If conversion fails, we still try to upload the original
  }

  const fileName = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(fileName, uploadBlob, {
      upsert: true,
      contentType,
    });

  if (error) {
    console.error("uploadImage error:", error);
    return null;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
  return data.publicUrl;
};

/* ------------------------------------------------------------------ */
/*  Stylist history operations                                         */
/* ------------------------------------------------------------------ */
export const getStylistHistory = async (userId: string): Promise<StylistHistory[]> => {
  const { data, error } = await supabase
    .from("stylist_history")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    console.error("getStylistHistory error:", error);
    return [];
  }
  return data ?? [];
};

export const saveStylistResult = async (
  entry: Omit<StylistHistory, "id" | "created_at">
): Promise<StylistHistory | null> => {
  const { data, error } = await supabase
    .from("stylist_history")
    .insert(entry)
    .select()
    .single();
  if (error) {
    console.error("saveStylistResult error:", error);
    return null;
  }
  return data;
};

/* ------------------------------------------------------------------ */
/*  Stats helpers                                                      */
/* ------------------------------------------------------------------ */
export const getClosetStats = async (userId: string) => {
  const items = await getClosetItems(userId);
  const totalItems = items.length;
  const favorites = items.filter((i) => i.favorite).length;
  const categories = new Set(items.map((i) => i.category));
  const styleScore =
    totalItems > 0 ? Math.min(100, Math.round((categories.size / 7) * 100)) : 0;

  return { totalItems, favorites, styleScore, items };
};
