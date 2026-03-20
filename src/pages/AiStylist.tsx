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
  Camera,
  X,
  ArrowRight,
  Check,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getClosetItems, getProfile, type ClothingItem, type Profile } from "@/lib/database";
import {
  virtualTryOn,
  fileToBase64,
  urlToBase64,
  getOutfitRecommendation,
  type OutfitCombination,
} from "@/lib/ai-service";

const occasions = [
  { label: "Date Night", icon: Heart, color: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" },
  { label: "Office", icon: Briefcase, color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  { label: "Casual", icon: Coffee, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  { label: "Party", icon: PartyPopper, color: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" },
  { label: "Workout", icon: Dumbbell, color: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" },
  { label: "Formal", icon: GraduationCap, color: "bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-300" },
];

type ResolvedCombination = {
  label: string;
  slots: { slot: string; item: ClothingItem }[];
  items: ClothingItem[];
  tip: string;
  reasoning: string[];
  missing: string | null;
};

/* ------------------------------------------------------------------ */
/*  Virtual Try-On Modal — now accepts specific outfit items           */
/* ------------------------------------------------------------------ */
interface TryOnModalProps {
  isOpen: boolean;
  onClose: () => void;
  outfitItems: ClothingItem[];
  allClosetItems: ClothingItem[];
  userId: string;
  comboLabel?: string;
}

const TryOnModal = ({ isOpen, onClose, outfitItems, allClosetItems, userId, comboLabel }: TryOnModalProps) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<"loading" | "no-photo" | "select" | "generating" | "result">("loading");
  const [personPhoto, setPersonPhoto] = useState<string | null>(null);
  const [bodyPhotoBase64, setBodyPhotoBase64] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"outfit" | "closet">("outfit");

  useEffect(() => {
    if (!isOpen || !userId) return;
    const loadProfilePhoto = async () => {
      setStep("loading");
      try {
        const profile = await getProfile(userId);
        const bodyUrl = profile?.body_image_url;
        if (bodyUrl) {
          setPersonPhoto(bodyUrl);
          const bodyB64 = await urlToBase64(bodyUrl);
          setBodyPhotoBase64(bodyB64);
          setStep("select");
        } else {
          setStep("no-photo");
        }
      } catch (err) {
        console.error("Failed to load profile photo:", err);
        setStep("no-photo");
      }
    };
    loadProfilePhoto();
  }, [isOpen, userId]);

  const handleTryOn = async () => {
    if (!bodyPhotoBase64 || !selectedItem) return;
    setStep("generating");
    setError(null);

    try {
      let productBase64: string;
      if (selectedItem.image_url) {
        productBase64 = await urlToBase64(selectedItem.image_url);
      } else {
        setError("Selected item has no image. Please choose an item with a photo.");
        setStep("select");
        return;
      }

      const results = await virtualTryOn(bodyPhotoBase64, productBase64, 1);

      if (results.length > 0) {
        setResultImage(`data:${results[0].mimeType};base64,${results[0].base64}`);
        setStep("result");
      } else {
        setError("Couldn't generate try-on. Try a different item or photo.");
        setStep("select");
      }
    } catch (err) {
      console.error("Try-on error:", err);
      setError("Something went wrong. Please try again.");
      setStep("select");
    }
  };

  const reset = () => {
    setSelectedItem(null);
    setResultImage(null);
    setError(null);
    if (bodyPhotoBase64) setStep("select");
    else setStep("no-photo");
  };

  const displayItems = mode === "outfit"
    ? outfitItems.filter((item) => item.image_url)
    : allClosetItems.filter((item) => item.image_url);

  return (
    <AnimatePresence>
      {isOpen && (
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
            className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-background p-6 pb-24 sm:rounded-3xl sm:pb-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-ai" />
                <h2 className="text-lg font-display font-bold text-foreground">
                  Virtual Try-On
                </h2>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {comboLabel && step === "select" && (
              <p className="mt-1 text-xs font-body text-ai">{comboLabel} outfit</p>
            )}

            {/* Loading profile photo */}
            {step === "loading" && (
              <div className="mt-8 flex flex-col items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-ai" />
                <p className="mt-3 text-sm font-body text-muted-foreground">
                  Loading your profile photo...
                </p>
              </div>
            )}

            {/* No profile photo */}
            {step === "no-photo" && (
              <div className="mt-6 flex flex-col items-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-card">
                  <Camera className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <h3 className="mt-4 text-base font-display font-semibold text-foreground">
                  Full-body photo needed
                </h3>
                <p className="mt-1.5 text-sm font-body text-muted-foreground">
                  Upload a full-body photo in your Profile to use Virtual Try-On.
                </p>
                <button
                  onClick={() => { onClose(); navigate("/profile"); }}
                  className="mt-5 flex items-center gap-2 rounded-xl bg-ai px-6 py-3 text-sm font-display font-semibold text-ai-foreground"
                >
                  Go to Profile
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Select clothing item */}
            {step === "select" && (
              <div className="mt-4">
                <div className="flex items-center gap-3 rounded-xl bg-card p-3">
                  <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg">
                    <img src={personPhoto!} alt="You" className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-body font-medium text-foreground">Your photo</p>
                    <p className="text-[11px] font-body text-muted-foreground">
                      Tap on an item below to try it on
                    </p>
                  </div>
                  <button
                    onClick={() => { onClose(); navigate("/profile"); }}
                    className="text-xs font-body text-ai underline"
                  >
                    Change
                  </button>
                </div>

                {error && (
                  <div className="mt-3 rounded-xl bg-red-500/10 px-4 py-2.5">
                    <p className="text-xs font-body text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                {/* Toggle between outfit items and full closet */}
                {outfitItems.length > 0 && (
                  <div className="mt-3 flex rounded-xl bg-card p-1">
                    <button
                      onClick={() => setMode("outfit")}
                      className={`flex-1 rounded-lg py-2 text-xs font-body font-medium transition-all ${
                        mode === "outfit" ? "bg-ai text-ai-foreground shadow-sm" : "text-muted-foreground"
                      }`}
                    >
                      Outfit Items ({outfitItems.filter(i => i.image_url).length})
                    </button>
                    <button
                      onClick={() => setMode("closet")}
                      className={`flex-1 rounded-lg py-2 text-xs font-body font-medium transition-all ${
                        mode === "closet" ? "bg-ai text-ai-foreground shadow-sm" : "text-muted-foreground"
                      }`}
                    >
                      All Closet ({allClosetItems.filter(i => i.image_url).length})
                    </button>
                  </div>
                )}

                <div className="mt-4">
                  <p className="text-xs font-medium font-body uppercase tracking-wider text-muted-foreground">
                    Select an item ({displayItems.length} available)
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2 max-h-[40vh] overflow-y-auto">
                    {displayItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className={`rounded-xl p-2 transition-all ${
                          selectedItem?.id === item.id
                            ? "ring-2 ring-ai bg-ai/5"
                            : "bg-card hover:bg-card/80"
                        }`}
                      >
                        <div className="aspect-square overflow-hidden rounded-lg bg-background">
                          <img src={item.image_url} alt={item.name} className="h-full w-full object-contain" />
                        </div>
                        <p className="mt-1 text-[10px] font-body font-medium text-foreground truncate">
                          {item.name}
                        </p>
                        {selectedItem?.id === item.id && (
                          <div className="mt-1 flex items-center justify-center">
                            <Check className="h-3 w-3 text-ai" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleTryOn}
                  disabled={!selectedItem}
                  className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ai text-ai-foreground font-display font-semibold transition-all disabled:opacity-40"
                >
                  <Sparkles className="h-4 w-4" />
                  Try It On
                </motion.button>
              </div>
            )}

            {/* Generating */}
            {step === "generating" && (
              <div className="mt-8 flex flex-col items-center py-8">
                <Loader2 className="h-10 w-10 animate-spin text-ai" />
                <p className="mt-4 text-sm font-body font-medium text-foreground">
                  Creating your look...
                </p>
                <p className="mt-1 text-xs font-body text-muted-foreground">
                  This may take 15-30 seconds
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-16 w-12 overflow-hidden rounded-lg">
                    <img src={personPhoto!} alt="You" className="h-full w-full object-cover" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <div className="h-16 w-12 overflow-hidden rounded-lg bg-card">
                    <img src={selectedItem?.image_url} alt={selectedItem?.name} className="h-full w-full object-contain" />
                  </div>
                </div>
              </div>
            )}

            {/* Result */}
            {step === "result" && resultImage && (
              <div className="mt-4">
                <div className="overflow-hidden rounded-2xl bg-card">
                  <img src={resultImage} alt="Virtual Try-On Result" className="w-full object-contain" />
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-ai/10 px-4 py-2.5">
                  <Sparkles className="h-4 w-4 text-ai" />
                  <span className="text-xs font-body text-ai font-medium">
                    AI-generated preview — {selectedItem?.name}
                  </span>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={reset}
                    className="flex-1 rounded-xl bg-card py-3 text-sm font-body font-medium text-foreground"
                  >
                    Try Another
                  </button>
                  <button
                    onClick={() => { setSelectedItem(null); setResultImage(null); setStep("select"); }}
                    className="flex-1 rounded-xl bg-ai py-3 text-sm font-body font-medium text-ai-foreground"
                  >
                    Try Different Item
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ------------------------------------------------------------------ */
/*  Combination Card                                                   */
/* ------------------------------------------------------------------ */
interface CombinationCardProps {
  combo: ResolvedCombination;
  index: number;
  isActive: boolean;
  onTryOn: () => void;
}

const CombinationCard = ({ combo, index, isActive, onTryOn }: CombinationCardProps) => {
  const [expanded, setExpanded] = useState(false);

  const slotLabels: Record<string, string> = {
    topwear: "Top",
    bottomwear: "Bottom",
    footwear: "Shoes",
    dress: "Dress",
    outerwear: "Layer",
    accessory: "Accessory",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.12 }}
      className={`rounded-2xl border transition-all ${
        isActive
          ? "border-ai/30 bg-ai/5 shadow-lg shadow-ai/5"
          : "border-border/50 bg-card"
      }`}
    >
      {/* Card header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-ai/10 text-[10px] font-bold text-ai">
            {index + 1}
          </div>
          <h3 className="text-sm font-display font-semibold text-foreground">
            {combo.label}
          </h3>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onTryOn}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[hsl(43,70%,50%)] to-[hsl(220,10%,65%)] px-3 py-1.5 text-[11px] font-display font-semibold text-white shadow-sm"
        >
          <Camera className="h-3 w-3" />
          Try On
        </motion.button>
      </div>

      {/* Outfit items — horizontal scroll with slot labels */}
      <div className="flex gap-3 overflow-x-auto px-4 py-3 scrollbar-none">
        {combo.slots.length > 0
          ? combo.slots.map(({ slot, item }, i) => (
              <motion.div
                key={item.id + "-" + slot}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.12 + i * 0.08 }}
                className="shrink-0 flex flex-col items-center"
              >
                <p className="mb-1 text-[9px] font-body font-semibold uppercase tracking-wider text-ai/70">
                  {slotLabels[slot] || slot}
                </p>
                <div className="h-28 w-22 overflow-hidden rounded-xl bg-background p-1.5">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <p className="mt-1 text-center text-[9px] font-medium font-body text-foreground truncate w-20">
                  {item.name}
                </p>
              </motion.div>
            ))
          : combo.items.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.12 + i * 0.08 }}
                className="shrink-0"
              >
                <div className="h-28 w-22 overflow-hidden rounded-xl bg-background p-1.5">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <p className="mt-1 text-center text-[9px] font-medium font-body text-foreground truncate w-20">
                  {item.name}
                </p>
                <p className="text-center text-[8px] font-body text-muted-foreground">
                  {item.category}
                </p>
              </motion.div>
            ))}
      </div>

      {/* Tip */}
      <div className="mx-4 mb-3 rounded-xl bg-ai/5 px-3 py-2">
        <p className="text-[11px] text-ai font-body font-medium">
          {combo.tip}
        </p>
      </div>

      {/* Expandable reasoning */}
      <div className="px-4 pb-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[10px] font-body text-muted-foreground hover:text-foreground transition-colors"
        >
          <Sparkles className="h-2.5 w-2.5" />
          {expanded ? "Hide" : "Why these picks"}
          <ChevronRight className={`h-2.5 w-2.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </button>
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-1">
                {combo.reasoning.map((reason, i) => (
                  <p key={i} className="text-[10px] font-body text-muted-foreground">
                    {reason}
                  </p>
                ))}
              </div>
              {combo.missing && (
                <div className="mt-2 flex items-start gap-1">
                  <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500 mt-0.5" />
                  <p className="text-[10px] font-body text-amber-600 dark:text-amber-400">
                    {combo.missing}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

/* ------------------------------------------------------------------ */
/*  AI Stylist component                                               */
/* ------------------------------------------------------------------ */
const AiStylist = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [closetItems, setClosetItems] = useState<ClothingItem[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [combinations, setCombinations] = useState<ResolvedCombination[]>([]);
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [tryOnCombo, setTryOnCombo] = useState<ResolvedCombination | null>(null);
  const [showTryOn, setShowTryOn] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [items, prof] = await Promise.all([
        getClosetItems(user.id),
        getProfile(user.id),
      ]);
      setClosetItems(items);
      setProfile(prof);
      setLoading(false);
    };
    load();
  }, [user]);

  const fetchRecommendations = async (occasion: string) => {
    setSelectedOccasion(occasion);
    setGenerating(true);
    setAiError(null);
    setCombinations([]);

    try {
      const result = await getOutfitRecommendation({
        occasion,
        items: closetItems.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          color: item.color,
          tags: item.tags,
          material: item.material,
          gender: item.gender,
          image_url: item.image_url,
        })),
        profile: profile?.personalization
          ? {
              body_type: profile.body_type,
              skin_tone: profile.skin_tone,
              model_gender: profile.model_gender,
            }
          : undefined,
      });

      if (result.success) {
        const resolved: ResolvedCombination[] = result.combinations.map((combo) => {
          const resolvedSlots = combo.slots
            .map((s) => {
              const item = closetItems.find((i) => i.id === s.item_id);
              return item ? { slot: s.slot, item } : null;
            })
            .filter(Boolean) as { slot: string; item: ClothingItem }[];

          const resolvedItems = combo.item_ids
            .map((id) => closetItems.find((i) => i.id === id))
            .filter(Boolean) as ClothingItem[];

          const reasoning = combo.reasoning.map((r) => {
            const item = closetItems.find((i) => i.id === r.id);
            return `${item?.name || "Item"}: ${r.reason}`;
          });

          return {
            label: combo.label,
            slots: resolvedSlots,
            items: resolvedItems,
            tip: combo.tip,
            reasoning,
            missing: combo.missing,
          };
        });

        setCombinations(resolved);
      } else {
        setAiError(result.error);
      }
    } catch {
      setAiError("Something went wrong. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleOccasionSelect = (label: string) => {
    fetchRecommendations(label);
  };

  const handleSubmitPrompt = () => {
    if (prompt.trim()) {
      fetchRecommendations(prompt.trim());
      setPrompt("");
    }
  };

  const handleTryOnCombo = (combo: ResolvedCombination) => {
    setTryOnCombo(combo);
    setShowTryOn(true);
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
    <div className="px-5 pt-8 pb-28">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-ai" />
            <h1 className="text-2xl font-display font-bold tracking-tight">AI Stylist</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground font-body">
            Get 3 outfit combinations for any occasion ({closetItems.length} items)
          </p>
        </div>
      </div>

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
            AI is crafting 3 outfit combinations...
          </p>
          <p className="mt-1 text-[11px] font-body text-muted-foreground/60">
            Powered by Gemini
          </p>
        </div>
      )}

      {/* AI Error */}
      {!generating && aiError && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-red-500/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
          <div>
            <p className="text-sm font-body font-medium text-red-600 dark:text-red-400">
              Couldn't generate recommendations
            </p>
            <p className="mt-0.5 text-xs font-body text-red-500/80">{aiError}</p>
          </div>
        </div>
      )}

      {/* Combinations */}
      <AnimatePresence mode="wait">
        {!generating && combinations.length > 0 && (
          <motion.div
            key={selectedOccasion}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mt-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-ai" />
              <h2 className="text-lg font-display font-semibold">
                {selectedOccasion} — {combinations.length} Looks
              </h2>
            </div>

            <div className="space-y-4">
              {combinations.map((combo, i) => (
                <CombinationCard
                  key={combo.label + i}
                  combo={combo}
                  index={i}
                  isActive={i === 0}
                  onTryOn={() => handleTryOnCombo(combo)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Virtual Try-On Modal */}
      <TryOnModal
        isOpen={showTryOn}
        onClose={() => { setShowTryOn(false); setTryOnCombo(null); }}
        outfitItems={tryOnCombo?.items || []}
        allClosetItems={closetItems}
        userId={user?.id || ""}
        comboLabel={tryOnCombo?.label}
      />
    </div>
  );
};

export default AiStylist;
