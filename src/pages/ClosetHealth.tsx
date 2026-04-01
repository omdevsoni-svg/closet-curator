import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  HeartPulse,
  AlertTriangle,
  Loader2,
  Shirt,
  TrendingUp,
  TrendingDown,
  WashingMachine,
  Sparkles,
  ChevronRight,
  Clock,
  BarChart3,
  Palette,
  ShoppingBag,
  Paintbrush,
  Footprints,
  Layers,
  Gem,
  Dumbbell,
  Ribbon,
  Repeat,
  Target,
  Zap,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getClosetItems, returnFromLaundry, type ClothingItem } from "@/lib/database";

/* ------------------------------------------------------------------ */
/*  Recommendation types                                               */
/* ------------------------------------------------------------------ */
type RecTag = "Style Gap" | "Quick Win" | "Color Tip" | "Wardrobe Upgrade" | "Action Needed" | "Great Job";
type RecIconName = "ShoppingBag" | "Paintbrush" | "Footprints" | "Layers" | "Gem" | "Dumbbell" | "Ribbon" | "Shirt" | "Repeat" | "Target" | "WashingMachine" | "Zap" | "Sparkles";

interface StyleRec {
  text: string;
  tag: RecTag;
  icon: RecIconName;
  tagColor: string; // tailwind classes
}

const REC_ICONS: Record<RecIconName, React.ComponentType<any>> = {
  ShoppingBag, Paintbrush, Footprints, Layers, Gem, Dumbbell, Ribbon, Shirt, Repeat, Target, WashingMachine, Zap, Sparkles,
};

/* ------------------------------------------------------------------ */
/*  Constants & helpers                                                 */
/* ------------------------------------------------------------------ */
const ALL_CATEGORIES = ["Tops", "Bottoms", "Outerwear", "Footwear", "Dresses", "Accessories", "Activewear", "Ethnic Wear"];
const ALL_OCCASIONS = ["casual", "formal", "office", "party", "workout", "date", "summer", "winter"];

// CSS-friendly color mapping for the donut chart
const COLOR_MAP: Record<string, string> = {
  black: "#1a1a1a", white: "#e5e5e5", navy: "#1e3a5f", blue: "#3b82f6",
  red: "#ef4444", green: "#22c55e", beige: "#d2b48c", grey: "#9ca3af",
  pink: "#ec4899", brown: "#92400e", yellow: "#eab308", orange: "#f97316",
  purple: "#a855f7", maroon: "#7f1d1d", cream: "#fef3c7", gold: "#ca8a04",
  silver: "#c0c0c0", teal: "#14b8a6", lavender: "#c4b5fd", olive: "#6b7f3e",
  burgundy: "#800020", coral: "#ff7f50", rust: "#b7410e", peach: "#ffdab9",
  mint: "#98ff98", sky: "#87ceeb", ivory: "#fffff0", indigo: "#4f46e5",
};

const getColorHex = (color: string): string => {
  const c = color.toLowerCase().trim();
  return COLOR_MAP[c] || "#888888";
};

interface HealthData {
  versatility: number;
  occasionCoverage: { found: number; total: number };
  colorBalance: number;
  gaps: { category: string; description: string; severity: "high" | "medium" }[];
  colorBreakdown: { color: string; count: number; hex: string }[];
  categoryBreakdown: { category: string; count: number }[];
  mostWorn: ClothingItem[];
  leastWorn: ClothingItem[];
  laundryItems: ClothingItem[];
  recommendations: string[];
}

const computeHealth = (items: ClothingItem[]): HealthData => {
  const activeItems = items.filter((i) => !i.archived);

  const categoriesPresent = new Set(activeItems.map((i) => i.category));
  const versatility = Math.round((categoriesPresent.size / ALL_CATEGORIES.length) * 100);

  const allTags = activeItems.flatMap((i) => i.tags.map((t) => t.toLowerCase()));
  const occasionsFound = ALL_OCCASIONS.filter((o) => allTags.includes(o));
  const occasionCoverage = { found: occasionsFound.length, total: ALL_OCCASIONS.length };

  const uniqueColors = new Set(activeItems.map((i) => i.color.toLowerCase()));
  const colorBalance = Math.round(Math.min(100, (uniqueColors.size / 6) * 100));

  // Gaps
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

  // Color breakdown for donut chart
  const colorCounts: Record<string, number> = {};
  for (const item of activeItems) {
    const c = item.color.toLowerCase().trim();
    colorCounts[c] = (colorCounts[c] || 0) + 1;
  }
  const colorBreakdown = Object.entries(colorCounts)
    .map(([color, count]) => ({ color, count, hex: getColorHex(color) }))
    .sort((a, b) => b.count - a.count);

  // Category breakdown for bar chart
  const catCounts: Record<string, number> = {};
  for (const item of activeItems) {
    catCounts[item.category] = (catCounts[item.category] || 0) + 1;
  }
  const categoryBreakdown = ALL_CATEGORIES.map((cat) => ({
    category: cat,
    count: catCounts[cat] || 0,
  }));

  // Most worn & least worn (only items with wear data)
  const wornItems = activeItems.filter((i) => (i.worn_count || 0) > 0);
  const mostWorn = [...wornItems].sort((a, b) => (b.worn_count || 0) - (a.worn_count || 0)).slice(0, 5);
  const leastWorn = [...activeItems]
    .sort((a, b) => (a.worn_count || 0) - (b.worn_count || 0))
    .slice(0, 5);

  // Laundry items
  const laundryItems = activeItems.filter((i) => i.laundry_status === "in_laundry");

  // -- Comprehensive recommendations engine --
  const recommendations: StyleRec[] = [];
  const topCount = catCounts["Tops"] || 0;
  const bottomCount = catCounts["Bottoms"] || 0;
  const footCount = catCounts["Footwear"] || 0;
  const outerwearCount = catCounts["Outerwear"] || 0;
  const accessoryCount = catCounts["Accessories"] || 0;
  const activewearCount = catCounts["Activewear"] || 0;
  const ethnicCount = catCounts["Ethnic Wear"] || 0;
  const dressCount = catCounts["Dresses"] || 0;

  // 1. Top-to-bottom ratio imbalance
  if (topCount > 0 && bottomCount > 0) {
    const ratio = topCount / bottomCount;
    if (ratio > 2) {
      const combos = topCount * bottomCount;
      const extraBottoms = 3;
      const newCombos = topCount * (bottomCount + extraBottoms);
      recommendations.push({
        text: `${topCount} tops but only ${bottomCount} bottoms - bottoms are the bottleneck. Adding ${extraBottoms} versatile bottoms jumps your combos from ${combos} to ${newCombos}.`,
        tag: "Quick Win", icon: "ShoppingBag", tagColor: "bg-emerald-500/15 text-emerald-500",
      });
    } else if (ratio < 0.5) {
      recommendations.push({
        text: `${bottomCount} bottoms but only ${topCount} tops - a few more tops would multiply your outfit options.`,
        tag: "Quick Win", icon: "ShoppingBag", tagColor: "bg-emerald-500/15 text-emerald-500",
      });
    }
  }

  // 2. Missing essential categories
  const missingEssentials: string[] = [];
  if (topCount === 0) missingEssentials.push("tops");
  if (bottomCount === 0) missingEssentials.push("bottoms");
  if (footCount === 0) missingEssentials.push("footwear");
  if (missingEssentials.length > 0) {
    recommendations.push({
      text: `Missing ${missingEssentials.join(" and ")} entirely - these are the building blocks of every outfit.`,
      tag: "Style Gap", icon: "Shirt", tagColor: "bg-rose-500/15 text-rose-500",
    });
  }

  // 3. Footwear variety
  if (footCount > 0 && footCount < 3) {
    const footNames = activeItems.filter(i => i.category === "Footwear").map(i => i.name.toLowerCase());
    const hasRunning = footNames.some(n => n.match(/running|sneaker|trainer|athletic/));
    const hasFormal = footNames.some(n => n.match(/oxford|loafer|derby|brogue|dress\s?shoe|monk/));
    const hasCasual = footNames.some(n => n.match(/boot|chelsea|sandal|slip|canvas|espadrille/));
    const missing: string[] = [];
    if (!hasRunning) missing.push("athletic shoes");
    if (!hasFormal) missing.push("formal shoes");
    if (!hasCasual) missing.push("casual boots/sandals");
    if (missing.length > 0) {
      recommendations.push({
        text: `Only ${footCount} pair${footCount > 1 ? "s" : ""} of footwear. Consider adding ${missing.slice(0, 2).join(" or ")} to cover more occasions.`,
        tag: "Style Gap", icon: "Footprints", tagColor: "bg-rose-500/15 text-rose-500",
      });
    }
  }

  // 4. No outerwear / layering pieces
  if (outerwearCount === 0) {
    recommendations.push({
      text: `No outerwear yet - a versatile jacket or blazer opens up layering options for cooler days and dressier occasions.`,
      tag: "Wardrobe Upgrade", icon: "Layers", tagColor: "bg-blue-500/15 text-blue-500",
    });
  } else if (outerwearCount === 1) {
    recommendations.push({
      text: `Just 1 outerwear piece. A second option (casual if yours is formal, or vice versa) adds flexibility.`,
      tag: "Quick Win", icon: "Layers", tagColor: "bg-emerald-500/15 text-emerald-500",
    });
  }

  // 5. Accessory deficit
  if (accessoryCount === 0) {
    recommendations.push({
      text: `No accessories yet - even one watch, belt, or scarf can elevate a basic outfit from ordinary to put-together.`,
      tag: "Quick Win", icon: "Gem", tagColor: "bg-emerald-500/15 text-emerald-500",
    });
  }

  // 6. Ethnic wardrobe completeness
  if (ethnicCount > 0) {
    const ethnicItems = activeItems.filter(i => i.category === "Ethnic Wear");
    const ethnicTags = ethnicItems.flatMap(i => (i.tags || []).map(t => t.toLowerCase()));
    const ethnicNames = ethnicItems.map(i => i.name.toLowerCase());
    const allEthnicText = [...ethnicTags, ...ethnicNames].join(" ");
    const hasEthnicBottom = allEthnicText.match(/churidar|dhoti|pajama|salwar|palazzo|lehenga/);
    const hasEthnicFoot = allEthnicText.match(/mojari|jutti|kolhapuri|sandal|ethnic/);
    const missingEthnic: string[] = [];
    if (!hasEthnicBottom) missingEthnic.push("ethnic bottoms");
    if (!hasEthnicFoot) missingEthnic.push("ethnic footwear");
    if (missingEthnic.length > 0) {
      recommendations.push({
        text: `${ethnicCount} ethnic top${ethnicCount > 1 ? "s" : ""} but no ${missingEthnic.join(" or ")}. Completing the set unlocks full traditional looks.`,
        tag: "Style Gap", icon: "Ribbon", tagColor: "bg-rose-500/15 text-rose-500",
      });
    }
  }

  // 7. No activewear
  if (activewearCount === 0) {
    recommendations.push({
      text: `No activewear - adding athletic wear keeps your regular clothes workout-free and opens up sporty looks.`,
      tag: "Wardrobe Upgrade", icon: "Dumbbell", tagColor: "bg-blue-500/15 text-blue-500",
    });
  }

  // 8. Color monotony
  if (colorBreakdown.length > 0) {
    const topColor = colorBreakdown[0];
    if (topColor.count > activeItems.length * 0.35) {
      const neutrals = ["black", "white", "grey", "navy", "beige"];
      const isNeutral = neutrals.includes(topColor.color.toLowerCase());
      recommendations.push({
        text: isNeutral
          ? `${Math.round((topColor.count / activeItems.length) * 100)}% of your closet is ${topColor.color.toLowerCase()}. Add accent colors like burgundy, olive, or rust for more visual interest.`
          : `${topColor.color} dominates at ${Math.round((topColor.count / activeItems.length) * 100)}%. Mix in some neutrals (navy, beige, grey) for balanced outfits.`,
        tag: "Color Tip", icon: "Paintbrush", tagColor: "bg-amber-500/15 text-amber-500",
      });
    }
    const warmColors = ["red", "orange", "yellow", "brown", "coral", "rust", "peach", "gold", "burgundy"];
    const coolColors = ["blue", "navy", "green", "teal", "purple", "lavender", "mint", "indigo"];
    const hasWarm = colorBreakdown.some(c => warmColors.includes(c.color.toLowerCase()));
    const hasCool = colorBreakdown.some(c => coolColors.includes(c.color.toLowerCase()));
    if (hasWarm && !hasCool && colorBreakdown.length >= 3) {
      recommendations.push({ text: `Palette leans all warm. A cool accent (navy, teal, or olive) would add depth.`, tag: "Color Tip", icon: "Paintbrush", tagColor: "bg-amber-500/15 text-amber-500" });
    } else if (hasCool && !hasWarm && colorBreakdown.length >= 3) {
      recommendations.push({ text: `Palette is all cool tones. A warm accent (rust, brown, or burgundy) creates nice contrast.`, tag: "Color Tip", icon: "Paintbrush", tagColor: "bg-amber-500/15 text-amber-500" });
    }
  }

  // 9. Items never worn
  const neverWorn = activeItems.filter((i) => !i.worn_count || i.worn_count === 0);
  if (neverWorn.length > 3) {
    const pct = Math.round((neverWorn.length / activeItems.length) * 100);
    recommendations.push({
      text: `${neverWorn.length} pieces (${pct}%) never worn. Style one this week - or donate to make room for pieces you'll actually reach for.`,
      tag: "Action Needed", icon: "Repeat", tagColor: "bg-orange-500/15 text-orange-500",
    });
  }

  // 10. Outfit combinatorics opportunity
  if (topCount > 0 && bottomCount > 0 && footCount > 0) {
    const combos = topCount * bottomCount * footCount;
    if (combos < 50) {
      recommendations.push({
        text: `${topCount} tops x ${bottomCount} bottoms x ${footCount} shoes = ${combos} outfits. Target 100+ — boost your weakest category.`,
        tag: "Quick Win", icon: "Zap", tagColor: "bg-emerald-500/15 text-emerald-500",
      });
    }
  }

  // 11. Low occasion coverage
  if (occasionsFound.length < 4) {
    const missing = ALL_OCCASIONS.filter((o) => !allTags.includes(o));
    recommendations.push({
      text: `Covers ${occasionsFound.length}/${ALL_OCCASIONS.length} occasion types. Missing: ${missing.slice(0, 3).join(", ")}. Tag items or add key pieces.`,
      tag: "Style Gap", icon: "Target", tagColor: "bg-rose-500/15 text-rose-500",
    });
  }

  // 12. Laundry pile-up
  if (laundryItems.length > 0) {
    const oldestLaundry = laundryItems.find((i) => i.laundry_sent_at);
    if (oldestLaundry?.laundry_sent_at) {
      const daysSince = Math.floor((Date.now() - new Date(oldestLaundry.laundry_sent_at).getTime()) / 86400000);
      if (daysSince >= 3) {
        recommendations.push({
          text: `${laundryItems.length} piece${laundryItems.length > 1 ? "s" : ""} in laundry for ${daysSince}+ days - reducing available outfits by ${Math.round((laundryItems.length / activeItems.length) * 100)}%.`,
          tag: "Action Needed", icon: "WashingMachine", tagColor: "bg-orange-500/15 text-orange-500",
        });
      }
    }
  }

  // 13. No basics / versatile neutrals
  const basicKeywords = /\b(basic|plain|solid|crew\s?neck|v-neck|t-shirt|tee|white\s?shirt|jeans|chino)\b/;
  const basics = activeItems.filter(i => [i.name, ...(i.tags || [])].join(" ").toLowerCase().match(basicKeywords));
  if (basics.length < 3 && activeItems.length >= 10) {
    recommendations.push({
      text: `Need more basics - plain tees, solid shirts, and classic jeans are the "glue" that ties statement pieces together.`,
      tag: "Wardrobe Upgrade", icon: "Shirt", tagColor: "bg-blue-500/15 text-blue-500",
    });
  }

  // Fallback
  if (recommendations.length === 0 && activeItems.length > 0) {
    recommendations.push({
      text: "Your wardrobe is well-balanced across categories, colors, and occasions. Keep logging outfits for smarter insights!",
      tag: "Great Job", icon: "Sparkles", tagColor: "bg-ai/15 text-ai",
    });
  }

  return { versatility, occasionCoverage, colorBalance, gaps, colorBreakdown, categoryBreakdown, mostWorn, leastWorn, laundryItems, recommendations };
};

/* ------------------------------------------------------------------ */
/*  Donut chart component (SVG)                                        */
/* ------------------------------------------------------------------ */
const DonutChart = ({ data, size = 140 }: { data: { color: string; count: number; hex: string }[]; size?: number }) => {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return null;
  const radius = (size - 20) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;

  let accumulated = 0;
  const segments = data.map((d) => {
    const pct = d.count / total;
    const offset = accumulated;
    accumulated += pct;
    return { ...d, pct, offset };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={seg.hex}
          strokeWidth={strokeWidth}
          strokeDasharray={`${seg.pct * circumference} ${circumference}`}
          strokeDashoffset={-seg.offset * circumference}
          transform={`rotate(-90 ${cx} ${cy})`}
          className="transition-all duration-500"
        />
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" className="fill-foreground text-xl font-bold font-display">
        {data.length}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" className="fill-muted-foreground text-[10px] font-body">
        colors
      </text>
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
const ClosetHealth = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

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

  const handleReturnAll = async () => {
    const ids = health.laundryItems.map((i) => i.id);
    await returnFromLaundry(ids);
    setItems((prev) =>
      prev.map((i) =>
        ids.includes(i.id) ? { ...i, laundry_status: "available" as const, laundry_sent_at: undefined } : i
      )
    );
  };

  return (
    <div className="px-5 pt-8 pb-28">
      <div className="flex items-center gap-2">
        <HeartPulse className="h-5 w-5 text-shop" />
        <h1 className="text-2xl font-display font-bold tracking-tight">Closet Health</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground font-body">
        AI analysis of your wardrobe completeness
      </p>

      {/* AI Recommendations — Tip Cards */}
      {health.recommendations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mt-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-ai" />
            <h2 className="text-base font-display font-semibold">Your Style Story</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory" style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none" } as any}>
            {health.recommendations.map((rec: any, i: number) => {
              const IconComp = REC_ICONS[rec.icon as RecIconName] || Sparkles;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                  className="snap-start shrink-0 w-[200px] rounded-2xl bg-card p-4 flex flex-col gap-3 shadow-sm cursor-pointer active:scale-[0.97] transition-transform"
                  onClick={() => setExpandedCard(expandedCard === i ? null : i)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-ai/10">
                      <IconComp className="h-4 w-4 text-ai" />
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold font-display ${rec.tagColor}`}>
                      {rec.tag}
                    </span>
                  </div>
                  <p className="text-xs font-body text-foreground/80 leading-relaxed line-clamp-3">
                    {rec.text}
                  </p>
                  <span className="text-[10px] text-ai font-medium font-display">Tap to read more</span>
                </motion.div>
              );
            })}
          </div>

          {/* Expanded card overlay */}
          <AnimatePresence>
            {expandedCard !== null && health.recommendations[expandedCard] && (() => {
              const rec = health.recommendations[expandedCard] as any;
              const IconComp = REC_ICONS[rec.icon as RecIconName] || Sparkles;
              return (
                <motion.div
                  key="overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-8"
                  onClick={() => setExpandedCard(null)}
                >
                  <motion.div
                    initial={{ y: 80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 80, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ai/10">
                          <IconComp className="h-5 w-5 text-ai" />
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold font-display ${rec.tagColor}`}>
                          {rec.tag}
                        </span>
                      </div>
                      <button onClick={() => setExpandedCard(null)} className="text-muted-foreground text-lg font-bold leading-none">&times;</button>
                    </div>
                    <p className="text-sm font-body text-foreground/90 leading-relaxed">
                      {rec.text}
                    </p>
                  </motion.div>
                </motion.div>
              );
            })()}
          </AnimatePresence>
        </motion.div>
      )}

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
                <circle
                  cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${(stat.value / stat.max) * 176} 176`}
                  className={stat.color}
                />
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

      {/* Color Palette Donut */}
      {health.colorBreakdown.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6 rounded-2xl bg-card p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Palette className="h-4 w-4 text-ai" />
            <h2 className="text-base font-display font-semibold">Color Palette</h2>
          </div>
          <div className="flex items-center gap-6">
            <DonutChart data={health.colorBreakdown} />
            <div className="flex-1 space-y-1.5 max-h-[140px] overflow-y-auto">
              {health.colorBreakdown.map((c) => (
                <div key={c.color} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: c.hex }} />
                  <span className="text-xs font-body text-foreground capitalize flex-1">{c.color}</span>
                  <span className="text-xs font-body text-muted-foreground">{c.count}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Category Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-4 rounded-2xl bg-card p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-4 w-4 text-shop" />
          <h2 className="text-base font-display font-semibold">Category Breakdown</h2>
        </div>
        <div className="space-y-2.5">
          {health.categoryBreakdown.map((cat) => {
            const maxCount = Math.max(...health.categoryBreakdown.map((c) => c.count), 1);
            const pct = (cat.count / maxCount) * 100;
            return (
              <div key={cat.category} className="flex items-center gap-3">
                <span className="text-[11px] font-body text-muted-foreground w-20 shrink-0 text-right">
                  {cat.category}
                </span>
                <div className="flex-1 h-5 bg-background rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ delay: 0.5, duration: 0.6, ease: "easeOut" }}
                    className="h-full rounded-full bg-gradient-to-r from-ai/70 to-ai"
                  />
                </div>
                <span className="text-xs font-display font-bold w-6 text-right">{cat.count}</span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Laundry Alert */}
      {health.laundryItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="mt-4 rounded-2xl bg-blue-500/10 p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <WashingMachine className="h-4 w-4 text-blue-500" />
              <h3 className="text-sm font-display font-semibold text-blue-600 dark:text-blue-400">
                {health.laundryItems.length} item{health.laundryItems.length > 1 ? "s" : ""} in laundry
              </h3>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleReturnAll}
              className="rounded-lg bg-blue-500 px-3 py-1.5 text-[11px] font-body font-medium text-white"
            >
              Return All
            </motion.button>
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {health.laundryItems.map((item) => (
              <div key={item.id} className="shrink-0 flex flex-col items-center">
                <div className="h-12 w-10 overflow-hidden rounded-lg bg-background ring-1 ring-blue-500/20">
                  <img src={item.image_url} alt={item.name} className="h-full w-full object-contain" />
                </div>
                <p className="mt-0.5 text-[8px] font-body text-muted-foreground w-10 truncate text-center">{item.name}</p>
              </div>
            ))}
          </div>
          {health.laundryItems.some((i) => {
            if (!i.laundry_sent_at) return false;
            return (Date.now() - new Date(i.laundry_sent_at).getTime()) > 3 * 86400000;
          }) && (
            <div className="mt-2 flex items-start gap-1.5">
              <Clock className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-[11px] font-body text-amber-600 dark:text-amber-400">
                Some items have been in laundry for over 3 days!
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Most Worn Items */}
      {health.mostWorn.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-4 rounded-2xl bg-card p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <h2 className="text-base font-display font-semibold">Most Worn</h2>
          </div>
          <div className="space-y-2">
            {health.mostWorn.map((item, i) => (
              <div key={item.id} className="flex items-center gap-3">
                <span className="text-xs font-display font-bold text-muted-foreground w-4">{i + 1}</span>
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-background">
                  <img src={item.image_url} alt={item.name} className="h-full w-full object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-body font-medium text-foreground truncate">{item.name}</p>
                  <p className="text-[10px] font-body text-muted-foreground">{item.category}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-display font-bold text-green-500">{item.worn_count}</p>
                  <p className="text-[9px] font-body text-muted-foreground">wears</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Least Worn Items */}
      {health.leastWorn.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="mt-4 rounded-2xl bg-card p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="h-4 w-4 text-amber-500" />
            <h2 className="text-base font-display font-semibold">Least Worn</h2>
          </div>
          <div className="space-y-2">
            {health.leastWorn.map((item, i) => (
              <div key={item.id} className="flex items-center gap-3">
                <span className="text-xs font-display font-bold text-muted-foreground w-4">{i + 1}</span>
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-background">
                  <img src={item.image_url} alt={item.name} className="h-full w-full object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-body font-medium text-foreground truncate">{item.name}</p>
                  <p className="text-[10px] font-body text-muted-foreground">{item.category}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-display font-bold text-amber-500">{item.worn_count || 0}</p>
                  <p className="text-[9px] font-body text-muted-foreground">wears</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Wardrobe gaps */}
      {health.gaps.length > 0 && (
        <div className="mt-4">
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
                transition={{ delay: 0.6 + i * 0.05 }}
                className="flex items-center justify-between rounded-2xl bg-card p-4"
              >
                <div>
                  <p className="text-sm font-medium font-body text-foreground">{gap.category}</p>
                  <p className="text-xs text-muted-foreground font-body">{gap.description}</p>
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
      )}

    </div>
  );
};

export default ClosetHealth;
