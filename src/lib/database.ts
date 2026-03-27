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
