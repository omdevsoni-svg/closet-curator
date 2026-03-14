import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { HeartPulse, AlertTriangle, Loader2, Shirt } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getClosetItems, type ClothingItem } from "@/lib/database";

const ALL_CATEGORIES = ["Tops", "Bottoms", "Outerwear", "Footwear", "Dresses", "Accessories", "Activewear"];
const ALL_OCCASIONS = ["casual", "formal", "office", "party", "workout", "date", "summer", "winter"];

interface HealthData {
  versatility: number;
  occasionCoverage: { found: number; total: number };
  colorBalance: number;
  gaps: { category: string; description: string; severity: "high" | "medium" }[];
}

const computeHealth = (items: ClothingItem[]): HealthData => {
  const categoriesPresent = new Set(items.map((i) => i.category));
  const versatility = Math.round((categoriesPresent.size / ALL_CATEGORIES.length) * 100);

  const allTags = items.flatMap((i) => i.tags.map((t) => t.toLowerCase()));
  const occasionsFound = ALL_OCCASIONS.filter((o) => allTags.includes(o));
  const occasionCoverage = { found: occasionsFound.length, total: ALL_OCCASIONS.length };

  const uniqueColors = new Set(items.map((i) => i.color.toLowerCase()));
  const colorBalance = Math.round(Math.min(100, (uniqueColors.size / 6) * 100));

  const gaps: HealthData["gaps"] = [];
  for (const cat of ALL_CATEGORIES) {
    if (!categoriesPresent.has(cat)) {
      gaps.push({
        category: cat,
        description: `You don't have any ${cat.toLowerCase()} in your closet`,
        severity: ["Tops", "Bottoms", "Footwear"].includes(cat) ? "high" : "medium",
      });
    }
  }

  return { versatility, occasionCoverage, colorBalance, gaps };
};

const ClosetHealth = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const data = await getClosetItems(user.id);
      setItems(data);
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
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
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-card">
            <Shirt className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <h2 className="mt-4 text-base font-display font-semibold text-foreground">
            No items in your closet
          </h2>
          <p className="mt-1 text-sm text-muted-foreground font-body">
            Add items to your closet first to see your wardrobe health analysis
          </p>
          <button
            onClick={() => navigate("/closet")}
            className="mt-4 rounded-xl bg-primary px-6 py-2.5 text-sm font-display font-semibold text-primary-foreground"
          >
            Go to Closet
          </button>
        </div>
      </div>
    );
  }

  const health = computeHealth(items);

  const healthStats = [
    { label: "Versatility Score", value: health.versatility, max: 100, color: "text-ai" },
    { label: "Occasion Coverage", value: health.occasionCoverage.found, max: health.occasionCoverage.total, color: "text-shop" },
    { label: "Color Balance", value: health.colorBalance, max: 100, color: "text-amber-500" },
  ];

  return (
    <div className="px-5 pt-8">
      <div className="flex items-center gap-2">
        <HeartPulse className="h-5 w-5 text-shop" />
        <h1 className="text-2xl font-display font-bold tracking-tight">Closet Health</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground font-body">
        AI analysis of your wardrobe completeness
      </p>

      {/* Score rings */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        {healthStats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex flex-col items-center rounded-2xl bg-card p-4"
          >
            <div className="relative h-16 w-16">
              <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--border))" strokeWidth="5" />
                <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(stat.value / stat.max) * 176} 176`} className={stat.color} />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-display font-bold">
                {stat.label === "Occasion Coverage" ? `${stat.value}/${stat.max}` : `${stat.value}%`}
              </span>
            </div>
            <span className="mt-2 text-center text-[10px] font-medium font-body text-muted-foreground">
              {stat.label}
            </span>
          </motion.div>
        ))}
      </div>
      {/* Wardrobe gaps */}
      {health.gaps.length > 0 ? (
        <div className="mt-8">
          <h2 className="flex items-center gap-2 text-base font-display font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Wardrobe Gaps
          </h2>
          <div className="mt-3 space-y-2">
            {health.gaps.map((gap, i) => (
              <motion.div
                key={gap.category}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center justify-between rounded-2xl bg-card p-4"
              >
                <div>
                  <p className="text-sm font-medium font-body text-foreground">
                    {gap.category}
                  </p>
                  <p className="text-xs text-muted-foreground font-body">
                    {gap.description}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    gap.severity === "high"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  }`}
                >
                  {gap.severity}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-8 text-center">
          <p className="text-sm font-body text-ai font-medium">
            Great wardrobe coverage! You have items across all categories.
          </p>
        </div>
      )}
    </div>
  );
};

export default ClosetHealth;
