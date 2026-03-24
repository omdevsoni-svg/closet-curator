import { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles,
  ChevronUp,
  ChevronDown,
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
/*  Style-aware shuffle: formality/style matching                      */
/* ------------------------------------------------------------------ */

/** Infer a formality tier from item name, tags, category, and material */
function inferFormality(item: ClothingItem): "formal" | "smart-casual" | "casual" | "sporty" {
  const text = [
    item.name,
    ...(item.tags || []),
    item.material || "",
    item.brand || "",
  ].join(" ").toLowerCase();

  // Sporty / Athletic
  if (
    text.match(/\b(sport|athletic|gym|running|jogger|track|sneaker|trainer|activewear|workout|yoga|legging)\b/)
  ) return "sporty";

  // Formal / Dressy
  if (
    text.match(/\b(formal|suit|blazer|dress\s?shoe|oxford|loafer|heel|pump|derby|brogue|chino|trouser|silk|satin|linen\s?pant|wool|cashmere|office|business|tie|cufflink)\b/)
  ) return "formal";

  // Smart casual
  if (
    text.match(/\b(polo|button|collar|boot|chelsea|suede|leather|khaki|slim|fitted|cardigan|knit|smart|semi)\b/)
  ) return "smart-casual";

  // Default casual
  return "casual";
}

/** Compatible formality pairings */
const FORMALITY_COMPAT: Record<string, string[]> = {
  "formal":       ["formal", "smart-casual"],
  "smart-casual": ["formal", "smart-casual", "casual"],
  "casual":       ["smart-casual", "casual", "sporty"],
  "sporty":       ["casual", "sporty"],
};

/* ------------------------------------------------------------------ */
/*  Vertical Casino Carousel - 3 visible rows, middle active           */
/* ------------------------------------------------------------------ */
interface VerticalCarouselProps {
  slot: SlotDef;
  items: ClothingItem[];
  selectedItem: ClothingItem | null;
  onSelect: (item: ClothingItem) => void;
}

const ITEM_HEIGHT = 88; // px per row
const VISIBLE_COUNT = 3;

const VerticalCarousel = ({ slot, items, selectedItem, onSelect }: VerticalCarouselProps) => {
  // Find the index of the selected item, default to 0
  const selectedIdx = selectedItem ? items.findIndex(i => i.id === selectedItem.id) : -1;
  const [activeIndex, setActiveIndex] = useState(Math.max(0, selectedIdx));

  // Sync activeIndex when selectedItem changes externally (e.g. shuffle)
  useEffect(() => {
    if (selectedItem) {
      const idx = items.findIndex(i => i.id === selectedItem.id);
      if (idx >= 0) setActiveIndex(idx);
    }
  }, [selectedItem, items]);

  // Auto-select middle item on mount if nothing selected
  useEffect(() => {
    if (!selectedItem && items.length > 0) {
      onSelect(items[activeIndex]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollUp = useCallback(() => {
    setActiveIndex(prev => {
      const next = Math.max(0, prev - 1);
      onSelect(items[next]);
      return next;
    });
  }, [items, onSelect]);

  const scrollDown = useCallback(() => {
    setActiveIndex(prev => {
      const next = Math.min(items.length - 1, prev + 1);
      onSelect(items[next]);
      return next;
    });
  }, [items, onSelect]);

  if (items.length === 0) {
    return (
      <div className="rounded-xl bg-card/50 p-4 text-center">
        <p className="text-[11px] font-body text-muted-foreground">
          No {slot.label.toLowerCase()} items in closet
        </p>
      </div>
    );
  }

  // Build 3 visible indices: prev, active, next
  const prevIdx = activeIndex - 1;
  const nextIdx = activeIndex + 1;
  const visibleIndices = [prevIdx, activeIndex, nextIdx];

  return (
    <div className="relative flex items-start gap-3">
      {/* Slot label - vertical */}
      <div className="flex flex-col items-center justify-center pt-1" style={{ minWidth: 40 }}>
        <p className="text-[9px] font-body font-semibold uppercase tracking-wider text-ai/70 text-center">
          {slot.label}
        </p>
        {/* Up/Down arrows */}
        <div className="flex flex-col gap-0.5 mt-1">
          <button
            onClick={scrollUp}
            disabled={activeIndex === 0}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-opacity"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            onClick={scrollDown}
            disabled={activeIndex >= items.length - 1}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-opacity"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Casino reel */}
      <div
        className="relative overflow-hidden rounded-xl flex-1"
        style={{ height: ITEM_HEIGHT * VISIBLE_COUNT }}
      >
        <AnimatePresence initial={false}>
          {visibleIndices.map((idx, pos) => {
            if (idx < 0 || idx >= items.length) {
              // Empty slot (top or bottom edge)
              return (
                <motion.div
                  key={`empty-${pos}`}
                  className="absolute left-0 right-0"
                  style={{ height: ITEM_HEIGHT, top: pos * ITEM_HEIGHT }}
                >
                  <div className="h-full w-full" />
                </motion.div>
              );
            }

            const item = items[idx];
            const isActive = pos === 1; // middle row
            const isFaded = !isActive;

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: pos === 0 ? -ITEM_HEIGHT : ITEM_HEIGHT }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="absolute left-0 right-0 px-1"
                style={{ height: ITEM_HEIGHT, top: pos * ITEM_HEIGHT }}
              >
                <button
                  onClick={() => {
                    if (!isActive) {
                      setActiveIndex(idx);
                    }
                    onSelect(item);
                  }}
                  className={`flex items-center gap-3 w-full h-full rounded-xl px-2 transition-all duration-300 ${
                    isActive
                      ? "bg-ai/5 ring-2 ring-ai scale-[1.02] shadow-sm"
                      : "bg-card/40"
                  }`}
                  style={{
                    opacity: isFaded ? 0.35 : 1,
                    filter: isFaded ? "blur(0.5px)" : "none",
                  }}
                >
                  <div className={`shrink-0 overflow-hidden rounded-lg bg-background transition-all ${
                    isActive ? "h-[72px] w-[60px]" : "h-[60px] w-[50px]"
                  }`}>
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className={`font-body font-medium text-foreground truncate ${
                      isActive ? "text-xs" : "text-[10px]"
                    }`}>
                      {item.name}
                    </p>
                    {isActive && item.color && (
                      <p className="text-[9px] font-body text-muted-foreground mt-0.5 truncate">
                        {item.color}{item.brand ? ` - ${item.brand}` : ""}
                      </p>
                    )}
                  </div>
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Top/bottom fade overlays */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-background/60 to-transparent z-10" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-background/60 to-transparent z-10" />
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

  // Style-aware shuffle: pick a random top first, then find compatible bottoms and shoes
  const handleRandomize = () => {
    const newSelections: Record<string, ClothingItem | null> = { ...selections };

    if (mode === "dress") {
      // Dress mode: just random dress + random shoe
      activeSlots.forEach((slot) => {
        const items = getSlotItems(slot);
        if (items.length > 0) {
          newSelections[slot.key] = items[Math.floor(Math.random() * items.length)];
        }
      });
    } else {
      // Standard mode: style-aware matching
      const topItems = getSlotItems(SLOT_DEFS[0]);
      const bottomItems = getSlotItems(SLOT_DEFS[1]);
      const footItems = getSlotItems(SLOT_DEFS[2]);

      // 1. Pick a random top
      if (topItems.length > 0) {
        const top = topItems[Math.floor(Math.random() * topItems.length)];
        newSelections["topwear"] = top;
        const topFormality = inferFormality(top);
        const compatibleStyles = FORMALITY_COMPAT[topFormality] || [topFormality, "casual"];

        // 2. Pick a compatible bottom
        if (bottomItems.length > 0) {
          const compatBottoms = bottomItems.filter(b => compatibleStyles.includes(inferFormality(b)));
          const pool = compatBottoms.length > 0 ? compatBottoms : bottomItems;
          newSelections["bottomwear"] = pool[Math.floor(Math.random() * pool.length)];
        }

        // 3. Pick compatible footwear
        if (footItems.length > 0) {
          const compatFoot = footItems.filter(f => compatibleStyles.includes(inferFormality(f)));
          const pool = compatFoot.length > 0 ? compatFoot : footItems;
          newSelections["footwear"] = pool[Math.floor(Math.random() * pool.length)];
        }
      } else {
        // No tops: just random for everything
        activeSlots.forEach((slot) => {
          const items = getSlotItems(slot);
          if (items.length > 0) {
            newSelections[slot.key] = items[Math.floor(Math.random() * items.length)];
          }
        });
      }
    }

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
        Scroll each slot to pick items, then try them on together
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

      {/* Casino-style vertical carousels */}
      <div className="mt-4 space-y-3">
        <AnimatePresence mode="wait">
          {activeSlots.map((slot, i) => (
            <motion.div
              key={slot.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ delay: i * 0.08 }}
            >
              <VerticalCarousel
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
