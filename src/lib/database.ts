import { supabase } from "./supabase";

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
  worn_count?: number;
  last_worn?: string;
  laundry_status?: "available" | "in_laundry";
  laundry_sent_at?: string;
  created_at: string;
}

export interface WearLog {
  id: string;
  user_id: string;
  item_id: string;
  worn_at: string;
  outfit_items?: string[]; // IDs of other items worn together
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
/*  Helper: convert any image file to a web-friendly JPEG via canvas   */
/* ------------------------------------------------------------------ */
const toJpegBlob = (file: File): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }
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
  // Convert non-web-friendly formats (HEIC, HEIF, TIFF, etc.) to JPEG
  const webFriendly = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
  let uploadFile: File | Blob = file;
  let ext = file.name.split(".").pop()?.toLowerCase() || "jpg";

  if (!webFriendly.includes(file.type) || ["heic", "heif", "tiff", "tif"].includes(ext)) {
    try {
      uploadFile = await toJpegBlob(file);
      ext = "jpg";
    } catch (err) {
      console.error("Image conversion failed, uploading original:", err);
    }
  }

  const fileName = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(fileName, uploadFile, {
      upsert: true,
      contentType: uploadFile instanceof Blob && uploadFile !== file ? "image/jpeg" : file.type,
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

/* ------------------------------------------------------------------ */
/*  Wear tracking operations                                           */
/* ------------------------------------------------------------------ */
export const logWear = async (
  userId: string,
  itemIds: string[],
): Promise<boolean> => {
  const now = new Date().toISOString();

  // 1. Insert wear_log entries for each item
  const logs = itemIds
    .filter((id) => !id.startsWith("ai-suggested-")) // skip AI virtual items
    .map((id) => ({
      user_id: userId,
      item_id: id,
      worn_at: now,
      outfit_items: itemIds.filter((x) => x !== id),
    }));

  if (logs.length > 0) {
    const { error: logErr } = await supabase.from("wear_log").insert(logs);
    if (logErr) console.error("logWear insert error:", logErr);
  }

  // 2. Increment worn_count & set last_worn on each real item
  for (const id of itemIds) {
    if (id.startsWith("ai-suggested-")) continue;
    // Use RPC or manual update — Supabase JS doesn't have atomic increment,
    // so we fetch current value first (acceptable for low-contention use case)
    const { data: current } = await supabase
      .from("closet_items")
      .select("worn_count")
      .eq("id", id)
      .single();
    const newCount = ((current as any)?.worn_count || 0) + 1;
    await supabase
      .from("closet_items")
      .update({ worn_count: newCount, last_worn: now })
      .eq("id", id);
  }

  return true;
};

export const getWearLogs = async (
  userId: string,
  itemId?: string
): Promise<WearLog[]> => {
  let query = supabase
    .from("wear_log")
    .select("*")
    .eq("user_id", userId)
    .order("worn_at", { ascending: false });
  if (itemId) query = query.eq("item_id", itemId);
  const { data, error } = await query.limit(100);
  if (error) {
    console.error("getWearLogs error:", error);
    return [];
  }
  return data ?? [];
};

/* ------------------------------------------------------------------ */
/*  Laundry operations                                                 */
/* ------------------------------------------------------------------ */
export const sendToLaundry = async (itemIds: string[]): Promise<boolean> => {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("closet_items")
    .update({ laundry_status: "in_laundry", laundry_sent_at: now })
    .in("id", itemIds);
  if (error) {
    console.error("sendToLaundry error:", error);
    return false;
  }
  return true;
};

export const returnFromLaundry = async (itemIds: string[]): Promise<boolean> => {
  const { error } = await supabase
    .from("closet_items")
    .update({ laundry_status: "available", laundry_sent_at: null })
    .in("id", itemIds);
  if (error) {
    console.error("returnFromLaundry error:", error);
    return false;
  }
  return true;
};

export const getLaundryItems = async (userId: string): Promise<ClothingItem[]> => {
  const { data, error } = await supabase
    .from("closet_items")
    .select("*")
    .eq("user_id", userId)
    .eq("laundry_status", "in_laundry")
    .order("laundry_sent_at", { ascending: false });
  if (error) {
    console.error('getLaundryItems error:', error);
    return [];
  }
  return data ?? [];
};
