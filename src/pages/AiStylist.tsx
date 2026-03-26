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
  Shuffle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getClosetItems, getProfile, type ClothingItem, type Profile } from "@/lib/database";
import {
  virtualTryOn,
  virtualTryOnMulti,
  virtualTryOnSequential,
  fileToBase64,
  urlToBase64,
  getOutfitRecommendation,
  type OutfitCombination,
  type SequentialProgress,
} from "@/lib/ai-service";
import MixAndMatch from "@/components/MixAndMatch";

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
/*  VTO Loading Screen — garment showcase + creative waiting messages  */
/* ------------------------------------------------------------------ */

const CREATIVE_MESSAGES = [
  "Picking the perfect fit for you...",
  "Matching colors and patterns...",
  "Adjusting the outfit to your style...",
  "Almost there, putting the finishing touches...",
  "Your personal stylist is at work...",
  "Tailoring the look just for you...",
  "Ironing out the details...",
  "Checking the mirror one last time...",
  "Mixing fabrics and textures...",
  "Making sure everything is runway-ready...",
];

interface VtoLoadingScreenProps {
  items: ClothingItem[];
  isSequential: boolean;
  currentStep: number;
  seqProgress: SequentialProgress | null;
}

const VtoLoadingScreen = ({ items, isSequential, currentStep, seqProgress }: VtoLoadingScreenProps) => {
  const [showcaseIdx, setShowcaseIdx] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);

  // Cycle through garment images every 2.5s
  useEffect(() => {
    if (items.length <= 1) return;
    const interval = setInterval(() => {
      setShowcaseIdx(prev => (prev + 1) % items.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [items.length]);

  // Cycle through creative messages every 3.5s
  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIdx(prev => (prev + 1) % CREATIVE_MESSAGES.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const showcaseItem = items[showcaseIdx] || items[0];
  const totalSteps = isSequential ? (seqProgress?.totalSteps ?? items.length) : 1;
  const progressFraction = isSequential
    ? Math.min(((currentStep + (seqProgress?.status === "done" ? 1 : 0.5)) / totalSteps), 0.95)
    : 0.5;

  return (
    <div className="mt-6 flex flex-col items-center py-6">
      {/* Garment showcase — cycling image */}
      <div className="relative mb-5">
        <div className="h-36 w-28 overflow-hidden rounded-2xl bg-card shadow-lg ring-1 ring-border/30">
          <AnimatePresence mode="wait">
            {showcaseItem && (
              <motion.img
                key={showcaseItem.id}
                src={showcaseItem.image_url}
                alt={showcaseItem.name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.4 }}
                className="h-full w-full object-contain p-1"
              />
            )}
          </AnimatePresence>
        </div>
        {/* Category label badge */}
        {showcaseItem && (
          <motion.div
            key={showcaseItem.id + "-label"}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-ai px-3 py-0.5 shadow-sm"
          >
            <span className="text-[9px] font-display font-semibold text-ai-foreground whitespace-nowrap">
              {showcaseItem.category || showcaseItem.name}
            </span>
          </motion.div>
        )}
      </div>

      {/* Item dots — show which garment is currently showcased */}
      {items.length > 1 && (
        <div className="flex items-center gap-1.5 mb-4">
          {items.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === showcaseIdx
                  ? "h-2 w-2 bg-ai"
                  : "h-1.5 w-1.5 bg-muted-foreground/25"
              }`}
            />
          ))}
        </div>
      )}

      {/* Creative rotating message */}
      <div className="h-8 flex items-center overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={msgIdx}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="text-sm font-body font-medium text-foreground text-center"
          >
            {CREATIVE_MESSAGES[msgIdx]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Subtle animated progress bar */}
      <div className="mt-4 w-48 h-1 rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-ai/60 to-ai"
          initial={{ width: "5%" }}
          animate={{ width: `${Math.max(5, progressFraction * 100)}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>

      {/* Small garment strip at bottom */}
      {items.length > 1 && (
        <div className="mt-5 flex items-center gap-2">
          {items.map((item, i) => {
            const isDone = i < currentStep || (i === currentStep && seqProgress?.status === "done");
            const isActive = i === currentStep && seqProgress?.status === "starting";
            return (
              <div
                key={item.id || i}
                className={`relative h-12 w-10 shrink-0 overflow-hidden rounded-lg transition-all duration-300 bg-card ${
                  isActive
                    ? "ring-2 ring-ai ring-offset-1 scale-110"
                    : isDone
                      ? "opacity-100"
                      : "opacity-40"
                }`}
              >
                <img src={item.image_url} alt={item.name} className="h-full w-full object-contain" />
                {isDone && (
                  <div className="absolute inset-0 flex items-center justify-center bg-ai/20 rounded-lg">
                    <Check className="h-3 w-3 text-ai" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
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
  const [facePhotoBase64, setFacePhotoBase64] = useState<string | null>(null);
  const [personDescription, setPersonDescription] = useState<string | undefined>(undefined);
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"outfit" | "closet">("outfit");
  // v13: Sequential generation progress
  const [seqProgress, setSeqProgress] = useState<SequentialProgress | null>(null);

  useEffect(() => {
    if (!isOpen || !userId) return;
    const loadProfilePhoto = async () => {
      setStep("loading");
      try {
        const profile = await getProfile(userId);
        const bodyUrl = profile?.body_image_url;
        if (bodyUrl) {
          setPersonPhoto(bodyUrl);
          // v12: Higher resolution body photo (768px, quality 0.85) to preserve face detail
          const bodyB64 = await urlToBase64(bodyUrl, { maxDim: 768, quality: 0.85 });
          setBodyPhotoBase64(bodyB64);

          // v10: Load face close-up for identity preservation
          const faceUrl = profile?.face_image_url;
          let faceB64: string | null = null;
          if (faceUrl) {
            try {
              faceB64 = await urlToBase64(faceUrl, { maxDim: 512, quality: 0.85 });
              setFacePhotoBase64(faceB64);
            } catch (e) {
              console.warn("Could not load face photo, continuing without it:", e);
            }
          }

          // v15: Imagen 3 VTO doesn't need text descriptions — it preserves identity automatically
          // Keep personDescription for potential future use but don't hardcode facial features
          const descParts: string[] = [];
          if (profile?.model_gender) descParts.push(profile.model_gender === "neutral" ? "person" : profile.model_gender === "men" ? "male" : "female");
          if (descParts.length > 0) setPersonDescription(descParts.join(", "));

          // Auto-select the first outfit item
          const firstItem = outfitItems.find((i) => i.image_url);
          if (firstItem) setSelectedItem(firstItem);

          // If we have outfit items with images, skip selection and go straight to generating
          const itemsWithImages = outfitItems.filter((i) => i.image_url);
          const desc = descParts.length > 0 ? descParts.join(", ") : undefined;
          if (itemsWithImages.length > 0) {
            setStep("generating");
            setSeqProgress(null);
            try {
              let results: { mimeType: string; base64: string }[] = [];

              if (itemsWithImages.length === 1) {
                // Single garment — use direct one-shot
                const productBase64 = await urlToBase64(itemsWithImages[0].image_url, { removeBackground: true });
                results = await virtualTryOn(bodyB64, productBase64, 1, desc, faceB64 || undefined);
              } else {
                // v22: SEQUENTIAL generation — one garment at a time
                // Sort garments: shoes → bottomwear → topwear (topwear LAST for max quality & print fidelity)
                const categoryOrder: Record<string, number> = {
                  shoes: 0, footwear: 0, sneakers: 0, boots: 0, sandals: 0,
                  bottomwear: 1, bottom: 1, pants: 1, jeans: 1, trousers: 1, shorts: 1, skirt: 1,
                  topwear: 2, top: 2, shirt: 2, tshirt: 2, jacket: 2, hoodie: 2, sweater: 2, blazer: 2,
                  accessories: 3, accessory: 3, watch: 3, bag: 3, hat: 3,
                };
                const sorted = [...itemsWithImages].sort((a, b) => {
                  const aOrder = categoryOrder[a.category?.toLowerCase()] ?? 3;
                  const bOrder = categoryOrder[b.category?.toLowerCase()] ?? 3;
                  return aOrder - bOrder;
                });

                // v23: Remove background from garment images for clean VTO input
                const seqGarments = await Promise.all(
                  sorted.map(async (item) => ({
                    base64: await urlToBase64(item.image_url, { removeBackground: true }),
                    mimeType: "image/png",
                    label: `${item.category}: ${item.name}`,
                    category: item.category?.toLowerCase() || "other",
                  }))
                );

                // v15: Imagen 3 VTO (face param kept for backward compat)
                results = await virtualTryOnSequential(
                  bodyB64,
                  seqGarments,
                  desc,
                  (progress) => setSeqProgress(progress),
                  faceB64 || undefined,
                );
              }

              if (results.length > 0) {
                setResultImage(`data:${results[0].mimeType};base64,${results[0].base64}`);
                setStep("result");
              } else {
                setError("Couldn't generate try-on with full outfit. Please try again.");
                setStep("select");
              }
            } catch (err) {
              console.error("Auto try-on error:", err);
              setError("Something went wrong. Please try again.");
              setStep("select");
            }
          } else {
            setStep("select");
          }
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

  // Try on the full outfit (all outfitItems) when multiple items are available,
  // or fall back to the single selectedItem when browsing the closet.
  const handleTryOn = async () => {
    if (!bodyPhotoBase64) return;
    setStep("generating");
    setError(null);
    setSeqProgress(null);

    try {
      const itemsToTry = mode === "outfit" && outfitItems.filter((i) => i.image_url).length > 0
        ? outfitItems.filter((i) => i.image_url)
        : selectedItem?.image_url ? [selectedItem] : [];

      if (itemsToTry.length === 0) {
        setError("No items with images to try on.");
        setStep("select");
        return;
      }

      let results: { mimeType: string; base64: string }[] = [];

      if (itemsToTry.length === 1) {
        const productBase64 = await urlToBase64(itemsToTry[0].image_url, { removeBackground: true });
        results = await virtualTryOn(bodyPhotoBase64, productBase64, 1, personDescription, facePhotoBase64 || undefined);
      } else {
        // v22: Sequential generation — shoes → bottomwear → topwear (topwear LAST for best fidelity)
        const categoryOrder: Record<string, number> = {
          shoes: 0, footwear: 0, sneakers: 0, boots: 0, sandals: 0,
          bottomwear: 1, bottom: 1, pants: 1, jeans: 1, trousers: 1, shorts: 1, skirt: 1,
          topwear: 2, top: 2, shirt: 2, tshirt: 2, jacket: 2, hoodie: 2, sweater: 2, blazer: 2,
          accessories: 3, accessory: 3, watch: 3, bag: 3, hat: 3,
        };
        const sorted = [...itemsToTry].sort((a, b) => {
          const aOrder = categoryOrder[a.category?.toLowerCase()] ?? 3;
          const bOrder = categoryOrder[b.category?.toLowerCase()] ?? 3;
          return aOrder - bOrder;
        });

        // v23: Remove background from garment images for clean VTO input
        const seqGarments = await Promise.all(
          sorted.map(async (item) => ({
            base64: await urlToBase64(item.image_url, { removeBackground: true }),
            mimeType: "image/png",
            label: `${item.category}: ${item.name}`,
            category: item.category?.toLowerCase() || "other",
          }))
        );

        // v14: Pass face close-up for face refinement final step
        results = await virtualTryOnSequential(
          bodyPhotoBase64,
          seqGarments,
          personDescription,
          (progress) => setSeqProgress(progress),
          facePhotoBase64 || undefined,
        );
      }

      if (results.length > 0) {
        setResultImage(`data:${results[0].mimeType};base64,${results[0].base64}`);
        setStep("result");
      } else {
        setError("Couldn't generate try-on with full outfit. Please try again.");
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

  // Button is enabled when: in outfit mode with items, or a single item is selected in closet mode
  const outfitItemsWithImages = outfitItems.filter((i) => i.image_url);
  const canTryOn = mode === "outfit" && outfitItemsWithImages.length > 0
    ? true
    : !!selectedItem;
  const tryOnLabel = mode === "outfit" && outfitItemsWithImages.length > 1
    ? `Try Full Outfit (${outfitItemsWithImages.length} items)`
    : "Try It On";

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
                  whileTap={canTryOn ? { scale: 0.98 } : undefined}
                  onClick={() => {
                    if (canTryOn) handleTryOn();
                  }}
                  className={`mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ai text-ai-foreground font-display font-semibold transition-all ${
                    !canTryOn ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
                  }`}
                >
                  <Sparkles className="h-4 w-4" />
                  {tryOnLabel}
                </motion.button>
              </div>
            )}

            {/* Generating — garment showcase with creative messages */}
            {step === "generating" && (() => {
              const previewItems = mode === "outfit" && outfitItems.filter(i => i.image_url).length > 0
                ? outfitItems.filter(i => i.image_url)
                : selectedItem?.image_url ? [selectedItem] : [];

              const categoryOrder: Record<string, number> = {
                shoes: 0, footwear: 0, sneakers: 0, boots: 0, sandals: 0,
                bottomwear: 1, bottom: 1, pants: 1, jeans: 1, trousers: 1, shorts: 1, skirt: 1,
                topwear: 2, top: 2, shirt: 2, tshirt: 2, jacket: 2, hoodie: 2, sweater: 2, blazer: 2,
                accessories: 3, accessory: 3,
              };
              const sortedPreview = [...previewItems].sort((a, b) => {
                const aOrder = categoryOrder[a.category?.toLowerCase()] ?? 3;
                const bOrder = categoryOrder[b.category?.toLowerCase()] ?? 3;
                return aOrder - bOrder;
              });

              const isSequential = sortedPreview.length > 1;
              const currentStep = seqProgress?.stepIndex ?? -1;

              return (
                <VtoLoadingScreen
                  items={sortedPreview}
                  isSequential={isSequential}
                  currentStep={currentStep}
                  seqProgress={seqProgress}
                />
              );
            })()}

            {/* Result */}
            {step === "result" && resultImage && (
              <div className="mt-4">
                <div className="overflow-hidden rounded-2xl bg-card">
                  <img src={resultImage} alt="Virtual Try-On Result" className="w-full object-contain" />
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-ai/10 px-4 py-2.5">
                  <Sparkles className="h-4 w-4 text-ai" />
                  <span className="text-xs font-body text-ai font-medium">
                    AI-generated preview - {outfitItemsWithImages.length > 1 ? `${outfitItemsWithImages.length}-piece outfit` : selectedItem?.name}
                  </span>
                </div>
                {/* v30: Garment thumbnails used for this VTO */}
                {outfitItemsWithImages.length > 1 && (
                  <div className="mt-3 flex items-center gap-3 px-1">
                    {(() => {
                      const catOrder: Record<string, number> = {
                        topwear: 0, top: 0, shirt: 0, tshirt: 0, jacket: 0, hoodie: 0, sweater: 0, blazer: 0,
                        bottomwear: 1, bottom: 1, pants: 1, jeans: 1, trousers: 1, shorts: 1, skirt: 1,
                        shoes: 2, footwear: 2, sneakers: 2, boots: 2, sandals: 2,
                        accessories: 3, accessory: 3,
                      };
                      const sorted = [...outfitItemsWithImages].sort((a, b) =>
                        (catOrder[a.category?.toLowerCase()] ?? 9) - (catOrder[b.category?.toLowerCase()] ?? 9)
                      );
                      return sorted.map((item) => (
                        <div key={item.id} className="flex flex-col items-center gap-1">
                          <div className="h-16 w-16 overflow-hidden rounded-lg border border-border bg-card">
                            <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                          </div>
                          <span className="text-[10px] font-body text-muted-foreground truncate max-w-[64px]">
                            {item.category?.charAt(0).toUpperCase() + item.category?.slice(1).toLowerCase().replace('wear','') || item.name}
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                )}
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
  const [searchParams] = useSearchParams();
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
  const [activeTab, setActiveTab] = useState<"ai" | "mix">(
    searchParams.get("tab") === "mix" ? "mix" : "ai"
  );
  const [mixTryOnItems, setMixTryOnItems] = useState<ClothingItem[]>([]);

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

  // Handle tryOn query param from Digital Closet's Try On button
  useEffect(() => {
    const tryOnIds = searchParams.get("tryOn");
    if (!tryOnIds || closetItems.length === 0) return;

    // Support "session" mode: items passed via sessionStorage (includes AI-suggested items)
    if (tryOnIds === "session") {
      try {
        const stored = sessionStorage.getItem("tryOnItems");
        if (stored) {
          const items = JSON.parse(stored) as ClothingItem[];
          sessionStorage.removeItem("tryOnItems"); // Clean up
          if (items.length > 0) {
            setMixTryOnItems(items);
            setTryOnCombo(null);
            setShowTryOn(true);
          }
        }
      } catch (e) {
        console.error("Failed to parse tryOnItems from sessionStorage:", e);
      }
      return;
    }

    const ids = tryOnIds.split(",");
    const matched = ids.map((id) => closetItems.find((i) => i.id === id)).filter(Boolean) as ClothingItem[];
    if (matched.length > 0) {
      setMixTryOnItems(matched);
      setTryOnCombo(null);
      setShowTryOn(true);
    }
  }, [closetItems, searchParams]);

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
    setMixTryOnItems([]);
    setShowTryOn(true);
  };

  const handleMixTryOn = (items: ClothingItem[]) => {
    setTryOnCombo(null);
    setMixTryOnItems(items);
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
            {activeTab === "ai"
              ? `Get 3 outfit combinations for any occasion (${closetItems.length} items)`
              : "Swipe & pick items to create your own outfit"}
          </p>
        </div>
      </div>

      {/* Tab toggle: AI Picks vs Mix & Match */}
      <div className="mt-4 flex rounded-2xl bg-card p-1">
        <button
          onClick={() => setActiveTab("ai")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-body font-semibold transition-all ${
            activeTab === "ai"
              ? "bg-ai text-ai-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI Picks
        </button>
        <button
          onClick={() => setActiveTab("mix")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-body font-semibold transition-all ${
            activeTab === "mix"
              ? "bg-ai text-ai-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Shuffle className="h-3.5 w-3.5" />
          Mix & Match
        </button>
      </div>

      {/* Mix & Match tab */}
      {activeTab === "mix" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4"
        >
          <MixAndMatch
            closetItems={closetItems}
            onTryOn={handleMixTryOn}
            inline
          />
        </motion.div>
      )}

      {/* AI Picks tab */}
      {activeTab === "ai" && (
        <>
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
                {selectedOccasion} - {combinations.length} Looks
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
        </>
      )}

      {/* Virtual Try-On Modal */}
      <TryOnModal
        isOpen={showTryOn}
        onClose={() => { setShowTryOn(false); setTryOnCombo(null); setMixTryOnItems([]); }}
        outfitItems={tryOnCombo?.items || mixTryOnItems}
        allClosetItems={closetItems}
        userId={user?.id || ""}
        comboLabel={tryOnCombo?.label || (mixTryOnItems.length > 0 ? "Mix & Match" : undefined)}
      />
    </div>
  );
};

export default AiStylist;
