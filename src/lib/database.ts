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
  size?: string;
  fit_notes?: string;
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
  notif_unworn: boolean;
  notif_laundry: boolean;
  personalization: boolean;
  body_measurements?: Record<string, any>;
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
/*  Helper: read EXIF orientation tag from a JPEG file                  */
/* ------------------------------------------------------------------ */
const getExifOrientation = (file: File): Promise<number> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const view = new DataView(e.target?.result as ArrayBuffer);
      // Not a JPEG
      if (view.getUint16(0, false) !== 0xFFD8) { resolve(1); return; }
      let offset = 2;
      while (offset < view.byteLength) {
        if (view.getUint16(offset, false) === 0xFFE1) {
          // Found APP1 (EXIF)
          const exifOffset = offset + 4;
          // Check "Exif\0\0"
          if (view.getUint32(exifOffset, false) !== 0x45786966) { resolve(1); return; }
          const tiffOffset = exifOffset + 6;
          const littleEndian = view.getUint16(tiffOffset, false) === 0x4949;
          const ifdOffset = tiffOffset + view.getUint32(tiffOffset + 4, littleEndian);
          const tags = view.getUint16(ifdOffset, littleEndian);
          for (let i = 0; i < tags; i++) {
            const tagOffset = ifdOffset + 2 + i * 12;
            if (view.getUint16(tagOffset, littleEndian) === 0x0112) {
              resolve(view.getUint16(tagOffset + 8, littleEndian));
              return;
            }
          }
          resolve(1); return;
        }
        offset += 2 + view.getUint16(offset + 2, false);
      }
      resolve(1);
    };
    reader.onerror = () => resolve(1);
    // Only read first 64KB for EXIF -- much faster than reading entire file
    reader.readAsArrayBuffer(file.slice(0, 65536));
  });

/* ------------------------------------------------------------------ */
/*  Helper: fix EXIF orientation + ensure top-to-bottom via canvas      */
/* ------------------------------------------------------------------ */
export const fixImageOrientation = (file: File): Promise<File> =>
  new Promise(async (resolve, reject) => {
    try {
      const orientation = await getExifOrientation(file);
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        let { naturalWidth: w, naturalHeight: h } = img;

        // Cap dimensions to avoid exceeding iOS Safari canvas pixel limit (~16.7MP)
        const MAX_DIM = 4096;
        if (w > MAX_DIM || h > MAX_DIM) {
          if (w > h) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; }
          else { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; }
        }

        // Determine if EXIF requires a dimension swap (orientations 5-8)
        const needsSwap = orientation >= 5 && orientation <= 8;
        const canvasW = needsSwap ? h : w;
        const canvasH = needsSwap ? w : h;

        const canvas = document.createElement("canvas");
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext("2d");
        if (!ctx) { URL.revokeObjectURL(url); resolve(file); return; }

        // Apply EXIF orientation transform
        switch (orientation) {
          case 2: ctx.transform(-1, 0, 0, 1, canvasW, 0); break;           // flip horizontal
          case 3: ctx.transform(-1, 0, 0, -1, canvasW, canvasH); break;    // rotate 180
          case 4: ctx.transform(1, 0, 0, -1, 0, canvasH); break;           // flip vertical
          case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;                  // transpose
          case 6: ctx.transform(0, 1, -1, 0, canvasH, 0); break;           // rotate 90 CW
          case 7: ctx.transform(0, -1, -1, 0, canvasH, canvasW); break;    // transverse
          case 8: ctx.transform(0, -1, 1, 0, 0, canvasW); break;           // rotate 90 CCW
          default: break; // orientation 1 = no transform needed
        }

        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);

        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            const fixed = new File(
              [blob],
              file.name.replace(/\.[^.]+$/, ".jpg"),
              { type: "image/jpeg" }
            );
            resolve(fixed);
          },
          "image/jpeg",
          0.92
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    } catch {
      resolve(file); // graceful fallback
    }
  });

/* ------------------------------------------------------------------ */
/*  Helper: AI-detected rotation -- apply clockwise rotation degrees    */
/* ------------------------------------------------------------------ */
export const rotateImage = (file: File, degrees: number): Promise<File> =>
  new Promise((resolve) => {
    if (!degrees || degrees === 0) { resolve(file); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      // Cap dimensions to avoid exceeding iOS Safari canvas pixel limit (~16.7MP)
      const MAX_DIM = 4096;
      if (w > MAX_DIM || h > MAX_DIM) {
        if (w > h) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; }
        else { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; }
      }
      const swap = degrees === 90 || degrees === 270;
      const canvas = document.createElement("canvas");
      canvas.width = swap ? h : w;
      canvas.height = swap ? w : h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); resolve(file); return; }
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((degrees * Math.PI) / 180);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.92
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });

/* ------------------------------------------------------------------ */
/*  Helper: convert any image file to a web-friendly JPEG via canvas   */
/* ------------------------------------------------------------------ */
const toJpegBlob = (file: File, maxDim = 4096): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // Cap dimensions to avoid exceeding iOS Safari canvas pixel limit (~16.7MP)
      // iPhone cameras can produce 48MP (8064×6048) which crashes WebKit
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
        else { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error("Canvas not supported")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          blob ? resolve(blob) : reject(new Error("toBlob failed"));
        },
        "image/jpeg",
        0.85
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
/*  Lookbook (VTO images)                                              */
/* ------------------------------------------------------------------ */
export interface LookbookEntry {
  id: string;
  image_url: string;
  item_names: string[];
  created_at: string;
}

export const getLookbook = async (userId: string): Promise<LookbookEntry[]> => {
  try {
    const { data, error } = await supabase
      .from("lookbook")
      .select("id, image_url, item_names, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) { console.error("getLookbook error:", error); return []; }
    return data || [];
  } catch { return []; }
};

export const saveLookbookEntry = async (
  userId: string,
  base64Image: string,
  itemNames: string[]
): Promise<LookbookEntry | null> => {
  try {
    // Upload VTO image to Supabase storage
    const blob = await fetch(base64Image).then(r => r.blob());
    const file = new File([blob], `vto_${Date.now()}.png`, { type: "image/png" });
    const imageUrl = await uploadImage("clothing-images", userId, file);
    if (!imageUrl) return null;

    const { data, error } = await supabase
      .from("lookbook")
      .insert({
        user_id: userId,
        image_url: imageUrl,
        item_names: itemNames,
      })
      .select("id, image_url, item_names, created_at")
      .single();

    if (error) { console.error("saveLookbookEntry error:", error); return null; }
    return data;
  } catch (err) {
    console.error("saveLookbookEntry error:", err);
    return null;
  }
};

export const deleteLookbookEntry = async (userId: string, entryId: string): Promise<void> => {
  const { error } = await supabase.from("lookbook").delete().eq("id", entryId).eq("user_id", userId);
  if (error) console.error("deleteLookbookEntry error:", error);
};

/* ------------------------------------------------------------------ */
/*  Outfit plans (calendar)                                            */
/* ------------------------------------------------------------------ */
export interface OutfitPlan {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  occasion?: string;
  item_ids: string[];
  tip?: string;
  created_at: string;
}

export const getOutfitPlans = async (
  userId: string,
  from?: string,
  to?: string
): Promise<OutfitPlan[]> => {
  let query = supabase
    .from("outfit_plans")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: true });
  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);
  const { data, error } = await query;
  if (error) {
    console.error("getOutfitPlans error:", error);
    return [];
  }
  return data ?? [];
};

export const saveOutfitPlan = async (
  plan: Omit<OutfitPlan, "id" | "created_at">
): Promise<OutfitPlan | null> => {
  const { data, error } = await supabase
    .from("outfit_plans")
    .insert(plan)
    .select()
    .single();
  if (error) {
    console.error("saveOutfitPlan error:", error);
    return null;
  }
  return data;
};

export const deleteOutfitPlan = async (planId: string) => {
  const { error } = await supabase.from("outfit_plans").delete().eq("id", planId);
  if (error) console.error("deleteOutfitPlan error:", error);
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
    // Use RPC or manual update -- Supabase JS doesn't have atomic increment,
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
    console.error("getLaundryItems error:", error);
    return [];
  }
  return data ?? [];
};
