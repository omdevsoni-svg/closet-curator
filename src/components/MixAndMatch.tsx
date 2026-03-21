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
/*  Vertical Swipe Column — one draggable column per slot              */
/* ------------------------------------------------------------------ */

interface SwipeColumnProps {
  slot: SlotDef;
  items: ClothingItem[];
  selectedItem: ClothingItem | null;
  onSelect: (item: ClothingItem) => void;
}

const SwipeColumn = ({ slot, items, selectedItem, onSelect }: SwipeColumnProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrolling = useRef(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollTo = (dir: "up" | "down") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      top: dir === "up" ? -130 : 130,
      behavior: "smooth",
    });
  };

  // Find the item closest to the vertical center of the scroll container
  const findCenteredItem = useCallback(() => {
    const container = scrollRef.current;
    if (!container || items.length === 0) return;
    const containerRect = container.getBoundingClientRect();
    const centerY = containerRect.top + containerRect.height / 2;
    let closestItem: ClothingItem | null = null;
    let closestDist = Infinity;
    for (const item of items) {
      const el = container.querySelector(`[data-item-id="${item.id}"]`);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const itemCenterY = rect.top + rect.height / 2;
      const dist = Math.abs(itemCenterY - centerY);
      if (dist < closestDist) {
        closestDist = dist;
        closestItem = item;
      }
    }
    if (closestItem && closestItem.id !== selectedItem?.id) {
      onSelect(closestItem);
    }
  }, [items, selectedItem?.id, onSelect]);

  // Auto-select on scroll (debounced)
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const handleScroll = () => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => {
        findCenteredItem();
      }, 120);
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, [findCenteredItem]);

  // Auto-select first item on mount if nothing selected
  useEffect(() => {
    if (!selectedItem && items.length > 0) {
      onSelect(items[0]);
    }
  }, []);

  // Auto-scroll to selected item on mount
  useEffect(() => {
    if (!scrollRef.current || !selectedItem) return;
    const container = scrollRef.current;
    const selectedEl = container.querySelector(`[data-item-id="${selectedItem.id}"]`);
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [selectedItem?.id]);

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center min-w-0">
        <div className="mb-2 rounded-lg bg-ai/10 px-3 py-1">
          <p className="text-[10px] font-body font-bold uppercase tracking-widest text-ai">
            {slot.label}
          </p>
        </div>
        <div className="flex-1 flex items-center justify-center rounded-2xl bg-card/40 border border-dashed border-border/50 p-4 w-full">
          <div className="text-center">
            <ImageIcon className="h-6 w-6 text-muted-foreground/20 mx-auto mb-1" />
            <p className="text-[9px] text-muted-foreground">No items</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center min-w-0">
      {/* Slot header */}
      <div className="mb-2 rounded-lg bg-ai/10 px-3 py-1">
        <p className="text-[10px] font-body font-bold uppercase tracking-widest text-ai">
          {slot.label}
        </p>
      </div>

      {/* Up arrow */}
      <button
        onClick={() => scrollTo("up")}
        className="mb-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-card shadow-sm border border-border/40 text-muted-foreground hover:text-foreground hover:bg-card/80 transition-colors"
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </button>

      {/* Scrollable vertical column */}
      <div
        ref={scrollRef}
        className="flex flex-col gap-2.5 overflow-y-auto scrollbar-none rounded-2xl bg-card/30 border border-border/30 p-2 w-full"
        style={{
          height: "320px",
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {items.map((item) => {
          const isSelected = selectedItem?.id === item.id;
          return (
            <button
              key={item.id}
              data-item-id={item.id}
              onClick={() => onSelect(item)}
              className={`shrink-0 rounded-xl p-1.5 transition-all duration-200 ${
                isSelected
                  ? "ring-2 ring-ai bg-ai/10 shadow-lg shadow-ai/10 scale-[1.03]"
                  : "bg-background hover:bg-background/80 hover:shadow-sm"
              }`}
              style={{ scrollSnapAlign: "center" }}
            >
              <div className="aspect-square overflow-hidden rounded-lg bg-background">
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
              <p className="mt-1 text-[8px] font-body font-medium text-foreground text-center truncate">
                {item.name}
              </p>
              {isSelected && (
                <div className="mt-0.5 mx-auto h-1 w-6 rounded-full bg-ai" />
              )}
            </button>
          );
        })}
      </div>

      {/* Down arrow */}
      <button
        onClick={() => scrollTo("down")}
        className="mt-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-card shadow-sm border border-border/40 text-muted-foreground hover:text-foreground hover:bg-card/80 transition-colors"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
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

const MixAndMatch = ({
  closetItems,
  onTryOn,
  onClose,
  inline = false,
}: MixAndMatchProps) => {
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
    closetItems.filter(
      (i) => slot.categories.includes(i.category) && i.image_url
    );

  const activeSlots =
    mode === "dress"
      ? [DRESS_SLOT, SLOT_DEFS[2]] // dress + footwear
      : SLOT_DEFS; // top + bottom + footwear

  const handleSelect = (slotKey: string, item: ClothingItem) => {
    setSelections((prev) => ({
      ...prev,
      [slotKey]: item,
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
              className="fleh h-7 w-7 items-center justify-center rounded-full bg-card text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <p className="mt-1 text-[11px] font-body text-muted-foreground">
        Scroll to browse — center item is auto-selected
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

      {/* 3-column vertical carousel grid */}
      <div className={`mt-4 grid gap-3 ${activeSlots.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        <AnimatePresence mode="wait">
          {activeSlots.map((slot, i) => (
            <motion.div
              key={slot.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ delay: i * 0.1 }}
              className="flex"
            >
              <SwipeColumn
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
          className={`fleh h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[hsl(43,70%,50%)] to-[hsl(220,10%,65%)] text-white font-display font-semibold transition-all shadow-sm ${
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
