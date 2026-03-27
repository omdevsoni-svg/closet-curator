import { useState, useRef, useEffect } from "react";
import {
  Plus,
  Search,
  Mic,
  MicOff,
  SlidersHorizontal,
  X,
  Camera,
  ImageIcon,
  Upload,
  Heart,
  Trash2,
  Loader2,
  Sparkles,
  AlertCircle,
  Archive,
  ArchiveRestore,
  Clock,
  WashingMachine,
  CheckCircle2,
  CalendarCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import {
  getClosetItems,
  addClosetItem,
  deleteClosetItem,
  toggleFavorite,
  toggleArchive,
  updateClosetItem,
  uploadImage,
  logWear,
  sendToLaundry,
  returnFromLaundry,
  type ClothingItem,
} from "@/lib/database";
import { detectClothingAttributes, fileToBase64, suggestEthnicPairing, type DetectionResult, type SuggestedEthnicItem } from "@/lib/ai-service";
import { fuzzySearch } from "@/lib/fuzzySearch";
import heic2any from "heic2any";

const isHeicFile = (file: File): boolean => {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const heicTypes = [
    "image/heic",
    "image/heif",
    "image/heic-sequence",
    "image/heif-sequence",
  ];
  return heicTypes.includes(file.type) || ["heic", "heif"].includes(ext);
};

const categories = ["All", "Tops", "Bottoms", "Outerwear", "Footwear", "Dresses", "Accessories", "Activewear", "Ethnic Wear", "In Laundry"];
const colorOptions = ["Black", "White", "Navy", "Blue", "Red", "Green", "Beige", "Grey", "Pink", "Brown"];
const categoryOptions = ["Tops", "Bottoms", "Outerwear", "Footwear", "Dresses", "Accessories", "Activewear"];