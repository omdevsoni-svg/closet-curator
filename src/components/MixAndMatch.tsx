import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Camera,
  Shuffle,
  ImageIcon,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { type ClothingItem } from "@/lib/database";

/* ------------------------------------------------------------------ */
/*  Slot definitions & category mapping                                */
/* ------------------------------------------------------------------ */
interface SlotDef {
  key: string;
  label: string;
  categories: string[];
}

const SLOT_DEFS: SlotDef[] = [
  { key: "topwear", label: "Top", categories: ["Tops", "Outerwear", "Activewear"] },
  { key: "bottomwear", label: "Bottom", categories: ["Bottoms"] },
  { key: "footwear", label: "Shoes", categories: ["Footwear"] },
];

const DRESS_SLOT: SlotDef = {
  key: "dress",
  label: "Dress",
  categories: ["Dresses"],
};

/* ------------------------------------------------------------------ */
/*  Slot Carousel — horizontal swipe for one slot                      */
/* ------------------------------------------------------------------ */
interface SlotCarouselProps {
  slot: SlotDef;
  items: ClothingItem[];
  selectedItem: ClothingItem | null;
  onSelect: (item: ClothingItem) => void;
}

const SlotCarousel = ({ slot, items, selectedItem, onSelect }: SlotCarouselProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = 140;
    scrollRef.current.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  if (items.length === 0) {
    return (
      <div className="rounded-xl bg-card/50 p-4 text-center">
        <p className="text-[11px] font-body text-muted-foreground">
          No {slot.label.toLowerCase()} items in closet
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Slot label */}
      <p className="mb-1.5 text-[9px] font-body font-semibold uppercase tracking-wider text-ai/70">
        {slot.label}
      </p>

      {/* Navigation arrows */}
      {items.length > 2 && (
        <>
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 z-10 -translate-y-1/2 translate-x-[-4px] flex h-6 w-6 items-center justify-center rounded-full bg-background/90 shadow-md border border-border/50 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 z-10 -translate-y-1/2 translate-x-[4px] flex h-6 w-6 items-center justify-center rounded-full bg-background/90 shadow-md border border-border/50 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        </>
      )}

      {/* Scrollable items */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-none px-1 py-1 snap-x snap-mandatory"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {items.map((item) => {
          const isSelected = selectedItem?.id === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              className={`shrink-0 snap-center rounded-xl p-1.5 transition-all ${
                isSelected
                  ? "ring-2 ring-ai bg-ai/5 scale-105"
                  : "bg-card hover:bg-card/80"
              }`}
            >
              <div className="h-24 w-20 overflow-hidden rounded-lg bg-background">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-muted-foreground/30" />
                  </div>
                )}
              </div>
              <p className="mt-1 text-center text-[8px] font-body font-medium text-foreground truncate w-20">
                {item.name}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  MixAndMatch main component                                         */
/* ------------------------------------------------------------------ */
interface MixAndMatchProps {
  closetItems: ClothingItem[];
  onTryOn: (items: ClothingItem[]) => void;
  onClose?: () => void;
  inline?: boolean;
}

const MixAndMatch = ({ closetItems, onTryOn, onClose, inline = false }: MixAndMatchProps) => {
  // Determine if closet has dresses
  const dressItems = closetItems.filter((i) =>
    DRESS_SLOT.categories.includes(i.category)
  );
  const hasDresses = dressItems.length > 0;

  const [mode, setMode] = useState<"standard" | "dress">("standard");
  const [selections, setSelections] = useState<Record<string, ClothingItem | null>>({
    topwear: null,
    bottomwear: null,
    footwear: null,
    dress: null,
  });

  // Filter items by slot
  const getSlotItems = (slot: SlotDef) =>
    closetItems.filter((i) => slot.categories.includes(i.category) && i.image_url);

  const activeSlots = mode === "dress"
    ? [DRESS_SLOT, SLOT_DEFS[2]] // dress + footwear
    : SLOT_DEFS; // top + bottom + footwear

  const handleSelect = (slotKey: string, item: ClothingItem) => {
    setSelections((prev) => ({
      ...prev,
      [slotKey]: prev[slotKey]?.id === item.id ? null : item,
    }));
  };

  const handleRandomize = () => {
    const newSelections: Record<string, ClothingItem | null> = { ...selections };
    activeSlots.forEach((slot) => {
      const items = getSlotItems(slot);
      if (items.length > 0) {
        const rand = items[Math.floor(Math.random() * items.length)];
        newSelections[slot.key] = rand;
      }
    });
    setSelections(newSelections);
  };

  const selectedItems = activeSlots
    .map((s) => selections[s.key])
    .filter(Boolean) as ClothingItem[];

  const canTryOn = selectedItems.length >= 2;

  const content = (
    <div className={inline ? "" : "p-5"}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shuffle className="h-4 w-4 text-ai" />
          <h2 className="text-lg font-display font-bold text-foreground">
            Mix & Match
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleRandomize}
            className="flex items-center gap-1.5 rounded-lg bg-card px-3 py-1.5 text-[11px] font-display font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Shuffle className="h-3 w-3" />
            Shuffle
          </motion.button>
          {onClose && (
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-card text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <p className="mt-1 text-[11px] font-body text-muted-foreground">
        Swipe each row to pick items, then try them on together
      </p>

      {/* Mode toggle (show only if dresses exist) */}
      {hasDresses && (
        <div className="mt-3 flex rounded-xl bg-card p-1">
          <button
            onClick={() => setMode("standard")}
            className={`flex-1 rounded-lg py-1.5 text-xs font-body font-medium transition-all ${
              mode === "standard"
                ? "bg-ai text-ai-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            Top + Bottom + Shoes
          </button>
          <button
            onClick={() => setMode("dress")}
            className={`flex-1 rounded-lg py-1.5 text-xs font-body font-medium transition-all ${
              mode === "dress"
                ? "bg-ai text-ai-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            Dress + Shoes
          </button>
        </div>
      )}

      {/* Slot carousels */}
      <div className="mt-4 space-y-4">
        <AnimatePresence mode="wait">
          {activeSlots.map((slot, i) => (
            <motion.div
              key={slot.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ delay: i * 0.08 }}
            >
              <SlotCarousel
                slot={slot}
                items={getSlotItems(slot)}
                selectedItem={selections[slot.key]}
                onSelect={(item) => handleSelect(slot.key, item)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Selected preview + Try On */}
      <div className="mt-5">
        {selectedItems.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-card p-3 mb-3">
            {selectedItems.map((item) => (
              <div
                key={item.id}
                className="h-14 w-11 shrink-0 overflow-hidden rounded-lg bg-background"
              >
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="h-full w-full object-contain"
                />
              </div>
            ))}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-body font-medium text-foreground">
                {selectedItems.length} item{selectedItems.length !== 1 ? "s" : ""} selected
              </p>
              <p className="text-[10px] font-body text-muted-foreground truncate">
                {selectedItems.map((i) => i.name).join(" + ")}
              </p>
            </div>
          </div>
        )}

        <motion.button
          whileTap={canTryOn ? { scale: 0.98 } : undefined}
          onClick={() => {
            if (canTryOn) onTryOn(selectedItems);
          }}
          className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[hsl(43,70%,50%)] to-[hsl(220,10%,65%)] text-white font-display font-semibold transition-all shadow-sm ${
            !canTryOn ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
          }`}
        >
          <Camera className="h-4 w-4" />
          Virtual Try-On ({selectedItems.length} items)
        </motion.button>
      </div>
    </div>
  );

  if (inline) return content;

  // Modal wrapper
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
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
          className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-background pb-24 sm:rounded-3xl sm:pb-6"
        >
          {content}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MixAndMatch;
