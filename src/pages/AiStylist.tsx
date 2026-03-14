import { useState, useEffect } from "react";
import {
  Sparkles,
  Send,
  PartyPopper,
  Briefcase,
  Coffee,
  Dumbbell,
  Heart,
  GraduationCap,
  ImageIcon,
  Loader2,
  Shirt,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getClosetItems, type ClothingItem } from "@/lib/database";

const occasions = [
  { label: "Date Night", icon: Heart, color: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" },
  { label: "Office", icon: Briefcase, color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  { label: "Casual", icon: Coffee, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  { label: "Party", icon: PartyPopper, color: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" },
  { label: "Workout", icon: Dumbbell, color: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" },
  { label: "Formal", icon: GraduationCap, color: "bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-300" },
];

type OutfitRecommendation = {
  occasion: string;
  items: ClothingItem[];
  tip: string;
};

/* ------------------------------------------------------------------ */
/*  Simple outfit recommendation logic                                 */
/*  (picks items from the user's real closet based on occasion tags)   */
/* ------------------------------------------------------------------ */
const occasionKeywords: Record<string, string[]> = {
  "Date Night": ["formal", "date", "elegant", "evening", "dress"],
  Office: ["office", "work", "formal", "smart-casual", "professional"],
  Casual: ["casual", "everyday", "relaxed", "weekend"],
  Party: ["party", "evening", "festive", "glam"],
  Workout: ["workout", "athletic", "gym", "sport", "activewear"],
  Formal: ["formal", "wedding", "ceremony", "suit", "gala"],
};

const tips: Record<string, string> = {
  "Date Night": "Keep it classy with a polished look. Minimal accessories add elegance.",
  Office: "Smart casual balances professionalism with comfort. Layer for versatility.",
  Casual: "Comfort is key \u2014 classic combos never go out of style.",
  Party: "Go bold with colors or statement pieces. Confidence is your best accessory.",
  Workout: "Prioritize breathable, stretchy fabrics for maximum performance.",
  Formal: "Clean lines and well-fitted pieces create a commanding presence.",
};

const generateRecommendation = (
  occasion: string,
  items: ClothingItem[]
): OutfitRecommendation | null => {
  if (items.length === 0) return null;

  const keywords = occasionKeywords[occasion] || ["casual"];

  const scored = items.map((item) => {
    let score = 0;
    const itemTags = item.tags.map((t) => t.toLowerCase());
    const itemName = item.name.toLowerCase();
    const itemCat = item.category.toLowerCase();

    for (const kw of keywords) {
      if (itemTags.includes(kw)) score += 3;
      if (itemName.includes(kw)) score += 2;
      if (itemCat.includes(kw)) score += 1;
    }
    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const picked: ClothingItem[] = [];
  const usedCategories = new Set<string>();

  for (const { item } of scored) {
    if (picked.length >= 3) break;
    if (!usedCategories.has(item.category)) {
      picked.push(item);
      usedCategories.add(item.category);
    }
  }

  if (picked.length < 3) {
    for (const { item } of scored) {
      if (picked.length >= 3) break;
      if (!picked.includes(item)) picked.push(item);
    }
  }

  if (picked.length === 0) return null;

  return {
    occasion,
    items: picked,
    tip: tips[occasion] || "Mix and match from your closet for a personalized look.",
  };
};

/* ------------------------------------------------------------------ */
/*  AI Stylist component                                               */
/* ------------------------------------------------------------------ */
const AiStylist = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [closetItems, setClosetItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [recommendation, setRecommendation] = useState<OutfitRecommendation | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const items = await getClosetItems(user.id);
      setClosetItems(items);
      setLoading(false);
    };
    load();
  }, [user]);

  const handleOccasionSelect = (label: string) => {
    setSelectedOccasion(label);
    setGenerating(true);
    setTimeout(() => {
      const rec = generateRecommendation(label, closetItems);
      setRecommendation(rec);
      setGenerating(false);
    }, 600);
  };

  const handleSubmitPrompt = () => {
    if (prompt.trim()) {
      setSelectedOccasion(prompt.trim());
      setGenerating(true);
      setTimeout(() => {
        const rec = generateRecommendation("Casual", closetItems);
        if (rec) rec.occasion = prompt.trim();
        setRecommendation(rec);
        setGenerating(false);
      }, 600);
      setPrompt("");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (closetItems.length === 0) {
    return (
      <div className="px-5 pt-8">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-ai" />
          <h1 className="text-2xl font-display font-bold tracking-tight">AI Stylist</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground font-body">
          Select an occasion or describe your vibe
        </p>
        <div className="mt-16 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-card">
            <Shirt className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <h2 className="mt-4 text-base font-display font-semibold text-foreground">
            Your closet is empty
          </h2>
          <p className="mt-1 text-sm text-muted-foreground font-body">
            Add items to your closet first so the AI can create outfit combinations
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

  return (
    <div className="px-5 pt-8">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-ai" />
        <h1 className="text-2xl font-display font-bold tracking-tight">AI Stylist</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground font-body">
        Select an occasion or describe your vibe ({closetItems.length} items available)
      </p>

      {/* Occasion presets */}
      <div className="mt-6 grid grid-cols-3 gap-2">
        {occasions.map((occ) => {
          const Icon = occ.icon;
          const isActive = selectedOccasion === occ.label;
          return (
            <motion.button
              key={occ.label}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleOccasionSelect(occ.label)}
              className={`flex flex-col items-center gap-1.5 rounded-2xl p-4 transition-all ${
                isActive
                  ? "ring-2 ring-ai shadow-lg shadow-ai/10"
                  : "bg-card hover:bg-card/80"
              } ${occ.color}`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[11px] font-medium font-body">{occ.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Custom prompt */}
      <div className="mt-5 flex items-center gap-2 rounded-2xl bg-card p-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmitPrompt()}
          placeholder="Or describe your occasion..."
          className="flex-1 bg-transparent px-3 py-2 text-sm font-body text-foreground placeholder:text-muted-foreground outline-none"
        />
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleSubmitPrompt}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-ai text-ai-foreground"
        >
          <Send className="h-4 w-4" />
        </motion.button>
      </div>

      {/* Generating state */}
      {generating && (
        <div className="mt-8 flex flex-col items-center">
          <Loader2 className="h-6 w-6 animate-spin text-ai" />
          <p className="mt-2 text-sm font-body text-muted-foreground">
            Picking the best outfit for you...
          </p>
        </div>
      )}

      {/* Recommendation */}
      <AnimatePresence mode="wait">
        {!generating && recommendation && (
          <motion.div
            key={recommendation.occasion}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mt-6"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-ai" />
              <h2 className="text-lg font-display font-semibold">
                {recommendation.occasion} Look
              </h2>
            </div>

            <div className="mt-3 flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {recommendation.items.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="shrink-0"
                >
                  <div className="h-36 w-28 overflow-hidden rounded-2xl bg-card p-2">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <p className="mt-1.5 text-center text-[10px] font-medium font-body text-foreground truncate w-28">
                    {item.name}
                  </p>
                  <p className="text-center text-[9px] font-body text-muted-foreground">
                    {item.category}
                  </p>
                </motion.div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl bg-ai/5 p-4">
              <p className="text-xs text-ai font-body font-medium">
                Styling Tip
              </p>
              <p className="mt-1 text-sm text-foreground font-body">
                {recommendation.tip}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* No recommendation possible */}
      {!generating && recommendation === null && selectedOccasion && (
        <div className="mt-8 text-center">
          <p className="text-sm font-body text-muted-foreground">
            Couldn't find a good match for \"{selectedOccasion}\" with your current items.
            Try adding more items with relevant tags.
          </p>
        </div>
      )}
    </div>
  );
};

export default AiStylist;
