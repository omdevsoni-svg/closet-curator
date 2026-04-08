import { useState, useRef, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Plus,
  Search,
  Mic,
  MicOff,
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
  SlidersHorizontal,
  Check,
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
  fixImageOrientation,
  rotateImage,
  logWear,
  sendToLaundry,
  returnFromLaundry,
  type ClothingItem,
} from "@/lib/database";
import { detectClothingAttributes, fileToBase64, suggestEthnicPairing, type DetectionResult, type SuggestedEthnicItem } from "@/lib/ai-service";
import { fuzzySearch } from "@/lib/fuzzySearch";
import heic2any from "heic2any";

/* ------------------------------------------------------------------ */
/*  HEIC detection helper                                              */
/* ------------------------------------------------------------------ */
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
const colorOptions = ["Black", "White", "Navy", "Blue", "Red", "Green", "Beige", "Grey", "Pink", "Brown", "Cream", "Olive", "Burgundy", "Teal", "Coral", "Lavender", "Purple", "Orange", "Yellow", "Tan", "Charcoal", "Khaki", "Gold", "Maroon", "Mustard", "Rust", "Turquoise", "Ivory", "Multicolor"];
const categoryOptions = ["Tops", "Bottoms", "Outerwear", "Footwear", "Dresses", "Accessories", "Activewear"];

/* ------------------------------------------------------------------ */
/*  Add Item Modal                                                     */
/* ------------------------------------------------------------------ */
interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: ClothingItem) => void;
  userId: string;
}

const AddItemModal = ({ isOpen, onClose, onAdd, userId }: AddItemModalProps) => {
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("");
  const [gender, setGender] = useState<"women" | "men" | "unisex">("unisex");
  const [color, setColor] = useState("");
  const [tags, setTags] = useState("");
  const [purchaseType, setPurchaseType] = useState<"new" | "pre-loved">("new");
  const [price, setPrice] = useState("");
  const [brand, setBrand] = useState("");
  const [material, setMaterial] = useState("");
  const [size, setSize] = useState("");
  const [fitNotes, setFitNotes] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiDetecting, setAiDetecting] = useState(false);
  const [aiDetected, setAiDetected] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [aiRejection, setAiRejection] = useState<string | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // reset input so same file can be re-selected

    let processedFile: File = file;

    // Convert HEIC/HEIF to JPEG so browsers & AI can handle it
    if (isHeicFile(file)) {
      try {
        const result = await heic2any({
          blob: file,
          toType: "image/jpeg",
          quality: 0.9,
        });
        const jpegBlob = Array.isArray(result) ? result[0] : result;
        processedFile = new File(
          [jpegBlob],
          file.name.replace(/\.(heic|heif)$/i, ".jpg"),
          { type: "image/jpeg" }
        );
      } catch (err) {
        console.error("HEIC conversion error:", err);
        // Fall through with original file as best-effort
      }
    }

    // Fix EXIF orientation so the image is always upright (top-to-bottom)
    processedFile = await fixImageOrientation(processedFile);

    setImageFile(processedFile);
    setImagePreview(URL.createObjectURL(processedFile));

    // Auto-detect attributes using AI
    setAiDetecting(true);
    setAiDetected(false);
    setAiError(false);
    setAiRejection(null);
    try {
      const base64 = await fileToBase64(processedFile);
      const result = await detectClothingAttributes(
        base64,
        processedFile.type || "image/jpeg"
      );

      if (result.success && "attributes" in result) {
        const attrs = result.attributes;
        if (attrs.name) setItemName(attrs.name);
        if (attrs.category) setCategory(attrs.category);
        if (attrs.color) setColor(attrs.color);
        if (attrs.gender) setGender(attrs.gender as "women" | "men" | "unisex");
        // Brand is intentionally NOT set by AI -- user must enter it manually
        if (attrs.material) setMaterial(attrs.material);
        if (attrs.tags?.length) setTags(attrs.tags.join(", "));

        // Use AI-enhanced catalog image if available
        if (result.enhancedImage) {
          const enhancedDataUrl = `data:${result.enhancedImage.mimeType};base64,${result.enhancedImage.base64}`;
          // Convert data URL to File for upload
          const resp = await fetch(enhancedDataUrl);
          const blob = await resp.blob();
          let enhancedFile = new File([blob], "enhanced.png", { type: result.enhancedImage.mimeType });
          // Also apply AI-detected rotation to enhanced image if needed
          if (attrs.rotation_needed && attrs.rotation_needed > 0) {
            enhancedFile = await rotateImage(enhancedFile, attrs.rotation_needed);
          }
          setImageFile(enhancedFile);
          setImagePreview(URL.createObjectURL(enhancedFile));
        } else if (attrs.rotation_needed && attrs.rotation_needed > 0) {
          // No enhanced image -- apply AI-detected rotation to fix orientation
          const rotated = await rotateImage(processedFile, attrs.rotation_needed);
          setImageFile(rotated);
          setImagePreview(URL.createObjectURL(rotated));
        }

        setAiDetected(true);
      } else if ("is_garment" in result && result.is_garment === false) {
        // Non-garment image -- reject and clear preview
        setAiRejection(result.rejection_reason);
        setImageFile(null);
        setImagePreview(null);
      } else {
        setAiError(true);
      }
    } catch (err) {
      console.error("AI detection error:", err);
      setAiError(true);
    } finally {
      setAiDetecting(false);
    }
  };

  const resetForm = () => {
    setItemName("");
    setCategory("");
    setGender("unisex");
    setColor("");
    setTags("");
    setPurchaseType("new");
    setPrice("");
    setBrand("");
    setMaterial("");
    setSize("");
    setFitNotes("");
    setImageFile(null);
    setImagePreview(null);
    setAiDetecting(false);
    setAiDetected(false);
    setAiError(false);
    setAiRejection(null);
  };

  // Close and reset -- prevents stale preview on reopen
  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!itemName || !category) return;
    setSaving(true);

    let imageUrl = "";
    if (imageFile) {
      const url = await uploadImage("clothing-images", userId, imageFile);
      if (url) imageUrl = url;
    }

    const newItem = await addClosetItem({
      user_id: userId,
      name: itemName,
      category,
      color: color || "Unspecified",
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      purchase_type: purchaseType,
      price: price ? parseFloat(price) : undefined,
      image_url: imageUrl,
      gender,
      brand: brand || undefined,
      material: material || undefined,
      size: size || undefined,
      fit_notes: fitNotes || undefined,
      favorite: false,
    });

    setSaving(false);

    if (newItem) {
      onAdd(newItem);
      resetForm();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center pb-20 sm:items-center sm:pb-0"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
            className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-background p-6 pb-24 sm:rounded-3xl sm:pb-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-bold text-foreground">
                Add New Item
              </h2>
              <button
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Photo upload */}
            <div className="mt-5">
              <label className="text-xs font-medium font-body uppercase tracking-wider text-muted-foreground">
                Photo
              </label>
              {imagePreview ? (
                <div className="relative mt-3 aspect-square w-full max-w-[200px] mx-auto overflow-hidden rounded-xl bg-card">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-full w-full object-cover"
                  />
                  <button
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                    }}
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-card py-6 text-sm font-body text-muted-foreground transition-colors hover:border-muted-foreground">
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
                    <Camera className="h-5 w-5" />
                    Camera
                  </label>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-card py-6 text-sm font-body text-muted-foreground transition-colors hover:border-muted-foreground">
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    <ImageIcon className="h-5 w-5" />
                    Gallery
                  </label>
                </div>
              )}
            </div>

            {/* AI Detection Status */}
            {aiDetecting && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-center gap-2 rounded-xl bg-ai/10 px-4 py-2.5"
              >
                <Loader2 className="h-4 w-4 animate-spin text-ai" />
                <span className="text-xs font-body text-ai font-medium">
                  AI is analyzing your clothing...
                </span>
              </motion.div>
            )}
            {aiDetected && !aiDetecting && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-center gap-2 rounded-xl bg-green-500/10 px-4 py-2.5"
              >
                <Sparkles className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-xs font-body text-green-700 dark:text-green-400 font-medium">
                  AI auto-filled details -- review and adjust below
                </span>
              </motion.div>
            )}
            {aiError && !aiDetecting && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-2.5"
              >
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-xs font-body text-destructive font-medium">
                  AI detection unavailable -- please fill in details manually
                </span>
              </motion.div>
            )}
            {aiRejection && !aiDetecting && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 rounded-xl bg-amber-500/10 px-4 py-3"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <span className="text-xs font-body font-semibold text-amber-700 dark:text-amber-300">
                      Not a garment image
                    </span>
                    <p className="mt-0.5 text-[11px] font-body text-amber-600 dark:text-amber-400">
                      {aiRejection}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Item Name */}
            <div className="mt-4">
              <label className="text-xs font-medium font-body uppercase tracking-wider text-muted-foreground">
                Item Name *
              </label>
              <input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g., Blue Denim Jacket"
                className="mt-1.5 h-11 w-full rounded-xl border border-border bg-card px-4 text-sm font-body text-foreground placeholder:text-muted-foreground outline-none focus:border-ai focus:ring-2 focus:ring-ai/20"
              />
            </div>

            {/* Category */}
            <div className="mt-4">
              <label className="text-xs font-medium font-body uppercase tracking-wider text-muted-foreground">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-border bg-card px-4 text-sm font-body text-foreground outline-none focus:border-ai focus:ring-2 focus:ring-ai/20 appearance-none"
              >
                <option value="">Select category</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Gender */}
            <div className="mt-4">
              <label className="text-xs font-medium font-body uppercase tracking-wider text-muted-foreground">
                For *
              </label>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {(["women", "men", "unisex"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className={`rounded-xl py-2.5 text-sm font-body font-medium capitalize transition-all ${
                      gender === g
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div className="mt-4">
              <label className="text-xs font-medium font-body uppercase tracking-wider text-muted-foreground">
                Color
              </label>
              <select
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-border bg-card px-4 text-sm font-body text-foreground outline-none focus:border-ai focus:ring-2 focus:ring-ai/20 appearance-none"
              >
                <option value="">Select color</option>
              {color && !colorOptions.includes(color) && (
                <option key={color} value={color}>{color} (detected)</option>
              )}
              {colorOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Brand */}
            <div className="mt-4">
              <label className="text-xs font-medium font-body uppercase tracking-wider text-muted-foreground">
                Brand <span className="normal-case text-muted-foreground/60">(optional)</span>
              </label>
              <input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g., Zara, H&M"
                className="mt-1.5 h-11 w-full rounded-xl border border-border bg-card px-4 text-sm font-body text-foreground placeholder:text-muted-foreground outline-none focus:border-ai focus:ring-2 focus:ring-ai/20"
              />
            </div>

            {/* Material */}
            <div className="mt-4">
              <label className="text-xs font-medium font-body uppercase tracking-wider text-muted-foreground">
                Material <span className="normal-case text-muted-foreground/60">(optional)</span>
              </label>
              <input
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                placeholder="e.g., Cotton, Polyester, Denim"
                className="mt-1.5 h-11 w-full rounded-xl border border-border bg-card px-4 text-sm font-body text-foreground placeholder:text-muted-foreground outline-none focus:border-ai focus:ring-2 focus:ring-ai/20"
              />
            </div>

            {/* Size & Fit */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium font-body uppercase tracking-wider text-muted-foreground">
                  Size <span className="normal-case text-muted-foreground/60">(optional)</span>
                </label>
                <input
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  placeholder="e.g., M, 32, EU 42"
                  className="mt-1.5 h-11 w-full rounded-xl border border-border bg-card px-4 text-sm font-body text-foreground placeholder:text-muted-foreground outline-none focus:border-ai focus:ring-2 focus:ring-ai/20"
                />
              </div>
              <div>
                <label className="text-xs font-medium font-body uppercase tracking-wider text-muted-foreground">
                  Fit <span className="normal-case text-muted-foreground/60">(optional)</span>
                </label>
                <select
                  value={fitNotes}
                  onChange={(e) => setFitNotes(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-border bg-card px-4 text-sm font-body text-foreground outline-none focus:border-ai focus:ring-2 focus:ring-ai/20"
                >
                  <option value="">Select fit...</option>
                  <option value="Slim fit">Slim fit</option>
                  <option value="Regular fit">Regular fit</option>
                  <option value="Relaxed fit">Relaxed fit</option>
                  <option value="Oversized">Oversized</option>
                  <option value="Runs small">Runs small</option>
                  <option value="Runs large">Runs large</option>
                  <option value="True to size">True to size</option>
                </select>
              </div>
            </div>

            {/* Tags */}
            <div className="mt-4">
              <label className="text-xs font-medium font-body uppercase tracking-wider text-muted-foreground">
                Tags <span className="normal-case text-muted-foreground/60">(comma separated)</span>
              </label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., casual, summer, work"
                className="mt-1.5 h-11 w-full rounded-xl border border-border bg-card px-4 text-sm font-body text-foreground placeholder:text-muted-foreground outline-none focus:border-ai focus:ring-2 focus:ring-ai/20"
              />
            </div>

            {/* Purchase Type */}
            <div className="mt-4">
              <label className="text-xs font-medium font-body uppercase tracking-wider text-muted-foreground">
                Purchase Type
              </label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPurchaseType("new")}
                  className={`rounded-xl py-2.5 text-sm font-body font-medium transition-all ${
                    purchaseType === "new"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  New
                </button>
                <button
                  onClick={() => setPurchaseType("pre-loved")}
                  className={`rounded-xl py-2.5 text-sm font-body font-medium transition-all ${
                    purchaseType === "pre-loved"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Pre-loved
                </button>
              </div>
            </div>

            {/* Purchase Price */}
            <div className="mt-4">
              <label className="text-xs font-medium font-body uppercase tracking-wider text-muted-foreground">
                Purchase Price <span className="normal-case text-muted-foreground/60">(optional)</span>
              </label>
              <div className="relative mt-1.5">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g., 1500"
                  className="h-11 w-full rounded-xl border border-border bg-card pl-8 pr-4 text-sm font-body text-foreground placeholder:text-muted-foreground outline-none focus:border-ai focus:ring-2 focus:ring-ai/20"
                />
              </div>
            </div>

            {/* Submit */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleSubmit}
              disabled={!itemName || !category || saving}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-display font-semibold transition-all disabled:opacity-40"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Add to Closet
                </>
              )}
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ------------------------------------------------------------------ */
/*  Batch Quick Add Modal                                               */
/* ------------------------------------------------------------------ */
interface BatchItem {
  file: File;
  preview: string;
  status: "pending" | "detecting" | "detected" | "error" | "rejected" | "saving" | "saved";
  name: string;
  category: string;
  color: string;
  gender: "women" | "men" | "unisex";
  tags: string;
  brand: string;
  material: string;
  enhancedFile?: File;
  enhancedPreview?: string;
  rejectionReason?: string;
}

interface BatchAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (items: ClothingItem[]) => void;
  userId: string;
}

const BatchAddModal = ({ isOpen, onClose, onAdd, userId }: BatchAddModalProps) => {
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = "";

    // Convert files -> BatchItem entries
    const newItems: BatchItem[] = [];
    for (const file of files) {
      let processedFile = file;
      if (isHeicFile(file)) {
        try {
          const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
          const jpegBlob = Array.isArray(result) ? result[0] : result;
          processedFile = new File([jpegBlob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
        } catch { /* fall through */ }
      }
      newItems.push({
        file: processedFile,
        preview: URL.createObjectURL(processedFile),
        status: "pending",
        name: "",
        category: "",
        color: "",
        gender: "unisex",
        tags: "",
        brand: "",
        material: "",
      });
    }
    const startIdx = batchItems.length;
    setBatchItems((prev) => [...prev, ...newItems]);

    // Process each through AI detection sequentially
    setProcessing(true);
    for (let idx = startIdx; idx < startIdx + newItems.length; idx++) {
      const item = newItems[idx - startIdx];
      setBatchItems((prev) =>
        prev.map((b, i) => (i === idx ? { ...b, status: "detecting" } : b))
      );
      try {
        const base64 = await fileToBase64(item.file);
        const result = await detectClothingAttributes(base64, item.file.type || "image/jpeg");
        if (result.success && "attributes" in result) {
          const attrs = result.attributes;
          let enhancedFile: File | undefined;
          let enhancedPreview: string | undefined;
          if (result.enhancedImage) {
            const dataUrl = `data:${result.enhancedImage.mimeType};base64,${result.enhancedImage.base64}`;
            const resp = await fetch(dataUrl);
            const blob = await resp.blob();
            enhancedFile = new File([blob], "enhanced.png", { type: result.enhancedImage.mimeType });
            enhancedPreview = dataUrl;
          }
          setBatchItems((prev) =>
            prev.map((b, i) =>
              i === idx
                ? {
                    ...b,
                    status: "detected",
                    name: attrs.name || "",
                    category: attrs.category || "",
                    color: attrs.color || "",
                    gender: (attrs.gender as "women" | "men" | "unisex") || "unisex",
                    material: attrs.material || "",
                    tags: attrs.tags?.join(", ") || "",
                    enhancedFile,
                    enhancedPreview,
                  }
                : b
            )
          );
        } else if ("is_garment" in result && result.is_garment === false) {
          setBatchItems((prev) =>
            prev.map((b, i) =>
              i === idx ? { ...b, status: "rejected", rejectionReason: result.rejection_reason } : b
            )
          );
        } else {
          setBatchItems((prev) =>
            prev.map((b, i) => (i === idx ? { ...b, status: "error" } : b))
          );
        }
      } catch {
        setBatchItems((prev) =>
          prev.map((b, i) => (i === idx ? { ...b, status: "error" } : b))
        );
      }
    }
    setProcessing(false);
  };

  const removeItem = (idx: number) => {
    setBatchItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveAll = async () => {
    const saveable = batchItems.filter(
      (b) => b.status === "detected" && b.name && b.category
    );
    if (saveable.length === 0) return;

    setSaving(true);
    const savedItems: ClothingItem[] = [];

    for (let i = 0; i < batchItems.length; i++) {
      const b = batchItems[i];
      if (b.status !== "detected" || !b.name || !b.category) continue;

      setBatchItems((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, status: "saving" } : item))
      );

      const fileToUpload = b.enhancedFile || b.file;
      let imageUrl = "";
      const url = await uploadImage("clothing-images", userId, fileToUpload);
      if (url) imageUrl = url;

      const newItem = await addClosetItem({
        user_id: userId,
        name: b.name,
        category: b.category,
        color: b.color || "Unspecified",
        tags: b.tags.split(",").map((t) => t.trim()).filter(Boolean),
        purchase_type: "new",
        image_url: imageUrl,
        gender: b.gender,
        brand: b.brand || undefined,
        material: b.material || undefined,
        favorite: false,
      });

      if (newItem) {
        savedItems.push(newItem);
        setBatchItems((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: "saved" } : item))
        );
      }
    }

    setSaving(false);
    if (savedItems.length > 0) {
      onAdd(savedItems);
    }
    setBatchItems([]);
    onClose();
  };

  const handleClose = () => {
    if (!saving) {
      setBatchItems([]);
      onClose();
    }
  };

  const saveableCount = batchItems.filter(
    (b) => b.status === "detected" && b.name && b.category
  ).length;

  const savedCount = batchItems.filter((b) => b.status === "saved").length;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
            className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-background p-6 pb-24 sm:rounded-3xl sm:pb-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-bold text-foreground">
                Quick Add -- Batch
              </h2>
              <button
                onClick={handleClose}
                disabled={saving}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs font-body text-muted-foreground">
              Select multiple photos and AI will detect each item automatically.
            </p>

            {/* Upload area */}
            <div className="mt-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFilesSelected}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={processing || saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-card py-5 text-sm font-body text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-50"
              >
                <Upload className="h-5 w-5" />
                {batchItems.length === 0
                  ? "Select Photos"
                  : "Add More Photos"}
              </button>
            </div>

            {/* Items list */}
            {batchItems.length > 0 && (
              <div className="mt-4 space-y-3">
                {batchItems.map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3 rounded-xl bg-card p-3 border border-border"
                  >
                    {/* Thumbnail */}
                    <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-background">
                      <img
                        src={item.enhancedPreview || item.preview}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      {item.status === "pending" && (
                        <p className="text-xs font-body text-muted-foreground">Waiting...</p>
                      )}
                      {item.status === "detecting" && (
                        <div className="flex items-center gap-1.5">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-ai" />
                          <p className="text-xs font-body text-ai font-medium">AI analyzing...</p>
                        </div>
                      )}
                      {item.status === "detected" && (
                        <>
                          <p className="text-xs font-body font-semibold text-foreground truncate">
                            {item.name || "Unnamed"}
                          </p>
                          <p className="text-[10px] font-body text-muted-foreground">
                            {item.category} · {item.color}
                          </p>
                          {item.tags && (
                            <p className="text-[9px] font-body text-muted-foreground/70 truncate mt-0.5">
                              {item.tags}
                            </p>
                          )}
                        </>
                      )}
                      {item.status === "rejected" && (
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                          <p className="text-xs font-body text-amber-600 dark:text-amber-400">
                            Not a garment
                          </p>
                        </div>
                      )}
                      {item.status === "error" && (
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                          <p className="text-xs font-body text-destructive">Detection failed</p>
                        </div>
                      )}
                      {item.status === "saving" && (
                        <div className="flex items-center gap-1.5">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                          <p className="text-xs font-body text-primary font-medium">Saving...</p>
                        </div>
                      )}
                      {item.status === "saved" && (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                          <p className="text-xs font-body text-green-600 dark:text-green-400 font-medium">Saved!</p>
                        </div>
                      )}
                    </div>
                    {/* Remove */}
                    {!saving && item.status !== "saved" && (
                      <button
                        onClick={() => removeItem(idx)}
                        className="shrink-0 self-start text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {/* Progress bar when saving */}
            {saving && batchItems.length > 0 && (
              <div className="mt-4">
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(savedCount / batchItems.filter(b => b.status === "saving" || b.status === "saved" || b.status === "detected").length) * 100}%`,
                    }}
                  />
                </div>
                <p className="mt-1.5 text-center text-xs font-body text-muted-foreground">
                  Saving {savedCount} of {saveableCount}...
                </p>
              </div>
            )}

            {/* Save all button */}
            {batchItems.length > 0 && !saving && (
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleSaveAll}
                disabled={saveableCount === 0 || processing}
                className="mt-5 h-12 w-full rounded-xl bg-gradient-to-r from-[hsl(43,72%,50%)] to-[hsl(220,12%,68%)] text-white font-display font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    AI Processing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Save {saveableCount} {saveableCount === 1 ? "Item" : "Items"}
                  </>
                )}
              </motion.button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ------------------------------------------------------------------ */
/*  Formality inference & auto-pairing helpers (for single-item Try On) */
/* ------------------------------------------------------------------ */

const ACTIVEWEAR_BOTTOM_RE = /\b(jogger|track\s?pant|sweat\s?pant|legging|short|tight|cargo\s?pant)\b/i;
const ACTIVEWEAR_SHOE_RE = /\b(sneaker|trainer|running\s?shoe|sport\s?shoe|athletic\s?shoe|slipper|slide|croc|flip[\s-]?flop)\b/i;
const ETHNIC_TOP_RE = /\b(kurta|sherwani|nehru|bandhgala|achkan|angrakha|bandi|waistcoat|jacket|vest|tunic)\b/i;
const ETHNIC_BOTTOM_RE = /\b(pajama|pyjama|churidar|dhoti|lungi|salwar|shalwar|pant|trouser|bottom|leheng)\b/i;
const ETHNIC_SHOE_RE = /\b(jutti|mojari|mojri|kolhapuri|sandal|chappal|shoe|slipper|khussa)\b/i;

function inferFormality(item: ClothingItem): "formal" | "smart-casual" | "casual" | "sporty" | "ethnic" {
  const text = [item.name, ...(item.tags || []), item.material || "", item.brand || ""].join(" ").toLowerCase();
  if (text.match(/\b(kurta|sherwani|nehru|ethnic|traditional|bandhgala|achkan|angrakha|jutti|mojari|kolhapuri|pajama|churidar|dhoti)\b/)) return "ethnic";
  if (text.match(/\b(sport|athletic|gym|running|jogger|track|sneaker|trainer|activewear|workout|yoga|legging)\b/)) return "sporty";
  if (text.match(/\b(formal|suit|blazer|dress\s?shoe|oxford|loafer|heel|pump|derby|brogue|chino|trouser|silk|satin|linen\s?pant|wool|cashmere|office|business|tie|cufflink)\b/)) return "formal";
  if (text.match(/\b(polo|button|collar|boot|chelsea|suede|leather|khaki|slim|fitted|cardigan|knit|smart|semi)\b/)) return "smart-casual";
  return "casual";
}

const FORMALITY_COMPAT: Record<string, string[]> = {
  formal: ["formal", "smart-casual"],
  "smart-casual": ["formal", "smart-casual", "casual"],
  casual: ["smart-casual", "casual", "sporty"],
  sporty: ["casual", "sporty"],
  ethnic: ["ethnic"],
};

type ItemRole = "top" | "bottom" | "footwear" | "dress" | "ethnic-top" | "ethnic-bottom" | "ethnic-footwear" | "accessory";

function classifyRole(item: ClothingItem): ItemRole {
  const text = [item.name, ...(item.tags || [])].join(" ");

  // Check ethnic patterns FIRST -- items may be stored under generic categories like "Tops"
  if (item.category === "Ethnic Wear" || ETHNIC_TOP_RE.test(text)) {
    if (ETHNIC_BOTTOM_RE.test(text)) return "ethnic-bottom";
    if (ETHNIC_SHOE_RE.test(text)) return "ethnic-footwear";
    if (ETHNIC_TOP_RE.test(text)) return "ethnic-top";
  }
  if (ETHNIC_BOTTOM_RE.test(text) && inferFormality(item) === "ethnic") return "ethnic-bottom";
  if (ETHNIC_SHOE_RE.test(text) && inferFormality(item) === "ethnic") return "ethnic-footwear";

  if (item.category === "Activewear") {
    if (ACTIVEWEAR_BOTTOM_RE.test(item.name)) return "bottom";
    if (ACTIVEWEAR_SHOE_RE.test(item.name)) return "footwear";
    return "top";
  }
  if (["Tops", "Outerwear"].includes(item.category)) return "top";
  if (item.category === "Bottoms") return "bottom";
  if (item.category === "Footwear") return "footwear";
  if (item.category === "Dresses") return "dress";
  return "accessory";
}

interface AutoPairResult {
  paired: ClothingItem[];
  warnings: string[];
}

function autoPairItem(item: ClothingItem, allItems: ClothingItem[]): AutoPairResult {
  const role = classifyRole(item);
  const formality = inferFormality(item);
  const compat = FORMALITY_COMPAT[formality] || [formality];
  const pool = allItems.filter((i) => i.id !== item.id && i.image_url && !i.archived);
  const paired: ClothingItem[] = [item];
  const warnings: string[] = [];

  const pickBest = (candidates: ClothingItem[]): ClothingItem | null => {
    const styled = candidates.filter((c) => compat.includes(inferFormality(c)));
    const chosen = styled.length > 0 ? styled : candidates;
    if (chosen.length === 0) return null;
    return chosen[Math.floor(Math.random() * chosen.length)];
  };

  if (role === "ethnic-top") {
    // Search ALL categories for ethnic bottoms/shoes -- items may not be under "Ethnic Wear"
    const eBottoms = pool.filter((i) => classifyRole(i) === "ethnic-bottom");
    const eShoes = pool.filter((i) => classifyRole(i) === "ethnic-footwear");
    if (eBottoms.length > 0) paired.push(eBottoms[Math.floor(Math.random() * eBottoms.length)]);
    else warnings.push("No ethnic bottoms (pajama, churidar) found -- add some for complete ethnic outfits.");
    if (eShoes.length > 0) paired.push(eShoes[Math.floor(Math.random() * eShoes.length)]);
    else warnings.push("No ethnic footwear (jutti, mojari, kolhapuri) found -- add some for a traditional look.");
    return { paired, warnings };
  }

  if (role === "ethnic-bottom" || role === "ethnic-footwear") {
    const eTops = pool.filter((i) => classifyRole(i) === "ethnic-top");
    if (eTops.length > 0) paired.push(eTops[Math.floor(Math.random() * eTops.length)]);
    else warnings.push("No kurtas/sherwanis found to pair with this item.");
    if (role === "ethnic-bottom") {
      const eShoes = pool.filter((i) => classifyRole(i) === "ethnic-footwear");
      if (eShoes.length > 0) paired.push(eShoes[Math.floor(Math.random() * eShoes.length)]);
      else warnings.push("No ethnic footwear found -- add jutti or kolhapuri for a complete look.");
    } else {
      const eBottoms = pool.filter((i) => classifyRole(i) === "ethnic-bottom");
      if (eBottoms.length > 0) paired.push(eBottoms[Math.floor(Math.random() * eBottoms.length)]);
      else warnings.push("No ethnic bottoms found -- add pajama or churidar for a complete look.");
    }
    return { paired, warnings };
  }

  if (role === "dress") {
    const shoes = pool.filter((i) => classifyRole(i) === "footwear");
    const pick = pickBest(shoes);
    if (pick) paired.push(pick);
    else warnings.push("No footwear in your closet to pair with this dress.");
    return { paired, warnings };
  }

  // Standard: top, bottom, footwear
  const needRoles: ItemRole[] = role === "top" ? ["bottom", "footwear"] : role === "bottom" ? ["top", "footwear"] : ["top", "bottom"];
  const roleLabels: Record<string, string> = { top: "topwear", bottom: "bottomwear", footwear: "footwear" };

  for (const need of needRoles) {
    const candidates = pool.filter((i) => classifyRole(i) === need);
    const pick = pickBest(candidates);
    if (pick) paired.push(pick);
    else warnings.push(`No suitable ${roleLabels[need]} found to pair with this item.`);
  }

  return { paired, warnings };
}

/* ------------------------------------------------------------------ */
/*  Item Detail Modal                                                   */
/* ------------------------------------------------------------------ */
interface ItemDetailModalProps {
  item: ClothingItem | null;
  allItems: ClothingItem[];
  onClose: () => void;
  onToggleFavorite: (item: ClothingItem) => void;
  onDelete: (id: string) => void;
  onToggleArchive: (item: ClothingItem) => void;
  onUpdate: (item: ClothingItem) => void;
  onTryOn: (items: ClothingItem[]) => void;
  onLogWear: (item: ClothingItem) => void;
  onToggleLaundry: (item: ClothingItem) => void;
}

const ItemDetailModal = ({ item, allItems, onClose, onToggleFavorite, onDelete, onToggleArchive, onUpdate, onTryOn, onLogWear, onToggleLaundry }: ItemDetailModalProps) => {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editMaterial, setEditMaterial] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editSize, setEditSize] = useState("");
  const [editFitNotes, setEditFitNotes] = useState("");
  const [editTags, setEditTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [tryOnResult, setTryOnResult] = useState<AutoPairResult | null>(null);
  const [suggestingPair, setSuggestingPair] = useState(false);
  const [suggestedItems, setSuggestedItems] = useState<SuggestedEthnicItem[]>([]);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setEditName(item.name);
      setEditColor(item.color);
      setEditMaterial(item.material || "");
      setEditBrand(item.brand || "");
      setEditSize(item.size || "");
      setEditFitNotes(item.fit_notes || "");
      setEditTags(item.tags.join(", "));
      setEditing(false);
      setTryOnResult(null);
      setSuggestedItems([]);
      setSuggestError(null);
    }
  }, [item]);

  const handleSaveEdit = async () => {
    if (!item) return;
    setSaving(true);
    const updated = await updateClosetItem(item.id, {
      name: editName,
      color: editColor,
      material: editMaterial || undefined,
      brand: editBrand || undefined,
      size: editSize || undefined,
      fit_notes: editFitNotes || undefined,
      tags: editTags.split(",").map(t => t.trim()).filter(Boolean),
    });
    setSaving(false);
    if (updated) {
      onUpdate(updated);
      setEditing(false);
    }
  };

  if (!item) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
          className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-background p-6 pb-24 sm:rounded-3xl sm:pb-6"
        >
          {/* Close button */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display font-bold text-foreground">{editing ? "Edit Item" : "Item Details"}</h2>
            <div className="flex items-center gap-2">
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="rounded-lg bg-card px-3 py-1.5 text-xs font-body font-medium text-muted-foreground hover:text-foreground"
                >
                  Edit
                </button>
              )}
              <button
                onClick={editing ? () => setEditing(false) : onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Edit mode: inline form */}
          {editing && (
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">Name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-body text-foreground outline-none focus:border-ai" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">Color</label>
                  <input value={editColor} onChange={e => setEditColor(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-body text-foreground outline-none focus:border-ai" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">Material</label>
                  <input value={editMaterial} onChange={e => setEditMaterial(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-body text-foreground outline-none focus:border-ai" />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">Brand</label>
                <input value={editBrand} onChange={e => setEditBrand(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-body text-foreground outline-none focus:border-ai" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">Size</label>
                  <input value={editSize} onChange={e => setEditSize(e.target.value)} placeholder="e.g., M, 32" className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-body text-foreground outline-none focus:border-ai" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">Fit</label>
                  <select value={editFitNotes} onChange={e => setEditFitNotes(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-body text-foreground outline-none focus:border-ai">
                    <option value="">Select fit...</option>
                    <option value="Slim fit">Slim fit</option>
                    <option value="Regular fit">Regular fit</option>
                    <option value="Relaxed fit">Relaxed fit</option>
                    <option value="Oversized">Oversized</option>
                    <option value="Runs small">Runs small</option>
                    <option value="Runs large">Runs large</option>
                    <option value="True to size">True to size</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">Tags (comma-separated)</label>
                <input value={editTags} onChange={e => setEditTags(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-body text-foreground outline-none focus:border-ai" />
              </div>
              <motion.button whileTap={{ scale: 0.98 }} onClick={handleSaveEdit} disabled={saving || !editName}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ai text-ai-foreground font-display font-semibold text-sm disabled:opacity-40">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
              </motion.button>
            </div>
          )}

          {/* Expanded image */}
          <div className="mt-4 overflow-hidden rounded-2xl bg-card">
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.name}
                className="w-full object-contain max-h-[50vh]"
              />
            ) : (
              <div className="flex h-48 w-full items-center justify-center">
                <ImageIcon className="h-16 w-16 text-muted-foreground/20" />
              </div>
            )}
          </div>

          {/* Item name & category */}
          <div className="mt-4">
            <h3 className="text-xl font-display font-bold text-foreground">{item.name}</h3>
            <p className="mt-0.5 text-sm font-body text-muted-foreground">{item.category}</p>
          </div>

          {/* Details grid */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {item.color && (
              <div className="rounded-xl bg-card p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">Color</p>
                <p className="mt-0.5 text-sm font-medium font-body text-foreground">{item.color}</p>
              </div>
            )}
            {item.material && (
              <div className="rounded-xl bg-card p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">Material</p>
                <p className="mt-0.5 text-sm font-medium font-body text-foreground">{item.material}</p>
              </div>
            )}
            {item.brand && (
              <div className="rounded-xl bg-card p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">Brand</p>
                <p className="mt-0.5 text-sm font-medium font-body text-foreground">{item.brand}</p>
              </div>
            )}
            <div className="rounded-xl bg-card p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">Size</p>
              {item.size ? (
                <p className="mt-0.5 text-sm font-medium font-body text-foreground">{item.size}</p>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="mt-0.5 text-xs font-body text-ai hover:underline"
                >
                  + Add size
                </button>
              )}
            </div>
            <div className="rounded-xl bg-card p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">Fit</p>
              {item.fit_notes ? (
                <p className="mt-0.5 text-sm font-medium font-body text-foreground">{item.fit_notes}</p>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="mt-0.5 text-xs font-body text-ai hover:underline"
                >
                  + Add fit
                </button>
              )}
            </div>
            {item.gender && (
              <div className="rounded-xl bg-card p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">Gender</p>
                <p className="mt-0.5 text-sm font-medium font-body text-foreground capitalize">{item.gender}</p>
              </div>
            )}
            {item.price != null && (
              <div className="rounded-xl bg-card p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">Price</p>
                <p className="mt-0.5 text-sm font-semibold font-body text-ai">₹{item.price.toLocaleString("en-IN")}</p>
              </div>
            )}
            {item.purchase_type && (
              <div className="rounded-xl bg-card p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">Condition</p>
                <p className="mt-0.5 text-sm font-medium font-body text-foreground capitalize">{item.purchase_type}</p>
              </div>
            )}
          </div>

          {/* Wear & Laundry stats */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-card p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">Worn</p>
              <p className="mt-0.5 text-lg font-display font-bold text-foreground">{item.worn_count || 0}</p>
              <p className="text-[9px] text-muted-foreground font-body">times</p>
            </div>
            <div className="rounded-xl bg-card p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">Last Worn</p>
              <p className="mt-0.5 text-xs font-medium font-body text-foreground">
                {item.last_worn
                  ? new Date(item.last_worn).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                  : "Never"}
              </p>
            </div>
            <div className="rounded-xl bg-card p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">Status</p>
              <p className={`mt-0.5 text-xs font-semibold font-body ${
                item.laundry_status === "in_laundry" ? "text-blue-500" : "text-green-500"
              }`}>
                {item.laundry_status === "in_laundry" ? "In Laundry" : "Available"}
              </p>
            </div>
          </div>

          {/* Quick actions: Log Wear + Laundry */}
          <div className="mt-3 flex gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => onLogWear(item)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-500/10 py-2.5 text-xs font-body font-medium text-green-600 dark:text-green-400"
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              Log Wear
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => onToggleLaundry(item)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-body font-medium ${
                item.laundry_status === "in_laundry"
                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <WashingMachine className="h-3.5 w-3.5" />
              {item.laundry_status === "in_laundry" ? "Return from Laundry" : "Send to Laundry"}
            </motion.button>
          </div>

          {/* Tags */}
          {item.tags.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">Tags</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-card px-3 py-1 text-xs font-body text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-6 flex gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => onToggleFavorite(item)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-body font-medium transition-colors ${
                item.favorite
                  ? "bg-rose-500/10 text-rose-500"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <Heart className={`h-4 w-4 ${item.favorite ? "fill-current" : ""}`} />
              {item.favorite ? "Favorited" : "Favorite"}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => onToggleArchive(item)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-body font-medium transition-colors ${
                item.archived
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.archived ? (
                <>
                  <ArchiveRestore className="h-4 w-4" />
                  Unarchive
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4" />
                  Archive
                </>
              )}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                onDelete(item.id);
                onClose();
              }}
              className="flex items-center justify-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-body font-medium text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </motion.button>
          </div>

          {/* ---- Try On Section ---- */}
          {classifyRole(item) !== "accessory" && (
            <div className="mt-4">
              {!tryOnResult ? (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setTryOnResult(autoPairItem(item, allItems))}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[hsl(43,70%,50%)] to-[hsl(220,10%,65%)] text-white font-display font-semibold shadow-sm"
                >
                  <Sparkles className="h-4 w-4" />
                  Try On -- Auto Pair
                </motion.button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  {/* Paired preview strip */}
                  <div className="rounded-xl bg-card p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body mb-2">AI-Paired Outfit</p>
                    <div className="flex items-center gap-2">
                      {tryOnResult.paired.map((p) => (
                        <div key={p.id} className="relative shrink-0">
                          <div className={`h-16 w-14 overflow-hidden rounded-lg bg-background ring-2 ${p.id === item.id ? "ring-ai" : "ring-border"}`}>
                            <img src={p.image_url} alt={p.name} className="h-full w-full object-contain" />
                          </div>
                          <p className="mt-1 text-center text-[8px] font-body text-muted-foreground truncate w-14">{p.name.split(" ").slice(0, 2).join(" ")}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Warnings */}
                  {tryOnResult.warnings.length > 0 && (
                    <div className="space-y-1.5">
                      {tryOnResult.warnings.map((w, idx) => (
                        <div key={idx} className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2">
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                          <p className="text-[11px] font-body text-amber-700 dark:text-amber-300">{w}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* AI Suggest button -- shown when ethnic items are missing */}
                  {tryOnResult.warnings.length > 0 && classifyRole(item) === "ethnic-top" && suggestedItems.length === 0 && (
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={async () => {
                        if (!item.image_url) return;
                        setSuggestingPair(true);
                        setSuggestError(null);
                        const missingTypes: ("ethnic-bottom" | "ethnic-footwear")[] = [];
                        for (const w of tryOnResult.warnings) {
                          if (w.toLowerCase().includes("bottom") || w.toLowerCase().includes("pajama") || w.toLowerCase().includes("churidar")) missingTypes.push("ethnic-bottom");
                          if (w.toLowerCase().includes("footwear") || w.toLowerCase().includes("jutti") || w.toLowerCase().includes("mojari") || w.toLowerCase().includes("kolhapuri")) missingTypes.push("ethnic-footwear");
                        }
                        if (missingTypes.length === 0) missingTypes.push("ethnic-bottom", "ethnic-footwear");
                        const result = await suggestEthnicPairing(item.image_url, item.name, item.color, missingTypes);
                        setSuggestingPair(false);
                        if (result.success && result.suggestions.length > 0) {
                          setSuggestedItems(result.suggestions);
                        } else {
                          setSuggestError(result.error || "Could not generate suggestions. Please try again.");
                        }
                      }}
                      disabled={suggestingPair}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ai/10 text-ai font-display font-semibold text-sm disabled:opacity-60"
                    >
                      {suggestingPair ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          AI is generating matching pieces...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          AI Suggest Matching Pieces
                        </>
                      )}
                    </motion.button>
                  )}

                  {/* AI Suggest error */}
                  {suggestError && (
                    <div className="flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                      <p className="text-[11px] font-body text-red-600 dark:text-red-400">{suggestError}</p>
                    </div>
                  )}

                  {/* AI Suggested items -- confirmation UI */}
                  {suggestedItems.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-ai/20 bg-ai/5 p-3 space-y-2"
                    >
                      <p className="text-[10px] uppercase tracking-wider text-ai font-body font-semibold">AI-Suggested Pairing</p>
                      <div className="flex items-center gap-2">
                        {suggestedItems.map((s, idx) => (
                          <div key={idx} className="shrink-0 flex flex-col items-center">
                            <div className="h-20 w-16 overflow-hidden rounded-lg bg-white ring-2 ring-ai/30">
                              <img src={s.imageDataUrl} alt={s.name} className="h-full w-full object-contain" />
                            </div>
                            <p className="mt-1 text-center text-[8px] font-body text-muted-foreground w-16 truncate">
                              {s.role === "ethnic-bottom" ? "Bottomwear" : "Footwear"}
                            </p>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] font-body text-muted-foreground">
                        These AI-generated pieces will be used for virtual try-on preview only.
                      </p>
                    </motion.div>
                  )}

                  {/* Action row */}
                  <div className="flex gap-2">
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { setTryOnResult(autoPairItem(item, allItems)); setSuggestedItems([]); setSuggestError(null); }}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-card py-3 text-xs font-body font-medium text-muted-foreground hover:text-foreground"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Re-pair
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        // Build the final item list: real paired items + AI-suggested virtual items
                        const finalItems: ClothingItem[] = [...tryOnResult.paired];
                        for (const s of suggestedItems) {
                          finalItems.push({
                            id: `ai-suggested-${s.role}-${Date.now()}`,
                            user_id: "",
                            name: s.name,
                            category: s.role === "ethnic-bottom" ? "Bottoms" : "Footwear",
                            color: item.color,
                            tags: ["ethnic", "ai-suggested"],
                            image_url: s.imageDataUrl,
                            favorite: false,
                            archived: false,
                            created_at: new Date().toISOString(),
                          } as ClothingItem);
                        }
                        if (finalItems.length >= 2) {
                          onTryOn(finalItems);
                          onClose();
                        }
                      }}
                      disabled={tryOnResult.paired.length < 2 && suggestedItems.length === 0}
                      className={`flex flex-[2] items-center justify-center gap-2 rounded-xl py-3 text-sm font-display font-semibold shadow-sm ${
                        tryOnResult.paired.length >= 2 || suggestedItems.length > 0
                          ? "bg-gradient-to-r from-[hsl(43,70%,50%)] to-[hsl(220,10%,65%)] text-white"
                          : "bg-card text-muted-foreground opacity-40 cursor-not-allowed"
                      }`}
                    >
                      <Camera className="h-4 w-4" />
                      Virtual Try-On
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

/* ------------------------------------------------------------------ */
/*  Main Closet component                                              */
/* ------------------------------------------------------------------ */
const DigitalCloset = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(searchParams.get("filter") === "favorites");
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Lock body scroll when filter sheet is open
  useEffect(() => {
    if (showFilterSheet) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [showFilterSheet]);

  // Load items from Supabase
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoadingItems(true);
      const data = await getClosetItems(user.id);
      setItems(data);
      setLoadingItems(false);
    };
    load();
  }, [user]);

  // Voice input
  const toggleVoice = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      setSearchQuery(event.results[0][0].transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      recognition.start();
      setIsListening(true);
    }
  };

  const handleToggleFavorite = async (item: ClothingItem) => {
    const newFav = !item.favorite;
    await toggleFavorite(item.id, newFav);
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, favorite: newFav } : i))
    );
  };

  const handleDelete = async (itemId: string) => {
    await deleteClosetItem(itemId);
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const handleToggleArchive = async (item: ClothingItem) => {
    const newArchived = !item.archived;
    await toggleArchive(item.id, newArchived);
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, archived: newArchived } : i))
    );
    // Update selectedItem if it's the one being toggled
    setSelectedItem((prev) =>
      prev && prev.id === item.id ? { ...prev, archived: newArchived } : prev
    );
  };

  // Filter items -- favorites first, then category, then fuzzy search
  const categoryFiltered = items.filter((item) => {
    if (showFavoritesOnly && !item.favorite) return false;
    if (activeCategories.includes("In Laundry")) return item.laundry_status === "in_laundry";
    return activeCategories.length === 0 || activeCategories.includes(item.category);
  });

  const filtered = searchQuery.trim()
    ? fuzzySearch(
        categoryFiltered,
        searchQuery,
        (item) => [
          item.name,
          item.category,
          item.color || "",
          item.brand || "",
          item.material || "",
          ...(item.tags || []),
        ]
      ).map((r) => r.item)
    : categoryFiltered;

  const activeItems = filtered.filter((item) => !item.archived);
  const archivedItems = filtered.filter((item) => item.archived);

  return (
    <div className="px-5 pt-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">
            {showFavoritesOnly ? "Favorites" : "My Closet"}
          </h1>
          <p className="text-sm text-muted-foreground font-body">
            {items.filter(i => !i.archived).length} {items.filter(i => !i.archived).length === 1 ? "item" : "items"}
            {items.filter(i => i.archived).length > 0 && (
              <span className="text-muted-foreground/50"> · {items.filter(i => i.archived).length} archived</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowBatchModal(true)}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-card border border-border px-3 text-sm font-body font-medium text-foreground"
          >
            <Upload className="h-4 w-4" />
            Batch
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowAddModal(true)}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-body font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Add
          </motion.button>
        </div>
      </div>

      {/* Search bar + filter button */}
      <div className="mt-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your wardrobe..."
            className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-10 text-sm font-body text-foreground placeholder:text-muted-foreground outline-none focus:border-ai focus:ring-2 focus:ring-ai/20"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-10 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={toggleVoice}
            className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${
              isListening ? "text-ai" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {isListening ? (
              <MicOff className="h-4 w-4 animate-pulse" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </button>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowFilterSheet(true)}
          className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${
            activeCategories.length > 0
              ? "border-ai bg-ai/10 text-ai"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          <SlidersHorizontal className="h-4.5 w-4.5" />
          {activeCategories.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-ai text-[8px] font-bold text-white">
              1
            </span>
          )}
        </motion.button>
      </div>

      {/* Active filter tags */}
      {(activeCategories.length > 0 || showFavoritesOnly) && (
        <div className="mt-2.5 flex items-center gap-2">
          {showFavoritesOnly && (
            <button
              onClick={() => setShowFavoritesOnly(false)}
              className="flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1.5 text-xs font-body font-medium text-rose-500 transition-colors hover:bg-rose-500/20"
            >
              <Heart className="h-3 w-3 fill-current" /> Favorites
              <X className="h-3 w-3" />
            </button>
          )}
          {activeCategories.length > 0 && (
            <button
              onClick={() => setActiveCategories([])}
              className="flex items-center gap-1.5 rounded-full bg-ai/10 px-3 py-1.5 text-xs font-body font-medium text-ai transition-colors hover:bg-ai/20"
            >
              {activeCategories.join(", ")}
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* Category filter bottom sheet */}
      <AnimatePresence>
        {showFilterSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onTouchMove={(e) => e.stopPropagation()}
            className="fixed inset-0 z-50 flex items-end justify-center pb-20 sm:items-center sm:pb-0"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFilterSheet(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              style={{ touchAction: "none" }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 w-full max-w-lg max-h-[80vh] overflow-y-auto overscroll-contain rounded-t-3xl bg-background p-5 pb-6 sm:rounded-3xl sm:pb-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-display font-bold text-foreground">Filter by Category</h3>
                <button
                  onClick={() => setShowFilterSheet(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {categories.filter(cat => items.some(item => item.category === cat)).map((cat) => {
                  const isActive = activeCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      onClick={() => {
                        setActiveCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
                      }}
                      className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-body font-medium transition-all ${
                        isActive
                          ? "bg-ai/10 text-ai ring-1 ring-ai/40"
                          : "bg-card text-muted-foreground hover:text-foreground hover:bg-card/80"
                      }`}
                    >
                      <span>{cat}</span>
                      {isActive && <Check className="h-4 w-4" />}
                    </button>
                  );
                })}
              </div>
              {activeCategories.length > 0 && (
                <button
                  onClick={() => {
                    setActiveCategories([]);
                  }}
                  className="mt-3 w-full rounded-xl border border-border py-2.5 text-sm font-body font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear Filter
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading state */}
      {loadingItems && (
        <div className="mt-16 flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm font-body text-muted-foreground">Loading your closet...</p>
        </div>
      )}

      {/* Active clothing grid */}
      {!loadingItems && activeItems.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {activeItems.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="group cursor-pointer"
              onClick={() => setSelectedItem(item)}
            >
              <div className="overflow-hidden rounded-2xl bg-card p-3 transition-shadow hover:shadow-md">
                <div className="relative aspect-square overflow-hidden rounded-xl bg-background">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                  )}
                  {/* Favorite toggle button */}
                  <motion.button
                    whileTap={{ scale: 0.75 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFavorite(item);
                    }}
                    className={`absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full shadow-sm backdrop-blur-sm transition-colors ${
                      item.favorite
                        ? "bg-rose-500 text-white"
                        : "bg-black/40 text-white/70 hover:text-white"
                    }`}
                  >
                    <Heart className={`h-3.5 w-3.5 ${item.favorite ? "fill-current" : ""}`} />
                  </motion.button>
                  {/* Laundry badge */}
                  {item.laundry_status === "in_laundry" && (
                    <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-blue-500/90 px-2 py-0.5 shadow-sm backdrop-blur-sm">
                      <WashingMachine className="h-2.5 w-2.5 text-white" />
                      <span className="text-[8px] font-body font-medium text-white">Laundry</span>
                    </div>
                  )}
                </div>
                <div className="mt-2">
                  <p className="text-xs font-medium font-body text-foreground truncate">
                    {item.name}
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground font-body">
                      {item.category}
                    </p>
                    {item.price && (
                      <p className="text-[10px] font-semibold text-ai font-body">
                        ₹{item.price.toLocaleString("en-IN")}
                      </p>
                    )}
                  </div>
                  {item.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {item.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-background px-2 py-0.5 text-[9px] font-body text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Archived items section */}
      {!loadingItems && archivedItems.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <Archive className="h-4 w-4 text-muted-foreground/50" />
            <h3 className="text-sm font-display font-semibold text-muted-foreground">
              Archived ({archivedItems.length})
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {archivedItems.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 0.45, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="group cursor-pointer hover:!opacity-70 transition-opacity"
                onClick={() => setSelectedItem(item)}
              >
                <div className="overflow-hidden rounded-2xl bg-card p-3 grayscale-[30%]">
                  <div className="relative aspect-square overflow-hidden rounded-xl bg-background">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ImageIcon className="h-10 w-10 text-muted-foreground/20" />
                      </div>
                    )}
                    <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 backdrop-blur-sm">
                      <Archive className="h-2.5 w-2.5 text-white/80" />
                      <span className="text-[9px] font-body text-white/80">Archived</span>
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-xs font-medium font-body text-foreground/60 truncate">
                      {item.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 font-body">
                      {item.category}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state -- no items at all */}
      {!loadingItems && items.length === 0 && (
        <div className="mt-16 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-card">
            <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <p className="mt-3 text-sm font-body font-medium text-foreground">Your closet is empty</p>
          <p className="mt-1 text-xs font-body text-muted-foreground">
            Tap the + button to add your first item
          </p>
        </div>
      )}

      {/* Empty state -- no search results */}
      {!loadingItems && items.length > 0 && filtered.length === 0 && (
        <div className="mt-16 flex flex-col items-center text-center">
          <Search className="h-12 w-12 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-body font-medium text-foreground">No items found</p>
          <p className="mt-1 text-xs font-body text-muted-foreground">
            Try a different search or category
          </p>
        </div>
      )}

      {/* Add Item Modal */}
      {user && (
        <AddItemModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onAdd={(newItem) => setItems((prev) => [newItem, ...prev])}
          userId={user.id}
        />
      )}

      {/* Batch Add Modal */}
      {user && (
        <BatchAddModal
          isOpen={showBatchModal}
          onClose={() => setShowBatchModal(false)}
          onAdd={(newItems) => setItems((prev) => [...newItems, ...prev])}
          userId={user.id}
        />
      )}

      {/* Item Detail Modal */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          allItems={items}
          onClose={() => setSelectedItem(null)}
          onToggleFavorite={(item) => {
            handleToggleFavorite(item);
            setSelectedItem((prev) =>
              prev && prev.id === item.id ? { ...prev, favorite: !prev.favorite } : prev
            );
          }}
          onDelete={handleDelete}
          onToggleArchive={handleToggleArchive}
          onUpdate={(updated) => {
            setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
            setSelectedItem(updated);
          }}
          onLogWear={async (item) => {
            if (!user) return;
            await logWear(user.id, [item.id]);
            const newCount = (item.worn_count || 0) + 1;
            const now = new Date().toISOString();
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, worn_count: newCount, last_worn: now } : i));
            setSelectedItem(prev => prev && prev.id === item.id ? { ...prev, worn_count: newCount, last_worn: now } : prev);
          }}
          onToggleLaundry={async (item) => {
            if (item.laundry_status === "in_laundry") {
              await returnFromLaundry([item.id]);
              setItems(prev => prev.map(i => i.id === item.id ? { ...i, laundry_status: "available", laundry_sent_at: undefined } : i));
              setSelectedItem(prev => prev && prev.id === item.id ? { ...prev, laundry_status: "available", laundry_sent_at: undefined } : prev);
            } else {
              await sendToLaundry([item.id]);
              const now = new Date().toISOString();
              setItems(prev => prev.map(i => i.id === item.id ? { ...i, laundry_status: "in_laundry", laundry_sent_at: now } : i));
              setSelectedItem(prev => prev && prev.id === item.id ? { ...prev, laundry_status: "in_laundry", laundry_sent_at: now } : prev);
            }
          }}
          onTryOn={(pairedItems) => {
            // Navigate to AI Stylist with paired items for virtual try-on
            // Store full items in sessionStorage so AI-suggested items (with data URLs) are preserved
            const hasAiSuggested = pairedItems.some(i => i.id.startsWith("ai-suggested-"));
            if (hasAiSuggested) {
              sessionStorage.setItem("tryOnItems", JSON.stringify(pairedItems));
              window.location.href = `/stylist?tryOn=session`;
            } else {
              const ids = pairedItems.map(i => i.id).join(",");
              window.location.href = `/stylist?tryOn=${ids}`;
            }
          }}
        />
      )}
    </div>
  );
};

export default DigitalCloset;
