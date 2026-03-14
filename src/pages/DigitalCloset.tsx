import { useState, useRef } from "react";
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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import mockBlazer from "@/assets/mock-blazer.png";
import mockSneakers from "@/assets/mock-sneakers.png";
import mockJeans from "@/assets/mock-jeans.png";
import mockTshirt from "@/assets/mock-tshirt.png";
import mockDressShirt from "@/assets/mock-dress-shirt.png";
import mockChinos from "@/assets/mock-chinos.png";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type ClothingItem = {
  id: string;
  name: string;
  category: string;
  color: string;
  tags: string[];
  purchaseType: "new" | "pre-loved";
  price?: number;
  image: string;
  gender: "women" | "men" | "unisex";
};

const mockItems: ClothingItem[] = [
  { id: "1", name: "Navy Blazer", category: "Outerwear", color: "Navy", tags: ["formal", "winter"], purchaseType: "new", price: 4999, image: mockBlazer, gender: "men" },
  { id: "2", name: "White Sneakers", category: "Footwear", color: "White", tags: ["casual", "everyday"], purchaseType: "new", price: 2499, image: mockSneakers, gender: "unisex" },
  { id: "3", name: "Blue Denim Jeans", category: "Bottoms", color: "Blue", tags: ["casual", "everyday"], purchaseType: "new", price: 1999, image: mockJeans, gender: "men" },
  { id: "4", name: "White T-Shirt", category: "Tops", color: "White", tags: ["casual", "summer"], purchaseType: "new", price: 599, image: mockTshirt, gender: "unisex" },
  { id: "5", name: "Black Dress Shirt", category: "Tops", color: "Black", tags: ["formal", "office"], purchaseType: "new", price: 1299, image: mockDressShirt, gender: "men" },
  { id: "6", name: "Beige Chinos", category: "Bottoms", color: "Beige", tags: ["smart-casual", "office"], purchaseType: "new", price: 1499, image: mockChinos, gender: "men" },
];

const categories = ["All", "Tops", "Bottoms", "Outerwear", "Footwear", "Dresses", "Accessories"];
const colorOptions = ["Black", "White", "Navy", "Blue", "Red", "Green", "Beige", "Grey", "Pink", "Brown"];
const categoryOptions = ["Tops", "Bottoms", "Outerwear", "Footwear", "Dresses", "Accessories", "Activewear"];

/* ------------------------------------------------------------------ */
/*  Add Item Modal                                                     */
/* ------------------------------------------------------------------ */
interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddItemModal = ({ isOpen, onClose }: AddItemModalProps) => {
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("");
  const [gender, setGender] = useState<"women" | "men" | "unisex">("unisex");
  const [color, setColor] = useState("");
  const [tags, setTags] = useState("");
  const [purchaseType, setPurchaseType] = useState<"new" | "pre-loved">("new");
  const [price, setPrice] = useState("");
  const [removeBackground, setRemoveBackground] = useState(true);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = () => {
    // Would save to store/firebase
    onClose();
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
              <div className="mt-2 flex items-center justify-between rounded-xl bg-card px-4 py-2.5">
                <div className="flex items-center gap-2 text-sm font-body text-muted-foreground">
                  <Upload className="h-4 w-4" />
                  Remove background
                </div>
                <button
                  onClick={() => setRemoveBackground(!removeBackground)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    removeBackground ? "bg-ai" : "bg-border"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      removeBackground ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {imagePreview ? (
                <div className="relative mt-3 aspect-square w-full max-w-[200px] mx-auto overflow-hidden rounded-xl bg-card">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-full w-full object-cover"
                  />
                  <button
                    onClick={() => setImagePreview(null)}
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
                For * <span className="normal-case text-muted-foreground/60">(required)</span>
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
              disabled={!itemName || !category}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-display font-semibold transition-all disabled:opacity-40"
            >
              <Upload className="h-4 w-4" />
              Add to Closet
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
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Voice input
  const toggleVoice = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      return;
    }
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
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

  // Filter items by category + search
  const filtered = mockItems.filter((item) => {
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
            {mockItems.length} items
          </p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.9 }}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-card px-3 text-sm font-body font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Upload className="h-4 w-4" />
            Import
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

      {/* Clothing grid */}
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
              <div className="aspect-square overflow-hidden rounded-xl">
                <img
                  src={item.image}
                  alt={item.name}
                  className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                />
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

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="mt-16 flex flex-col items-center text-center">
          <Search className="h-12 w-12 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-body font-medium text-foreground">No items found</p>
          <p className="mt-1 text-xs font-body text-muted-foreground">
            Try a different search or category
          </p>
        </div>
      )}

      {/* Add Item Modal */}
      <AddItemModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
};

export default DigitalCloset;
