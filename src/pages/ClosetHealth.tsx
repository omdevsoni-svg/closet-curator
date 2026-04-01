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

/* -------------------------------------------------------------------- */
/*  Recommendation types                                                */
/* -------------------------------------------------------------------- */
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

/* -------------------------------------------------------------------- */
/*  Constants & helpers                                                 */
/* -------------------------------------------------------------------- */
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
      const combos = toq½Õ¹Ð€¨‰½ÑÑ½µ½Õ¹Ðì(€€€€€½¹ÍÐ•áÑÉ…	½ÑÑ½µÌ€ô€Ìì(€€€€€½¹ÍÐ¹•Ý½µ‰½Ì€ôÑ½Á½Õ¹Ð€¨€¡‰½ÑÑ½µ½Õ¹Ð€¬•áÑÉ…	½ÑÑ½µÌ¤ì(€€€€€É•½µµ•¹‘…Ñ¥½¹Ì¹ÁÕÍ ¡ì(€€€€€€€Ñ•áÐè€‘íÑ½Á½Õ¹ÑôÑ½ÁÌ‰ÕÐ½¹±ä€‘í‰½ÑÑ½µ½Õ¹Ñô‰½ÑÑ½µÌ€´‰½ÑÑ½µÌ…É”Ñ¡”‰½ÑÑ±•¹•¬¸‘‘¥¹œ€‘í•áÑÉ…	½ÑÑ½µÍôÙ•ÉÍ…Ñ¥±”‰½ÑÑ½µÌ©ÕµÁÌå½ÕÈ½µ‰½Ì™É½´€‘í½µ‰½ÍôÑ¼€‘í¹•Ý½µ‰½Íô¹€°(€€€€€€€Ñ…œè€‰EÕ¥¬]¥¸ˆ°¥½¸è€‰M¡½ÁÁ¥¹	…œˆ°Ñ…½±½Èè€‰‰œµ•µ•É…±´ÔÀÀ¼ÄÔÑ•áÐµ•µ•É…±´ÔÀÀˆ°(€€€€€ô¤ì(€€€ô•±Í”¥˜€¡É…Ñ¥¼€ð€À¸Ô¤ì(€€€€€É•½µµ•¹‘…Ñ¥½¹Ì¹ÁÕÍ ¡ì(€€€€€€€Ñ•áÐè€‘í‰½ÑÑ½µ½Õ¹Ñô‰½ÑÑ½µÌ‰ÕÐ½¹±ä€‘íÑ½Á½Õ¹ÑôÑ½ÁÌ€´„™•Üµ½É”Ñ½ÁÌÝ½Õ±µÕ±Ñ¥Á±äå½ÕÈ½ÕÑ™¥Ð½ÁÑ¥½¹Ì¹€°(€€€€€€€Ñ…œè€‰EÕ¥¬]¥¸ˆ°¥½¸è€‰M¡½ÁÁ¥¹	…œˆ°Ñ…½±½Èè€‰‰œµ•µ•É…±´ÔÀÀ¼ÄÔÑ•áÐµ•µ•É…±´ÔÀÀˆ°(€€€€€ô¤ì(€€€ô(€ô((€€¼¼€È¸5¥ÍÍ¥¹œ•ÍÍ•¹Ñ¥…°…Ñ•½É¥•Ì(€½¹ÍÐµ¥ÍÍ¥¹ÍÍ•¹Ñ¥…±ÌèÍÑÉ¥¹mt€ômtì(€¥˜€¡Ñ½Á½Õ¹Ð€ôôô€À¤µ¥ÍÍ¥¹ÍÍ•¹Ñ¥…±Ì¹ÁÕÍ  ‰Ñ½ÁÌˆ¤ì(€¥˜€¡‰½ÑÑ½µ½Õ¹Ð€ôôô€À¤µ¥ÍÍ¥¹ÍÍ•¹Ñ¥…±Ì¹ÁÕÍ  ‰‰½ÑÑ½µÌˆ¤ì(€¥˜€¡™½½Ñ½Õ¹Ð€ôôô€À¤µ¥ÍÍ¥¹ÍÍ•¹Ñ¥…±Ì¹ÁÕÍ  ‰™½½ÑÝ•…Èˆ¤ì(€¥˜€¡µ¥ÍÍ¥¹ÍÍ•¹Ñ¥…±Ì¹±•¹Ñ €ø€À¤ì(€€€É•½µµ•¹‘…Ñ¥½¹Ì¹ÁÕÍ ¡ì(€€€€€Ñ•áÐè5¥ÍÍ¥¹œ€‘íµ¥ÍÍ¥¹ÍÍ•¹Ñ¥…±Ì¹©½¥¸ ˆ…¹€ˆ¥ô•¹Ñ¥É•±ä€´Ñ¡•Í”…É”Ñ¡”‰Õ¥±‘¥¹œ‰±½­Ì½˜•Ù•Éä½ÕÑ™¥Ð¹€°(€€€€€Ñ…œè€‰MÑå±”…Àˆ°¥½¸è€‰M¡¥ÉÐˆ°Ñ…½±½Èè€‰‰œµÉ½Í”´ÔÀÀ¼ÄÔÑ•áÐµÉ½Í”´ÔÀÀˆ°(€€€ô¤ì(€ô((€€¼¼€Ì¸½½ÑÝ•…ÈÙ…É¥•Ñä(€¥˜€¡™½½Ñ½Õ¹Ð€ø€À€˜˜™½½Ñ½Õ¹Ð€ð€Ì¤ì(€€€½¹ÍÐ™½½Ñ9…µ•Ì€ô…Ñ¥Ù•%Ñ•µÌ¹™¥±Ñ•È¡¤€ôø¤¹…Ñ•½Éä€ôôô€‰½½ÑÝ•…Èˆ¤¹µ…À¡¤€ôø¤¹¹…µ”¹Ñ½1½Ý•É…Í” ¤¤ì(€€€½¹ÍÐ¡…ÍIÕ¹¹¥¹œ€ô™½½Ñ9…µ•Ì¹Í½µ”¡¸€ôø¸¹µ…Ñ  ½ÉÕ¹¹¥¹ñÍ¹•…­•ÉñÑÉ…¥¹•Éñ…Ñ¡±•Ñ¥Œ¼¤¤ì(€€€½¹ÍÐ¡…Í½Éµ…°€ô™½½Ñ9…µ•Ì¹Í½µ”¡¸€ôø¸¹µ…Ñ  ½½á™½É‘ñ±½…™•Éñ‘•É‰åñ‰É½Õ•ñ‘É•ÍÍqÌýÍ¡½•ñµ½¹¬¼¤¤ì(€€€½¹ÍÐ¡…Í…ÍÕ…°€ô™½½Ñ9…µ•Ì¹Í½µ”¡¸€ôø¸¹µ…Ñ  ½‰½½Ññ¡•±Í•…ñÍ…¹‘…±ñÍ±¥Áñ…¹Ù…Íñ•ÍÁ…‘É¥±±”¼¤¤ì(€€€½¹ÍÐµ¥ÍÍ¥¹œèÍÑÉ¥¹mt€ômtì(€€€¥˜€ …¡…ÍIÕ¹¹¥¹œ¤µ¥ÍÍ¥¹œ¹ÁÕÍ  ‰…Ñ¡±•Ñ¥ŒÍ¡½•Ìˆ¤ì(€€€¥˜€ …¡…Í½Éµ…°¤µ¥ÍÍ¥¹œ¹ÁÕÍ  ‰™½Éµ…°Í¡½•Ìˆ¤ì(€€€¥˜€ …¡…Í…ÍÕ…°¤µ¥ÍÍ¥¹œ¹ÁÕÍ  ‰…ÍÕ…°‰½½ÑÌ½Í…¹‘…±Ìˆ¤ì(€€€¥˜€¡µ¥ÍÍ¥¹œ¹±•¹Ñ €ø€À¤ì(€€€€€É•½µµ•¹‘…Ñ¥½¹Ì¹ÁÕÍ ¡ì(€€€€€€€Ñ•áÐè=¹±ä€‘í™½½Ñ½Õ¹ÑôÁ…¥È‘í™½½Ñ½Õ¹Ð€ø€Ä€ü€‰Ìˆ€è€ˆ‰ô½˜™½½ÑÝ•…È¸½¹Í¥‘•È…‘‘¥¹œ€‘íµ¥ÍÍ¥¹œ¹Í±¥” À°€È¤¹©½¥¸ ˆ½È€ˆ¥ôÑ¼½Ù•Èµ½É”½…Í¥½¹Ì¹€°(€€€€€€€Ñ…œè€‰MÑå±”…Àˆ°¥½¸è€‰½½ÑÁÉ¥¹ÑÌˆ°Ñ…½±½Èè€‰‰œµÉ½Í”´ÔÀÀ¼ÄÔÑ•áÐµÉ½Í”´ÔÀÀˆ°(€€€€€ô¤ì(€€€ô(€ô((€€¼¼€Ð¸9¼½ÕÑ•ÉÝ•…È€¼±…å•É¥¹œÁ¥••Ì(€¥˜€¡½ÕÑ•ÉÝ•…É½Õ¹Ð€ôôô€À¤ì(€€€É•½µµ•¹‘…Ñ¥½¹Ì¹ÁÕÍ ¡ì(€€€€€Ñ•áÐè9¼½ÕÑ•ÉÝ•…Èå•Ð€´„Ù•ÉÍ…Ñ¥±”©…­•Ð½È‰±…é•È½Á•¹ÌÕÀ±…å•É¥¹œ½ÁÑ¥½¹Ì™½È½½±•È‘…åÌ…¹‘É•ÍÍ¥•È½…Í¥½¹Ì¹€°(€€€€€Ñ…œè€‰]…É‘É½‰”UÁÉ…‘”ˆ°¥½¸è€‰1…å•ÉÌˆ°Ñ…½±½Èè€‰‰œµ‰±Õ”´ÔÀÀ¼ÄÔÑ•áÐµ‰±Õ”´ÔÀÀˆ°(€€€ô¤ì(€ô•±Í”¥˜€¡½ÕÑ•ÉÝ•…É½Õ¹Ð€ôôô€Ä¤ì(€€€É•½µµ•¹‘…Ñ¥½¹Ì¹ÁÕÍ ¡ì(€€€€€Ñ•áÐè)ÕÍÐ€Ä½ÕÑ•ÉÝ•…ÈÁ¥•”¸Í•½¹½ÁÑ¥½¸€¡…ÍÕ…°¥˜å½ÕÉÌ¥Ì™½Éµ…°°½ÈÙ¥”Ù•ÉÍ„¤…‘‘Ì™±•á¥‰¥±¥Ñä¹€°(€€€€€Ñ…œè€‰EÕ¥¬]¥¸ˆ°¥½¸è€‰1…å•ÉÌˆ°Ñ…½±½Èè€‰‰œµ•µ•É…±´ÔÀÀ¼ÄÔÑ•áÐµ•µ•É…±´ÔÀÀˆ°(€€€ô¤ì(€ô((€€¼¼€Ô¸•ÍÍ½Éä‘•™¥¥Ð(€¥˜€¡…•ÍÍ½Éå½Õ¹Ð€ôôô€À¤ì(€€€É•½µµ•¹‘…Ñ¥½¹Ì¹ÁÕÍ ¡ì(€€€€€Ñ•áÐè9¼…•ÍÍ½É¥•Ìå•Ð€´•Ù•¸Û™HØ]Ú™[ÜˆØØ\™ˆØ[ˆ[]˜]HH˜\ÚXÈÝ]š]œ›ÛHÜ™[˜\žHÈ]]ÙÙ]\‹˜ˆYÎˆ”]ZXÚÈÚ[ˆ‹XÛÛŽˆ‘Ù[H‹YÐÛÛÜŽˆ˜™ËY[Y\˜[MLÌMH^Y[Y\˜[ML‹ˆJNÂˆB‚ˆËÈ‹ˆ]šXÈØ\™›Ø™HÛÛ\][™\ÜÂˆYˆ
]šXÐÛÝ[ˆ
HÂˆÛÛœÝ]šXÒ][\ÈHXÝ]™R][\Ë™š[\ŠHOˆK˜Ø]YÛÜžHOOH‘]šXÈÙX\ˆŠNÂˆÛÛœÝ]šXÕYÜÈH]šXÒ][\Ë™›]X\
HOˆ
KYÜÈ×JK›X\
OˆÓÝÙ\Ø\ÙJ
JJNÂˆÛÛœÝ]šXÓ˜[Y\ÈH]šXÒ][\Ë›X\
HOˆK›˜[YKÓÝÙ\Ø\ÙJ
JNÂˆÛÛœÝ[]šXÕ^HË‹‹™]šXÕYÜË‹‹™]šXÓ˜[Y\×Kš›Ú[ŠˆŠNÂˆÛÛœÝ\Ñ]šXÐ›ÝÛHH[]šXÕ^›X]Ú
ØÚ\šY\ŸÝ_Z˜[X_Ø[Ø\Ÿ[^ž›ßZ[™ØKÊNÂˆÛÛœÝ\Ñ]šXÑ›ÛÝH[]šXÕ^›X]Ú
Û[Ú˜\š_]_ÛÛ\\š_Ø[™[]šXËÊNÂˆÛÛœÝZ\ÜÚ[™Ñ]šXÎˆÝš[™Ö×HH×NÂˆYˆ
Z\Ñ]šXÐ›ÝÛJHZ\ÜÚ[™Ñ]šXËœ\Ú
™]šXÈ›ÝÛ\ÈŠNÂˆYˆ
Z\Ñ]šXÑ›ÛÝ
HZ\ÜÚ[™Ñ]šXËœ\Ú
™]šXÈ›ÛÝÙX\ˆŠNÂˆYˆ
Z\ÜÚ[™Ñ]šXË›[™Ýˆ
HÂˆ™XÛÛ[Y[™][ÛœËœ\Ú
Âˆ^ˆ	Ù]šXÐÛÝ[H]šXÈÜ	Ù]šXÐÛÝ[ˆHÈœÈˆˆˆŸH]›È	ÛZ\ÜÚ[™Ñ]šXËš›Ú[ŠˆÜˆŠ_KˆÛÛ\][™ÈHÙ][›ØÚÜÈ[˜Y][Û˜[ÛÚÜË˜ˆYÎˆ”Ý[HØ\‹XÛÛŽˆ”šX˜›Ûˆ‹YÐÛÛÜŽˆ˜™Ë\›ÜÙKMLÌMH^\›ÜÙKML‹ˆJNÂˆBˆB‚ˆËÈËˆ›ÈXÝ]™]ÙX\‚ˆYˆ
XÝ]™]ÙX\ÛÝ[OOH
HÂˆ™XÛÛ[Y[™][ÛœËœ\Ú
Âˆ^ˆ›ÈXÝ]™]ÙX\ˆHY[™È]]XÈÙX\ˆÙY\È[Ý\ˆ™YÝ[\ˆÛÝ\ÈÛÜšÛÝ]Yœ™YH[™Ü[œÈ\ÜÜHÛÚÜË˜ˆYÎˆ•Ø\™›Ø™H\Ü˜YH‹XÛÛŽˆ‘[X˜™[‹YÐÛÛÜŽˆ˜™ËX›YKMLÌMH^X›YKML‹ˆJNÂˆB‚ˆËÈˆÛÛÜˆ[Û›ÝÛžBˆYˆ
ÛÛÜœ™XZÙÝÛ‹›[™Ýˆ
HÂˆÛÛœÝÜÛÛÜˆHÛÛÜœ™XZÙÝÛ–ÌNÂˆYˆ
ÜÛÛÜ‹˜ÛÝ[ˆXÝ]™R][\Ë›[™Ý
ˆŒÍJHÂˆÛÛœÝ™]]˜[ÈHÈ˜›XÚÈ‹Ú]H‹™Ü™^H‹›˜]žH‹˜™ZYÙH—NÂˆÛÛœÝ\Ó™]]˜[H™]]˜[Ëš[˜ÛY\ÊÜÛÛÜ‹˜ÛÛÜ‹ÓÝÙ\Ø\ÙJ
JNÂˆ™XÛÛ[Y[™][ÛœËœ\Ú
Âˆ^ˆ\Ó™]]˜[ˆÈ	ÓX]œ›Ý[™

ÜÛÛÜ‹˜ÛÝ[ÈXÝ]™R][\Ë›[™Ý
H
ˆL
_IHÙˆ[Ý\ˆÛÜÙ]\È	ÝÜÛÛÜ‹˜ÛÛÜ‹ÓÝÙ\Ø\ÙJ
_KˆYXØÙ[ÛÛÜœÈZÙH\™Ý[™KÛ]™KÜˆ\Ý›Üˆ[Ü™Hš\ÝX[[\™\Ý˜ˆˆ	ÝÜÛÛÜ‹˜ÛÛÜŸHÛZ[˜]\È]	ÓX]œ›Ý[™

ÜÛÛÜ‹˜ÛÝ[ÈXÝ]™R][\Ë›[™Ý
H
ˆL
_IKˆZ^[ˆÛÛYH™]]˜[È
˜]žK™ZYÙKÜ™^JH›Üˆ˜[[˜ÙYÝ]š]Ë˜ˆYÎˆÛÛÜˆ\‹XÛÛŽˆ”Z[œ\Ú‹YÐÛÛÜŽˆ˜™ËX[X™\‹MLÌMH^X[X™\‹ML‹ˆJNÂˆBˆÛÛœÝØ\›PÛÛÜœÈHÈœ™Y‹›Ü˜[™ÙH‹žY[ÝÈ‹˜œ›ÝÛˆ‹˜ÛÜ˜[‹œ\Ý‹œXXÚ‹™ÛÛ‹˜\™Ý[™H—NÂˆÛÛœÝÛÛÛÛÛÜœÈHÈ˜›YH‹›˜]žH‹™Ü™Y[ˆ‹X[‹œ\œH‹›]™[™\ˆ‹›Z[‹š[™YÛÈ—NÂˆÛÛœÝ\ÕØ\›HHÛÛÜœ™XZÙÝÛ‹œÛÛYJÈOˆØ\›PÛÛÜœËš[˜ÛY\ÊË˜ÛÛÜ‹ÓÝÙ\Ø\ÙJ
JJNÂˆÛÛœÝ\ÐÛÛÛHÛÛÜœ™XZÙÝÛ‹œÛÛYJÈOˆÛÛÛÛÛÜœËš[˜ÛY\ÊË˜ÛÛÜ‹ÓÝÙ\Ø\ÙJ
JJNÂˆYˆ
\ÕØ\›H	‰ˆZ\ÐÛÛÛ	‰ˆÛÛÜœ™XZÙÝÛ‹›[™ÝHÊHÂˆ™XÛÛ[Y[™][ÛœËœ\Ú
È^ˆ[]HX[œÈ[Ø\›KˆHÛÛÛXØÙ[
˜]žKX[ÜˆÛ]™JHÛÝ[Y\˜YÎˆÛÛÜˆ\‹XÛÛŽˆ”Z[œ\Ú‹ÁgColor: "bg-amber-500/15 text-amber-500" });
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
        text: `${topCount} tops x ${bottomCount} bottoms x ${footCount} shoes = ${combos} outfits. Target 100+ â€” boost your weakest category.`,
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

/* -------------------------------------------------------------------- */
/*  Donut chart component (SVG)                                        */
/* -------------------------------------------------------------------- */
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

/* -------------------------------------------------------------------- */
/*  Main component                                                      */
/* -------------------------------------------------------------------- */
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
        <Loader2 className="h-6 w-6 animate-spin text-mÕÑ•µ™½É•É½Õ¹ˆ€¼ø(€€€€€€ð½‘¥Øø(€€€€¤ì(€ô((€¥˜€¡¥Ñ•µÌ¹±•¹Ñ €ôôô€À¤ì(€€€É•ÑÕÉ¸€ (€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ÔÁÐ´àˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Èˆø(€€€€€€€€€€ñ!•…ÉÑAÕ±Í”±…ÍÍ9…µ”ô‰ ´ÔÜ´ÔÑ•áÐµÍ¡½Àˆ€¼ø(€€€€€€€€€€ñ Ä±…ÍÍ9…µ”ô‰Ñ•áÐ´Éá°™½¹Ðµ‘¥ÍÁ±…ä™½¹Ðµ‰½±ÑÉ…­¥¹œµÑ¥¡Ðˆù±½Í•Ð!•…±Ñ ð½ Äø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñÀ±…ÍÍ9…µ”ô‰µÐ´ÄÑ•áÐµÍ´Ñ•áÐµµÕÑ•µ™½É•É½Õ¹™½¹Ðµ‰½‘äˆø(€€€€€€€€€$…¹…±åÍ¥Ì½˜å½ÕÈÝ…É‘É½‰”½µÁ±•Ñ•¹•ÍÌ(€€€€€€€€ð½Àø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µÐ´ÄØ™±•à™±•àµ½°¥Ñ•µÌµ•¹Ñ•ÈÑ•áÐµ•¹Ñ•Èˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à ´ÄØÜ´ÄØ¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹Ñ•ÈÉ½Õ¹‘•µ™Õ±°‰œµ…Éˆø(€€€€€€€€€€€€ñM¡¥ÉÐ±…ÍÍ9…µ”ô‰ ´àÜ´àÑ•áÐµµÕÑ•µ™½É•É½Õ¹¼ÌÀˆ€¼ø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ñ È±…ÍÍ9…µ”ô‰µÐ´ÐÑ•áÐµ‰…Í”™½¹Ðµ‘¥ÍÁ±…ä™½¹ÐµÍ•µ¥‰½±Ñ•áÐµ™½É•É½Õ¹ˆø(€€€€€€€€€€€9¼¥Ñ•µÌ¥¸å½ÕÈ±½Í•Ð(€€€€€€€€€€ð½ Èø(€€€€€€€€€€ñÀ±…ÍÍ9…µ”ô‰µÐ´ÄÑ•áÐµÍ´Ñ•áÐµµÕÑ•µ™½É•É½Õ¹™½¹Ðµ‰½‘äˆø(€€€€€€€€€€€‘¥Ñ•µÌÑ¼å½ÕÈ±½Í•Ð™¥ÉÍÐÑ¼Í•”å½ÕÈÝ…É‘É½‰”¡•…±Ñ …¹…±åÍ¥Ì(€€€€€€€€€€ð½Àø(€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€½¹±¥¬õì ¤€ôø¹…Ù¥…Ñ” ˆ½±½Í•Ðˆ¥ô(€€€€€€€€€€€±…ÍÍ9…µ”ô‰µÐ´ÐÉ½Õ¹‘•µá°‰œµÁÉ¥µ…ÉäÁà´ØÁä´È¸ÔÑ•áÐµÍ´™½¹Ðµ‘¥ÍÁ±…ä™½¹ÐµÍ•µ¥‰½±Ñ•áÐµÁÉ¥µ…Éäµ™½É•É½Õ¹ˆ(€€€€€€€€€€ø(€€€€€€€€€€€¼Ñ¼±½Í•Ð(€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€ð½‘¥Øø(€€€€€€ð½‘¥Øø(€€€€¤ì(€ô((€½¹ÍÐ¡•…±Ñ €ô½µÁÕÑ•!•…±Ñ ¡¥Ñ•µÌ¤ì((€½¹ÍÐ¡•…±Ñ¡MÑ…ÑÌ€ôl(€€€ì±…‰•°è€‰Y•ÉÍ…Ñ¥±¥ÑäM½É”ˆ°Ù…±Õ”è¡•…±Ñ ¹Ù•ÉÍ…Ñ¥±¥Ñä°µ…àè€ÄÀÀ°½±½Èè€‰Ñ•áÐµ…¤ˆô°(€€€ì±…‰•°è€‰=…Í¥½¸½Ù•É…”ˆ°Ù…±Õ”è¡•…±Ñ ¹½…Í¥½¹½Ù•É…”¹™½Õ¹°µ…àè¡•…±Ñ ¹½…Í¥½¹½Ù•É…”¹Ñ½Ñ…°°½±½Èè€‰Ñ•áÐµÍ¡½Àˆô°(€€€ì±…‰•°è€‰½±½È	…±…¹”ˆ°Ù…±Õ”è¡•…±Ñ ¹½±½É	…±…¹”°µ…àè€ÄÀÀ°½±½Èè€‰Ñ•áÐµ…µ‰•È´ÔÀÀˆô°(€tì((€½¹ÍÐ¡…¹‘±•I•ÑÕÉ¹±°€ô…Íå¹Œ€ ¤€ôøì(€€€½¹ÍÐ¥‘Ì€ô¡•…±Ñ ¹±…Õ¹‘Éå%Ñ•µÌ¹µ…À ¡¤¤€ôø¤¹¥¤ì(€€€…Ý…¥ÐÉ•ÑÕÉ¹É½µ1…Õ¹‘Éä¡¥‘Ì¤ì(€€€Í•Ñ%Ñ•µÌ ¡ÁÉ•Ø¤€ôø(€€€€€ÁÉ•Ø¹µ…À ¡¤¤€ôø(€€€€€€€¥‘Ì¹¥¹±Õ‘•Ì¡¤¹¥¤€üì€¸¸¹¤°±…Õ¹‘Éå}ÍÑ…ÑÕÌè€‰…Ù…¥±…‰±”ˆ…Ì½¹ÍÐ°±…Õ¹‘Éå}Í•¹Ñ}…ÐèÕ¹‘•™¥¹•ô€è¤(€€€€€€¤(€€€€¤ì(€ôì((€É•ÑÕÉ¸€ (€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ÔÁÐ´àÁˆ´Èàˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Èˆø(€€€€€€€€ñ!•…ÉÑAÕ±Í”±…ÍÍ9…µ”ô‰ ´ÔÜ´ÔÑ•áÐµÍ¡½Àˆ€¼ø(€€€€€€€€ñ Ä±…ÍÍ9…µ”ô‰Ñ•áÐ´Éá°™½¹Ðµ‘¥ÍÁ±…ä™½¹Ðµ‰½±ÑÉ…­¥¹œµÑ¥¡Ðˆù±½Í•Ð!•…±Ñ ð½ Äø(€€€€€€ð½‘¥Øø(€€€€€€ñÀ±…ÍÍ9…µ”ô‰µÐ´ÄÑ•áÐµÍ´Ñ•áÐµµÕÑ•µ™½É•É½Õ¹™½¹Ðµ‰½‘äˆø(€€€€€€€$…¹…±åÍ¥Ì½˜å½ÕÈÝ…É‘É½‰”½µÁ±•Ñ•¹•ÍÌ(€€€€€€ð½Àø((€€€€€ì¼¨$I•½µµ•¹‘…Ñ¥½¹ÌƒŠPQ¥À…É‘Ì€¨½ô(€€€€€í¡•…±Ñ ¹É•½µµ•¹‘…Ñ¥½¹Ì¹±•¹Ñ €ø€À€˜˜€ (€€€€€€€€ñµ½Ñ¥½¸¹‘¥Ø(€€€€€€€€€¥¹¥Ñ¥…°õíì½Á…¥Ñäè€À°äè€ÄÈõô(€€€€€€€€€…¹¥µ…Ñ”õíì½Á…¥Ñäè€Ä°äè€Àõô(€€€€€€€€€ÑÉ…¹Í¥Ñ¥½¸õíì‘•±…äè€À¸ÀÔõô(€€€€€€€€€±…ÍÍ9…µ”ô‰µÐ´Ôˆ(€€€€€€€€ø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Èµˆ´Ìˆø(€€€€€€€€€€€€ñMÁ…É­±•Ì±…ÍÍ9…µ”ô‰ ´ÐÜ´ÐÑ•áÐµ…¤ˆ€¼ø(€€€€€€€€€€€€ñ È±…ÍÍ9…µ”ô‰Ñ•áÐµ‰…Í”™½¹Ðµ‘¥ÍÁ±…ä™½¹ÐµÍ•µ¥‰½±ˆùe½ÕÈMÑå±”MÑ½Éäð½ Èø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à…À´Ì½Ù•É™±½Üµàµ…ÕÑ¼Áˆ´ÈÍ¹…ÀµàÍ¹…Àµµ…¹‘…Ñ½ÉäˆÍÑå±”õíì]•‰­¥Ñ=Ù•É™±½ßScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none" } as any}>
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
                  className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-24"
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
