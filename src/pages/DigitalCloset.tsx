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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import {
  getClosetItems,
  addClosetItem,
  deleteClosetItem,
  toggleFavorite,
  uploadImage,
  type ClothingItem,
} from "@/lib/database";
import { detectClothingAttributes, fileToBase64 } from "@/lib/ai-service";

const categories = ["All", "Tops", "Bottoms", "Outerwear", "Footwear", "Dresses", "Accessories"];
const colorOptions = ["Black", "White", "Navy", "Blue", "Red", "Green", "Beige", "Grey", "Pink", "Brown"];
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiDetecting, setAiDetecting] = useState(false);
  const [aiDetected, setAiDetected] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));

    // Auto-detect attributes using AI
    setAiDetecting(true);
    setAiDetected(false);
    try {
      const base64 = await fileToBase64(file);
      const attrs = await detectClothingAttributes(base64, file.type || "image/jpeg");
      if (attrs) {
        if (attrs.name) setItemName(attrs.name);
        if (attrs.category) setCategory(attrs.category);
        if (attrs.color) setColor(attrs.color);
        if (attrs.gender) setGender(attrs.gender as "women" | "men" | "unisex");
        if (attrs.brand) setBrand(attrs.brand);
        if (attrs.material) setMaterial(attrs.material);
        if (attrs.tags?.length) setTags(attrs.tags.join(", "));
        setAiDetected(true);
      }
    } catch (err) {
      console.error("AI detection error:", err);
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
    setImageFile(null);
    setImagePreview(null);
    setAiDetecting(false);
    setAiDetected(false);
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
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
            className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-background p-6 sm:rounded-3xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-bold text-foreground">
                Add New Item
              </h2>
              <button
                onClick={onClose}
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
                  AI auto-filled details — review and adjust below
                </span>
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
/*  Main Closet component                                              */
/* ------------------------------------------------------------------ */
const DigitalCloset = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

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

  // Filter items
  const filtered = items.filter((item) => {
    const matchesCategory =
      activeCategory === "All" || item.category === activeCategory;
    const matchesSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="px-5 pt-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">
            My Closet
          </h1>
          <p className="text-sm text-muted-foreground font-body">
            {items.length} {items.length === 1 ? "item" : "items"}
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Search bar */}
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
        <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground">
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Category filter chips */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium font-body transition-colors ${
              activeCategory === cat
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loadingItems && (
        <div className="mt-16 flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm font-body text-muted-foreground">Loading your closet...</p>
        </div>
      )}

      {/* Clothing grid */}
      {!loadingItems && filtered.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="group"
            >
              <div className="overflow-hidden rounded-2xl bg-card p-3">
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
                  {/* Action buttons */}
                  <div className="absolute right-1.5 top-1.5 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleToggleFavorite(item)}
                      className={`flex h-7 w-7 items-center justify-center rounded-full bg-white/80 shadow-sm backdrop-blur-sm ${
                        item.favorite ? "text-rose-500" : "text-muted-foreground"
                      }`}
                    >
                      <Heart className={`h-3.5 w-3.5 ${item.favorite ? "fill-current" : ""}`} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-muted-foreground shadow-sm backdrop-blur-sm hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
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

      {/* Empty state — no items at all */}
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

      {/* Empty state — no search results */}
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
    </div>
  );
};

export default DigitalCloset;
