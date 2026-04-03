import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shirt,
  ImageIcon,
  Loader2,
  Sparkles,
  SlidersHorizontal,
  X,
  Check,
  PackageOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { getClosetItems, type ClothingItem } from "@/lib/database";

const categories = [
  "All",
  "Tops",
  "Bottoms",
  "Outerwear",
  "Footwear",
  "Dresses",
  "Accessories",
  "Activewear",
  "Ethnic Wear",
];

const UnwornItems = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  useEffect(() => {
    const fetchItems = async () => {
      if (!user) return;
      setLoading(true);
      const allItems = await getClosetItems(user.id);
      const unworn = allItems.filter(
        (i) => !i.archived && (!i.worn_count || i.worn_count === 0)
      );
      setItems(unworn);
      setLoading(false);
    };
    fetchItems();
  }, [user]);

  const filtered = useMemo(() => {
    if (activeCategory === "All") return items;
    return items.filter((i) => i.category === activeCategory);
  }, [items, activeCategory]);

  /* Count items per category for filter badges */
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: items.length };
    for (const item of items) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, [items]);

  return (
    <div className="min-h-screen px-5 pb-28 pt-4">
      {/* Subtitle & filter */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-body text-muted-foreground">
          {loading
            ? "Loading..."
            : `${filtered.length} item${filtered.length !== 1 ? "s" : ""} you haven't worn yet`}
        </p>
        {!loading && items.length > 0 && (
          <button
            onClick={() => setShowFilterSheet(true)}
            className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-body font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filter
          </button>
        )}
      </div>

      {/* Active filter chip */}
      {activeCategory !== "All" && (
        <div className="mb-3">
          <button
            onClick={() => setActiveCategory("All")}
            className="flex items-center gap-1.5 rounded-full bg-violet-500/10 px-3 py-1.5 text-xs font-body font-medium text-violet-600 dark:text-violet-400 transition-colors hover:bg-violet-500/20"
          >
            {activeCategory}
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Category filter bottom sheet */}
      <AnimatePresence>
        {showFilterSheet && (
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
              onClick={() => setShowFilterSheet(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              className="relative z-10 w-full max-w-lg max-h-[70vh] overflow-y-auto overscroll-contain rounded-t-3xl bg-background p-5 pb-10 sm:rounded-3xl sm:pb-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-display font-bold text-foreground">
                  Filter by Category
                </h3>
                <button
                  onClick={() => setShowFilterSheet(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((cat) => {
                  const count = categoryCounts[cat] || 0;
                  const isActive = activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => {
                        setActiveCategory(cat);
                        setShowFilterSheet(false);
                      }}
                      className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-body font-medium transition-all ${
                        isActive
                          ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 ring-1 ring-violet-500/40"
                          : "bg-card text-muted-foreground hover:text-foreground hover:bg-card/80"
                      }`}
                    >
                      <span>
                        {cat}{" "}
                        <span className="text-[11px] opacity-60">({count})</span>
                      </span>
                      {isActive && <Check className="h-4 w-4" />}
                    </button>
                  );
                })}
              </div>
              {activeCategory !== "All" && (
                <button
                  onClick={() => {
                    setActiveCategory("All");
                    setShowFilterSheet(false);
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

      {/* Loading */}
      {loading && (
        <div className="mt-16 flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm font-body text-muted-foreground">
            Loading your closet...
          </p>
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="mt-16 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10 mb-4">
            <PackageOpen className="h-8 w-8 text-violet-500" />
          </div>
          <h3 className="text-lg font-display font-bold text-foreground">
            All items worn!
          </h3>
          <p className="mt-1 max-w-xs text-sm font-body text-muted-foreground">
            Great job — you've worn every item in your closet at least once.
            Keep it up!
          </p>
        </div>
      )}

      {/* Filtered empty */}
      {!loading && items.length > 0 && filtered.length === 0 && (
        <div className="mt-16 flex flex-col items-center text-center">
          <p className="text-sm font-body text-muted-foreground">
            No unworn items in "{activeCategory}".
          </p>
          <button
            onClick={() => setActiveCategory("All")}
            className="mt-2 text-sm font-body font-medium text-violet-600 dark:text-violet-400"
          >
            Show all categories
          </button>
        </div>
      )}

      {/* Items grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
              className="group"
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
                </div>
                <div className="mt-2.5">
                  <p className="truncate text-sm font-body font-semibold text-foreground">
                    {item.name}
                  </p>
                  <p className="mt-0.5 text-[11px] font-body text-muted-foreground">
                    {item.category}
                    {item.color && item.color !== "Unspecified"
                      ? ` · ${item.color}`
                      : ""}
                  </p>
                </div>
                {/* Style this button */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() =>
                    navigate("/stylist", {
                      state: { suggestFor: item.name },
                    })
                  }
                  className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 dark:from-violet-500/20 dark:to-fuchsia-500/20 py-2 text-xs font-body font-semibold text-violet-600 dark:text-violet-400 transition-colors hover:from-violet-500/20 hover:to-fuchsia-500/20"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Style this
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UnwornItems;
