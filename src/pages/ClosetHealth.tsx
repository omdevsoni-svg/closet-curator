import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { HeartPulse, AlertTriangle, TrendingUp, ShoppingBag, Plus } from "lucide-react";

interface ClosetItem {
  category: string;
  color: string;
  tags: string[];
}

const CATEGORIES = ["Tops", "Bottoms", "Outerwear", "Footwear", "Dresses", "Accessories"];

function computeHealth(items: ClosetItem[]) {
  if (items.length === 0) return null;

  // Versatility = coverage of categories (each covered category adds ~16%)
  const usedCats = new Set(items.map((i) => i.category));
  const versatility = Math.min(100, Math.round((usedCats.size / CATEGORIES.length) * 100));

  // Occasion coverage — check tags for common occasions
  const occasions = ["casual", "formal", "office", "party", "workout", "everyday", "summer", "winter"];
  const coveredOccasions = occasions.filter((o) =>
    items.some((i) => i.tags.some((t) => t.toLowerCase().includes(o)))
  );
  const occasionCoverage = coveredOccasions.length;

  // Color balance — more unique colors = better
  const uniqueColors = new Set(items.map((i) => i.color?.toLowerCase()).filter(Boolean));
  const colorBalance = Math.min(100, Math.round((uniqueColors.size / 6) * 100));

  // Gaps
  const gaps: { category: string; description: string; severity: string }[] = [];
  const missing = CATEGORIES.filter((c) => !usedCats.has(c));
  missing.forEach((cat) => {
    const desc: Record<string, string> = {
      Tops: "Add some shirts, tees, or blouses to your collection",
      Bottoms: "You are missing pants, jeans, or skirts",
      Outerwear: "Jackets and coats will complete your layering options",
      Footwear: "Shoes are essential for every outfit",
      Dresses: "Consider adding dresses for versatile styling",
      Accessories: "Belts, watches, and scarves can elevate your looks",
    };
    gaps.push({
      category: cat,
      description: desc[cat] || "Consider adding items in this category",
      severity: ["Tops", "Bottoms", "Footwear"].includes(cat) ? "high" : "medium",
    });
  });

  return {
    stats: [
      { label: "Versatility Score", value: versatility, max: 100, color: "text-ai" },
      { label: "Occasion Coverage", value: occasionCoverage, max: 8, color: "text-shop" },
      { label: "Color Balance", value: colorBalance, max: 100, color: "text-amber-500" },
    ],
    gaps,
  };
}

const ClosetHealth = () => {
  const navigate = useNavigate();
  const items: ClosetItem[] = (() => {
    try {
      return JSON.parse(localStorage.getItem("sv_closet_items") || "[]");
    } catch {
      return [];
    }
  })();

  const health = computeHealth(items);

  if (!health) {
    return (
      <div className="px-5 pt-8">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-shop" />
          <h1 className="text-2xl font-display font-bold tracking-tight">Closet Health</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground font-body">
          AI analysis of your wardrobe completeness
        </p>

        <div className="mt-16 flex flex-col items-center text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
            <Plus className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-700">No items in your closet</h3>
          <p className="mt-1 text-sm text-gray-400">
            Add items to your closet first to see your wardrobe health analysis
          </p>
          <button
            onClick={() => navigate("/closet")}
            className="mt-6 rounded-xl bg-gradient-to-r from-[hsl(38,90%,50%)] to-[hsl(350,80%,58%)] px-6 py-2.5 text-sm font-semibold text-white"
          >
            Go to Closet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-8">
      <div className="flex items-center gap-2">
        <HeartPulse className="h-5 w-5 text-shop" />
        <h1 className="text-2xl font-display font-bold tracking-tight">Closet Health</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground font-body">
        AI analysis of your wardrobe completeness
      </p>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        {health.stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex flex-col items-center rounded-2xl bg-card p-4"
          >
            <span className={`text-2xl font-display font-bold ${stat.color}`}>
              {stat.label === "Occasion Coverage"
                ? `${stat.value}/${stat.max}`
                : `${stat.value}%`}
            </span>
            <span className="mt-1 text-center text-[10px] font-body text-muted-foreground">
              {stat.label}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Wardrobe gaps */}
      {health.gaps.length > 0 && (
        <>
          <h2 className="mt-8 flex items-center gap-2 text-base font-display font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Wardrobe Gaps
          </h2>
          <div className="mt-3 space-y-3">
            {health.gaps.map((gap, i) => (
              <motion.div
                key={gap.category}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="flex items-start gap-3 rounded-2xl bg-card p-4"
              >
                <div className="flex-1">
                  <p className="text-sm font-display font-semibold text-foreground">
                    {gap.category}
                  </p>
                  <p className="mt-0.5 text-xs font-body text-muted-foreground">
                    {gap.description}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-body font-medium ${
                    gap.severity === "high"
                      ? "bg-red-100 text-red-600"
                      : "bg-amber-100 text-amber-600"
                  }`}
                >
                  {gap.severity}
                </span>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {health.gaps.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-8 rounded-2xl bg-green-50 p-6 text-center"
        >
          <TrendingUp className="mx-auto h-8 w-8 text-green-500" />
          <p className="mt-2 text-sm font-semibold text-green-700">Great wardrobe coverage!</p>
          <p className="mt-1 text-xs text-green-600">You have items across all major categories</p>
        </motion.div>
      )}
    </div>
  );
};

export default ClosetHealth;
