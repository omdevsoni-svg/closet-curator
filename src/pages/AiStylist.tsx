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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getClosetItems, getProfile, type ClothingItem, type Profile } from "@/lib/database";
import { virtualTryOn, fileToBase64, urlToBase64, getOutfitRecommendation } from "@/lib/ai-service";

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
  reasoning: string[];
  missing: string | null;
};

/* ------------------------------------------------------------------ */
/*  Virtual Try-On Modal                                               */
/* ------------------------------------------------------------------ */
interface TryOnModalProps {
  isOpen: boolean;
  onClose: () => void;
  closetItems: ClothingItem[];
  userId: string;
}

const TryOnModal = ({ isOpen, onClose, closetItems, userId }: TryOnModalProps) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<"loading" | "no-photo" | "select" | "generating" | "result">("loading");
  const [personPhoto, setPersonPhoto] = useState<string | null>(null);
  const [bodyPhotoBase64, setBodyPhotoBase64] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-load full-body image from profile when modal opens
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
      // Get the clothing item image as base64
      let productBase64: string;
      if (selectedItem.image_url) {
        productBase64 = await urlToBase64(selectedItem.image_url);
      } else {
        setError("Selected item has no image. Please choose an item with a photo.");
        setStep("select");
        return;
      }

      // Pass body image for virtual try-on
      const results = await virtualTryOn(bodyPhotoBase64, productBase64, 1);

      if (results.length > 0) {
        setResultImage(`data:${results[0].mimeType};base64,${results[0].base64}`);
        setStep("result");
      } else {
        setError("Couldn't generate try-on. The model may not support this image combination. Try a different photo.");
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
    // Go back to select step since profile photos are already loaded
    if (bodyPhotoBase64) {
      setStep("select");
    } else {
      setStep("no-photo");
    }
  };

  const clothingWithImages = closetItems.filter((item) => item.image_url);

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

            {/* Loading profile photo */}
            {step === "loading" && (
              <div className="mt-8 flex flex-col items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-ai" />
                <p className="mt-3 text-sm font-body text-muted-foreground">
                  Loading your profile photo...
                </p>
              </div>
            )}

            {/* No profile photo — redirect to Profile */}
            {step === "no-photo" && (
              <div className="mt-6 flex flex-col items-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-card">
                  <Camera className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <h3 className="mt-4 text-base font-display font-semibold text-foreground">
                  Full-body photo needed
                </h3>
                <p className="mt-1.5 text-sm font-body text-muted-foreground">
                  Upload a full-body photo in your Profile to use Virtual Try-On. This only needs to be done once — your photo is used to generate realistic try-on images.
                </p>
                <button
                  onClick={() => {
                    onClose();
                    navigate("/profile");
                  }}
                  className="mt-5 flex items-center gap-2 rounded-xl bg-ai px-6 py-3 text-sm font-display font-semibold text-ai-foreground"
                >
                  Go to Profile
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Step 2: Select clothing item */}
            {step === "select" && (
              <div className="mt-4">
                {/* Person photo preview */}
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
                    onClick={() => {
                      onClose();
                      navigate("/profile");
                    }}
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

                {/* Clothing items grid */}
                <div className="mt-4">
                  <p className="text-xs font-medium font-body uppercase tracking-wider text-muted-foreground">
                    Select an item ({clothingWithImages.length} available)
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2 max-h-[40vh] overflow-y-auto">
                    {clothingWithImages.map((item) => (
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
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="h-full w-full object-contain"
                          />
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

                {/* Try-on button */}
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

            {/* Step 3: Generating */}
            {step === "generating" && (
              <div className="mt-8 flex flex-col items-center py-8">
                <div className="relative">
                  <Loader2 className="h-10 w-10 animate-spin text-ai" />
                </div>
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

            {/* Step 4: Result */}
            {step === "result" && resultImage && (
              <div className="mt-4">
                <div className="overflow-hidden rounded-2xl bg-card">
                  <img
                    src={resultImage}
                    alt="Virtual Try-On Result"
                    className="w-full object-contain"
                  />
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
                    onClick={() => {
                      setSelectedItem(null);
                      setResultImage(null);
                      setStep("select");
                    }}
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
  const [recommendation, setRecommendation] = useState<OutfitRecommendation | null>(null);
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
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

  const fetchRecommendation = async (occasion: string) => {
    setSelectedOccasion(occasion);
    setGenerating(true);
    setAiError(null);
    setRecommendation(null);

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
        // Map item_ids back to full ClothingItem objects
        const pickedItems = result.item_ids
          .map((id) => closetItems.find((item) => item.id === id))
          .filter(Boolean) as ClothingItem[];

        const reasoning = result.reasoning.map((r) => {
          const item = closetItems.find((i) => i.id === r.id);
          return `${item?.name || "Item"}: ${r.reason}`;
        });

        setRecommendation({
          occasion,
          items: pickedItems,
          tip: result.tip,
          reasoning,
          missing: result.missing,
        });
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
    fetchRecommendation(label);
  };

  const handleSubmitPrompt = () => {
    if (prompt.trim()) {
      fetchRecommendation(prompt.trim());
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
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-ai" />
            <h1 className="text-2xl font-display font-bold tracking-tight">AI Stylist</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground font-body">
            Select an occasion or describe your vibe ({closetItems.length} items)
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowTryOn(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[hsl(43,70%,50%)] to-[hsl(220,10%,65%)] px-4 py-2.5 text-sm font-display font-semibold text-white shadow-lg shadow-ai/20"
        >
          <Camera className="h-4 w-4" />
          Virtual Try-On
        </motion.button>
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
            AI is styling your outfit...
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
              Couldn't generate recommendation
            </p>
            <p className="mt-0.5 text-xs font-body text-red-500/80">{aiError}</p>
          </div>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-ai" />
                <h2 className="text-lg font-display font-semibold">
                  {recommendation.occasion} Look
                </h2>
              </div>
              <button
                onClick={() => setShowTryOn(true)}
                className="text-xs font-body text-ai underline"
              >
                Try on look
              </button>
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

            {/* AI Reasoning */}
            {recommendation.reasoning && recommendation.reasoning.length > 0 && (
              <div className="mt-3 rounded-2xl border border-border/50 px-4 py-3">
                <p className="text-xs font-body text-ai font-medium flex items-center gap-1">
                  <Sparkles className="h-3 w-3 inline" />
                  Why these picks
                </p>
                <div className="mt-1.5 space-y-1">
                  {recommendation.reasoning.map((reason, i) => (
                    <p key={i} className="text-[11px] font-body text-muted-foreground">
                      {reason}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Missing items suggestion */}
            {recommendation.missing && (
              <div className="mt-3 rounded-2xl bg-amber-500/10 px-4 py-3">
                <p className="text-xs font-body font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 inline" />
                  What's missing
                </p>
                <p className="mt-1 text-[11px] font-body text-amber-600/80 dark:text-amber-400/80">
                  {recommendation.missing}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* No recommendation possible */}
      {!generating && recommendation === null && selectedOccasion && (
        <div className="mt-8 text-center">
          <p className="text-sm font-body text-muted-foreground">
            Couldn't find a good match for "{selectedOccasion}" with your current items.
            Try adding more items with relevant tags.
          </p>
        </div>
      )}

      {/* Virtual Try-On Modal */}
      <TryOnModal
        isOpen={showTryOn}
        onClose={() => setShowTryOn(false)}
        closetItems={closetItems}
        userId={user?.id || ""}
      />
    </div>
  );
};

export default AiStylist;
