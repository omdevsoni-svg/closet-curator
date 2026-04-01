import { useState, useRef, useEffect, useCallback } from "react";
import {
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
  { key: "bottomwear", label: "Bottom", categories: ["Bottoms", "Activewear"] },
  { key: "footwear", label: "Shoes", categories: ["Footwear"] },
];

/** Keywords that identify an Activewear item as a bottom rather than a top */
const ACTIVEWEAR_BOTTOM_KEYWORDS =
  /\b(sweatpant|jogger|track\s?pant|legging|shorts|gym\s?short|running\s?short|yoga\s?pant|cargo\s?pant|athletic\s?pant|training\s?pant|warm[- ]?up\s?pant)/i;

/** Check if an Activewear-category item is actually a bottom */
function isActivewearBottom(item: ClothingItem): boolean {
  if (item.category !== "Activewear") return false;
  const text = [item.name, ...(item.tags || []), item.material || ""].join(" ");
  return ACTIVEWEAR_BOTTOM_KEYWORDS.test(text);
}

const DRESS_SLOT: SlotDef = {
  key: "dress",
  label: "Dress",
  categories: ["Dresses"],
};

/* ------------------------------------------------------------------ */
/*  Style-aware shuffle: formality/style matching                      */
/* ------------------------------------------------------------------ */

type StyleTier = "ethnic" | "formal" | "smart-casual" | "casual" | "sporty";

/** Detect if an item is ethnic wear */
function isEthnicItem(item: ClothingItem): boolean {
  if (item.category === "Ethnic Wear") return true;
  const text = [item.name, ...(item.tags || [])].join(" ").toLowerCase();
  return !!text.match(
    /\b(kurta|sherwani|dhoti|churidar|salwar|lehenga|saree|sari|dupatta|anarkali|pathani|nehru|bandhgala|jodhpuri|mojari|jutti|kolhapuri|ethnic|traditional\s?wear)\b/
  );
}

/** Infer a formality/style tier from item name, tags, category, and material */
function inferFormality(item: ClothingItem): StyleTier {
  // Ethnic items get their own tier -- they must only pair with other ethnic items
  if (isEthnicItem(item)) return "ethnic";

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

/** Compatible formality pairings -- ethnic ONLY matches ethnic */
const FORMALITY_COMPAT: Record<string, string[]> = {
  "ethnic":       ["ethnic"],
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

const ITEM_HEIGHT = 96; // px per row
const VISIBLE_COUNT = 3;

const VerticalCarousel = ({ slot, items, selectedItem, onSelect }: VerticalCarouselProps) => {
  // Find the index of the selected item, default to 0
  const selectedIdx = selectedItem ? items.findIndex(i => i.id === selectedItem.id) : -1;
  const [activeIndex, setActiveIndex] = useState(Math.max(0, selectedIdx));

  // Touch / drag tracking
  const touchStartY = useRef<number | null>(null);
  const touchDelta = useRef(0);
  const swiped = useRef(false); // lock to prevent multi-step per gesture
  const SWIPE_THRESHOLD = 40; // px to trigger item change

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

  // Wrap index for infinite loop
  const wrap = useCallback((idx: number) => {
    if (items.length === 0) return 0;
    return ((idx % items.length) + items.length) % items.length;
  }, [items.length]);

  const scrollUp = useCallback(() => {
    setActiveIndex(prev => {
      const next = wrap(prev - 1);
      onSelect(items[next]);
      return next;
    });
  }, [items, onSelect, wrap]);

  const scrollDown = useCallback(() => {
    setActiveIndex(prev => {
      const next = wrap(prev + 1);
      onSelect(items[next]);
      return next;
    });
  }, [items, onSelect, wrap]);

  // Touch handlers for swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchDelta.current = 0;
    swiped.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    e.preventDefault(); // prevent page scroll while swiping carousel
    touchDelta.current = touchStartY.current - e.touches[0].clientY;
    // Trigger exactly one item change per swipe gesture
    if (!swiped.current && Math.abs(touchDelta.current) >= SWIPE_THRESHOLD) {
      swiped.current = true;
      if (touchDelta.current > 0) {
        scrollDown();
      } else {
        scrollUp();
      }
    }
  }, [scrollDown, scrollUp]);

  const handleTouchEnd = useCallback(() => {
    // Scroll already triggered in touchMove; just reset state
    touchStartY.current = null;
    touchDelta.current = 0;
    swiped.current = false;
  }, []);

  // Mouse wheel handler — heavily debounced so trackpad momentum doesn't skip items
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // Block rapid-fire wheel events (trackpads send many per gesture)
    if (wheelTimer.current) return;
    // Ignore tiny deltas from trackpad momentum
    if (Math.abs(e.deltaY) < 4) return;
    wheelTimer.current = setTimeout(() => { wheelTimer.current = null; }, 350);
    if (e.deltaY > 0) {
      scrollDown();
    } else if (e.deltaY < 0) {
      scrollUp();
    }
  }, [scrollDown, scrollUp]);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-muted-foreground/15 bg-card/30 p-5 text-center">
        <ImageIcon className="h-5 w-5 text-muted-foreground/20 mx-auto mb-1.5" />
        <p className="text-[11px] font-body text-muted-foreground/50">
          No {slot.label.toLowerCase()} items
        </p>
      </div>
    );
  }

  // Build 3 visible indices: prev, active, next (wrapping for infinite loop)
  const prevIdx = wrap(activeIndex - 1);
  const nextIdx = wrap(activeIndex + 1);
  const visibleIndices = [prevIdx, activeIndex, nextIdx];

  return (
    <div className="relative flex flex-col items-center">
      {/* Slot label badge */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[9px] font-body font-bold uppercase tracking-[0.12em] text-ai/70 bg-ai/8 px-3 py-1 rounded-full border border-ai/10">
          {slot.label}
        </span>
        <span className="text-[9px] font-body text-muted-foreground/40 tabular-nums">{items.length}</span>
      </div>

      {/* Up arrow */}
      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={scrollUp}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-card/80 border border-border/30 text-muted-foreground/50 hover:text-ai hover:border-ai/30 hover:bg-ai/5 transition-all duration-200 mb-1.5 backdrop-blur-sm"
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </motion.button>

      {/* Casino reel -- scrollable via touch swipe & mouse wheel */}
      <div
        className="relative overflow-hidden rounded-2xl w-full border border-border/20 bg-gradient-to-b from-card/40 via-card/60 to-card/40 touch-none cursor-grab backdrop-blur-sm"
        style={{ height: ITEM_HEIGHT * VISIBLE_COUNT }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        <AnimatePresence initial={false}>
          {visibleIndices.map((idx, pos) => {
            const item = items[idx];
            const isActive = pos === 1; // middle row
            const isFaded = !isActive;

            return (
              <motion.div
                key={`${item.id}-${pos}`}
                layout
                initial={{ opacity: 0, y: pos === 0 ? -ITEM_HEIGHT : ITEM_HEIGHT }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="absolute left-0 right-0 px-1.5"
                style={{ height: ITEM_HEIGHT, top: pos * ITEM_HEIGHT }}
              >
                <button
                  onClick={() => {
                    if (!isActive) {
                      const wrapped = wrap(idx);
                      setActiveIndex(wrapped);
                      onSelect(items[wrapped]);
                    } else {
                      onSelect(item);
                    }
                  }}
                  className={`flex items-center gap-3 w-full h-full rounded-xl px-2.5 transition-all duration-300 ${
                    isActive
                      ? "bg-ai/8 ring-[1.5px] ring-ai/60 shadow-[0_0_12px_-3px_hsl(var(--ai)/0.25)] scale-[1.03]"
                      : "bg-transparent"
                  }`}
                  style={{
                    opacity: isFaded ? 0.3 : 1,
                    filter: isFaded ? "blur(0.6px)" : "none",
                    transform: isFaded ? `scale(0.92)` : undefined,
                  }}
                >
                  <div className={`shrink-0 overflow-hidden rounded-xl bg-background/80 border transition-all duration-300 ${
                    isActive
                      ? "h-[76px] w-[64px] border-ai/20 shadow-sm"
                      : "h-[58px] w-[48px] border-border/10"
                  }`}>
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="h-full w-full object-contain p-0.5"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-muted-foreground/20" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className={`font-body font-semibold text-foreground truncate transition-all duration-300 ${
                      isActive ? "text-[13px]" : "text-[10px] text-muted-foreground"
                    }`}>
                      {item.name}
                    </p>
                    {isActive && (
                      <div className="flex items-center gap-1.5 mt-1">
                        {item.color && (
                          <span className="text-[9px] font-body text-muted-foreground/70 bg-muted/30 px-1.5 py-0.5 rounded-md truncate">
                            {item.color}
                          </span>
                        )}
                        {item.brand && (
                          <span className="text-[9px] font-body text-ai/50 truncate">
                            {item.brand}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {isActive && (
                    <div className="shrink-0 h-1.5 w-1.5 rounded-full bg-ai/60 animate-pulse" />
                  )}
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Top/bottom fade overlays */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-background/70 to-transparent z-10" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background/70 to-transparent z-10" />
      </div>

      {/* Down arrow */}
      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={scrollDown}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-card/80 border border-border/30 text-muted-foreground/50 hover:text-ai hover:border-ai/30 hover:bg-ai/5 transition-all duration-200 mt-1.5 backdrop-blur-sm"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </motion.button>
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

  // Filter items by slot (with Activewear secondary filter)
  const getSlotItems = (slot: SlotDef) =>
    closetItems.filter((i) => {
      if (!slot.categories.includes(i.category) || !i.image_url) return false;
      // Activewear items need secondary filtering:
      // - Top slot keeps only activewear TOPS (exclude activewear bottoms)
      // - Bottom slot keeps only activewear BOTTOMS (exclude activewear tops)
      if (i.category === "Activewear") {
        const isBottom = isActivewearBottom(i);
        if (slot.key === "topwear") return !isBottom;
        if (slot.key === "bottomwear") return isBottom;
      }
      return true;
    });

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
  // Ethnic items only pair with other ethnic items; if no ethnic match exists, re-pick non-ethnic
  const handleRandomize = () => {
    const newSelections: Record<string, ClothingItem | null> = { ...selections };
    const pick = (arr: ClothingItem[]) => arr[Math.floor(Math.random() * arr.length)] || null;

    if (mode === "dress") {
      // Dress mode: random dress + compatible shoe
      const dressItems = getSlotItems(DRESS_SLOT);
      const footItems = getSlotItems(SLOT_DEFS[2]);
      const dress = pick(dressItems);
      newSelections["dress"] = dress;
      if (dress && footItems.length > 0) {
        const dressStyle = inferFormality(dress);
        const compat = FORMALITY_COMPAT[dressStyle] || [dressStyle];
        const compatFoot = footItems.filter(f => compat.includes(inferFormality(f)));
        newSelections["footwear"] = pick(compatFoot.length > 0 ? compatFoot : footItems);
      } else {
        newSelections["footwear"] = pick(footItems);
      }
    } else {
      // Standard mode: style-aware matching with ethnic guard
      const topItems = getSlotItems(SLOT_DEFS[0]);
      const bottomItems = getSlotItems(SLOT_DEFS[1]);
      const footItems = getSlotItems(SLOT_DEFS[2]);

      if (topItems.length > 0) {
        // Separate ethnic vs non-ethnic tops
        const nonEthnicTops = topItems.filter(t => !isEthnicItem(t));
        const ethnicTops = topItems.filter(t => isEthnicItem(t));
        const ethnicBottoms = bottomItems.filter(b => isEthnicItem(b));
        const ethnicFoot = footItems.filter(f => isEthnicItem(f));

        // Decide whether to try an ethnic outfit (only if we have ethnic tops)
        // Give ethnic outfits a fair chance proportional to their share of the closet
        const ethnicChance = ethnicTops.length / topItems.length;
        const tryEthnic = ethnicTops.length > 0 && Math.random() < ethnicChance;

        let top: ClothingItem | null = null;

        if (tryEthnic) {
          top = pick(ethnicTops);
          // Check if we have ethnic bottoms/footwear to complete the look
          // If not, fall back to non-ethnic
          if (ethnicBottoms.length === 0 && ethnicFoot.length === 0) {
            // No ethnic companions -- fall back to non-ethnic top
            top = nonEthnicTops.length > 0 ? pick(nonEthnicTops) : pick(topItems);
          }
        } else {
          // Pick a non-ethnic top (or any top if all are ethnic)
          top = nonEthnicTops.length > 0 ? pick(nonEthnicTops) : pick(topItems);
        }

        newSelections["topwear"] = top;

        if (top) {
          const topStyle = inferFormality(top);
          const compatStyles = FORMALITY_COMPAT[topStyle] || [topStyle, "casual"];

          // 2. Pick a compatible bottom
          if (bottomItems.length > 0) {
            const compatBottoms = bottomItems.filter(b => compatStyles.includes(inferFormality(b)));
            newSelections["bottomwear"] = pick(compatBottoms.length > 0 ? compatBottoms : (topStyle === "ethnic" ? bottomItems : bottomItems.filter(b => !isEthnicItem(b))));
          }

          // 3. Pick compatible footwear
          if (footItems.length > 0) {
            const compatFoot = footItems.filter(f => compatStyles.includes(inferFormality(f)));
            newSelections["footwear"] = pick(compatFoot.length > 0 ? compatFoot : (topStyle === "ethnic" ? footItems : footItems.filter(f => !isEthnicItem(f))));
          }
        }
      } else {
        activeSlots.forEach((slot) => {
          const items = getSlotItems(slot);
          if (items.length > 0) {
            newSelections[slot.key] = pick(items);
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
      <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${activeSlots.length}, 1fr)` }}>
        <AnimatePresence mode="wait">
          {activeSlots.map((slot, i) => (
            <motion.div
              key={slot.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ delay: i * 0.1, type: "spring", stiffness: 200, damping: 25 }}
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
