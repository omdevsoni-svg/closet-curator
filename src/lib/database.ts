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

export const toggleFavorite = async (itemId: string, favorite: boolean) => {
  const { error } = await supabase
    .from("closet_items")
    .update({ favorite })
    .eq("id", itemId);
  if (error) console.error("toggleFavorite error:", error);
  return { error };
};

/* ------------------------------------------------------------------ */
/*  Image upload to Supabase Storage                                   */
/* ------------------------------------------------------------------ */
export const uploadImage = async (
  bucket: string,
  userId: string,
  file: File
): Promise<string | null> => {
  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(fileName, file, { upsert: true });

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
