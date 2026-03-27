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

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: Omit<ClothingItem, "id" | "created_at" | "user_id">) => Promise<void>;
}

const AddItemModal = ({ isOpen, onClose, onAdd }: AddItemModalProps) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedInfo, setDetectedInfo] = useState<DetectionResult | null>(null);
  const [category, setCategory] = useState("Tops");
  const [color, setColor] = useState("Black");
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [material, setMaterial] = useState("");
  const [gender, setGender] = useState("Unisex");
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = async (file: File) => {
    try {
      let processedFile = file;
      if (isHeicFile(file)) {
        const blob = await heic2any({ blob: file });
        processedFile = new File([blob as Blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
      }

      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(processedFile);
      setImageFile(processedFile);
      setDetectedInfo(null);
    } catch (err) {
      console.error("Error processing image:", err);
    }
  };

  const detectAttributes = async () => {
    if (!imageFile) return;
    setIsProcessing(true);
    try {
      const base64 = await fileToBase64(imageFile);
      const result = await detectClothingAttributes(base64);
      setDetectedInfo(result);
      if (result.category) setCategory(result.category);
      if (result.color) setColor(result.color);
      if (result.name) setName(result.name);
      if (result.material) setMaterial(result.material);
    } catch (err) {
      console.error("Detection error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAdd = async () => {
    if (!imageFile || !category) return;
    setIsProcessing(true);
    try {
      const base64 = await fileToBase64(imageFile);
      const image_url = await uploadImage(base64);
      await onAdd({
        name: name || category,
        category,
        color,
        tags: tags ? tags.split(",").map((t) => t.trim()) : [],
        material: material || "Unknown",
        gender,
        image_url,
        worn_count: 0,
        laundry_status: "clean",
      });
      setImageFile(null);
      setImagePreview("");
      setDetectedInfo(null);
      setCategory("Tops");
      setColor("Black");
      setName("");
      setTags("");
      setMaterial("");
      setGender("Unisex");
      onClose();
    } catch (err) {
      console.error("Add item error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-md rounded-3xl bg-background p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-display font-bold text-foreground">Add Item</h2>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {!imagePreview ? (
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-card p-4 transition-colors hover:bg-card/80"
                >
                  <Camera className="h-8 w-8 text-ai" />
                  <span className="text-xs font-body font-medium text-foreground">Take Photo</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-card p-4 transition-colors hover:bg-card/80"
                >
                  <Upload className="h-8 w-8 text-ai" />
                  <span className="text-xs font-body font-medium text-foreground">Upload</span>
                </button>
              </div>
            ) : (
              <div className="mt-4">
                <img src={imagePreview} alt="Preview" className="h-48 w-full rounded-xl object-cover" />
                <button
                  onClick={detectAttributes}
                  disabled={isProcessing}
                  className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-ai py-3 text-sm font-body font-semibold text-ai-foreground disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {isProcessing ? "Analyzing..." : "Detect Attributes"}
                </button>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs font-body font-semibold text-foreground">Category</label>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                      {categoryOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-body font-semibold text-foreground">Color</label>
                    <select value={color} onChange={(e) => setColor(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                      {colorOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-body font-semibold text-foreground">Name</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} type="text" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="e.g., Blue Denim Jeans" />
                  </div>
                  <div>
                    <label className="text-xs font-body font-semibold text-foreground">Tags</label>
                    <input value={tags} onChange={(e) => setTags(e.target.value)} type="text" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="e.g., casual, summer, comfy" />
                  </div>
                  <div>
                    <label className="text-xs font-body font-semibold text-foreground">Material</label>
                    <input value={material} onChange={(e) => setMaterial(e.target.value)} type="text" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="e.g., Cotton, Polyester" />
                  </div>
                  <div>
                    <label className="text-xs font-body font-semibold text-foreground">Gender Fit</label>
                    <select value={gender} onChange={(e) => setGender(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                      <option>Men</option>
                      <option>Women</option>
                      <option>Unisex</option>
                    </select>
                  </div>
                </div>

                <button onClick={handleAdd} disabled={isProcessing} className="mt-4 w-full rounded-xl bg-ai py-3 text-sm font-body font-semibold text-ai-foreground transition-colors hover:bg-ai/90 disabled:opacity-50">
                  {isProcessing ? "Adding..." : "Add to Closet"}
                </button>
                <button onClick={() => { setImageFile(null); setImagePreview(""); setDetectedInfo(null); }} className="mt-2 w-full text-sm font-body text-muted-foreground hover:text-foreground">
                  Change Photo
                </button>
              </div>
            )}

            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])} className="hidden" />
            <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])} className="hidden" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface BatchAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: Omit<ClothingItem, "id" | "created_at" | "user_id">) => Promise<void>;
}

const BatchAddModal = ({ isOpen, onClose, onAdd }: BatchAddModalProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedInfo, setDetectedInfo] = useState<DetectionResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState("Tops");
  const [color, setColor] = useState("Black");
  const [name, setName] = useState("");
  const [material, setMaterial] = useState("");
  const [gender, setGender] = useState("Unisex");

  const handleFilesSelect = async (selectedFiles: File[]) => {
    const imageFiles = selectedFiles.filter((f) => f.type.startsWith("image/"));
    setFiles(imageFiles);
    setCurrentIndex(0);
    if (imageFiles.length > 0) detectCurrentItem();
  };

  const detectCurrentItem = async () => {
    if (files.length === 0 || currentIndex >= files.length) return;
    const file = files[currentIndex];
    setIsProcessing(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await detectClothingAttributes(base64);
      setDetectedInfo(result);
      if (result.category) setCategory(result.category);
      if (result.color) setColor(result.color);
      if (result.name) setName(result.name);
      if (result.material) setMaterial(result.material);
    } catch (err) {
      console.error("Detection error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddCurrent = async () => {
    if (files.length === 0 || currentIndex >= files.length) return;
    const file = files[currentIndex];
    setIsProcessing(true);
    try {
      const base64 = await fileToBase64(file);
      const image_url = await uploadImage(base64);
      await onAdd({
        name: name || category,
        category,
        color,
        tags: [],
        material: material || "Unknown",
        gender,
        image_url,
        worn_count: 0,
        laundry_status: "clean",
      });

      if (currentIndex < files.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setName("");
        setMaterial("");
        setCategory("Tops");
        setColor("Black");
        setDetectedInfo(null);
        await detectCurrentItem();
      } else {
        onClose();
      }
    } catch (err) {
      console.error("Add item error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const currentFile = files.length > 0 && currentIndex < files.length ? files[currentIndex] : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-md rounded-3xl bg-background p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-display font-bold text-foreground">Batch Add Items</h2>
                <p className="text-xs font-body text-muted-foreground">
                  {files.length === 0 ? "Select photos" : `${currentIndex + 1} of ${files.length}`}
                </p>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {files.length === 0 ? (
              <div className="mt-6">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-2xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-ai hover:bg-ai/5"
                >
                  <Upload className="mx-auto h-8 w-8 text-ai" />
                  <p className="mt-2 text-sm font-body font-medium text-foreground">Select multiple images</p>
                </button>
              </div>
            ) : currentFile ? (
              <div className="mt-4">
                <div className="relative h-48 w-full rounded-xl bg-card overflow-hidden">
                  <img src={URL.createObjectURL(currentFile)} alt="Current" className="h-full w-full object-cover" />
                </div>
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs font-body font-semibold text-foreground">Category</label>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                      {categoryOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-body font-semibold text-foreground">Color</label>
                    <select value={color} onChange={(e) => setColor(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                      {colorOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-body font-semibold text-foreground">Name</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} type="text" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Item name" />
                  </div>
                </div>

                <button onClick={handleAddCurrent} disabled={isProcessing} className="mt-4 w-full rounded-xl bg-ai py-3 text-sm font-body font-semibold text-ai-foreground transition-colors hover:bg-ai/90 disabled:opacity-50">
                  {isProcessing ? "Processing..." : currentIndex < files.length - 1 ? "Add & Next" : "Add & Done"}
                </button>
              </div>
            ) : null}

            <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={(e) => e.target.files && handleFilesSelect(Array.from(e.target.files))} className="hidden" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const DigitalCloset = () => {                </label>
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
                  AI auto-filled details — review and adjust below
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
                  AI detection unavailable — please fill in details manually
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