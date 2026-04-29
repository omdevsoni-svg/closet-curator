import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Settings,
  Camera,
  ImageIcon,
  Sparkles,
  Check,
  Loader2,
  Ruler,
  Trash2,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import {
  getProfile,
  updateProfile,
  getClosetItems,
  uploadImage,
  type Profile as ProfileType,
} from "@/lib/database";
import { detectBodyAttributes } from "@/lib/ai-service";

/* ------------------------------------------------------------------ */
/* Body type data                                                      */
/* ------------------------------------------------------------------ */

interface BodyTypeInfo {
  type: string;
  tips: string[];
  bestSilhouettes: string[];
  stylesToAvoid: string[];
}

const bodyTypeData: Record<string, BodyTypeInfo> = {
  rectangle: {
    type: "Rectangle",
    tips: [
      "Create curves with peplum tops and ruffled details",
      "Belts and high-waisted bottoms define your waist",
      "Layering adds dimension and shape",
    ],
    bestSilhouettes: ["peplum", "ruffles", "layered looks", "high-waisted"],
    stylesToAvoid: ["boxy shapes", "straight cuts only", "shapeless pieces"],
  },
  hourglass: {
    type: "Hourglass",
    tips: [
      "Highlight your natural waist with fitted pieces",
      "Wrap dresses and V-necks complement your shape",
      "Balanced proportions work best -- match volume top & bottom",
    ],
    bestSilhouettes: ["wrap dresses", "fitted blazers", "A-line skirts", "V-necks"],
    stylesToAvoid: ["oversized tops", "shapeless dresses", "low-rise pants"],
  },
  inverted_triangle: {
    type: "Inverted Triangle",
    tips: [
      "Balance broader shoulders with volume on the bottom",
      "A-line and flared skirts create proportion",
      "Avoid heavy shoulder pads and boat necks",
    ],
    bestSilhouettes: ["A-line skirts", "wide-leg pants", "V-necks", "scoop necks"],
    stylesToAvoid: ["puffy sleeves", "boat necks", "shoulder pads"],
  },
  pear: {
    type: "Pear",
    tips: [
      "Draw attention upward with statement necklines and earrings",
      "Structured shoulders and boat necks balance your proportions",
      "Dark bottoms with bright or detailed tops work great",
    ],
    bestSilhouettes: ["boat necks", "structured shoulders", "A-line dresses", "dark bottoms"],
    stylesToAvoid: ["skinny jeans alone", "pleated skirts", "hip-heavy details"],
  },
};

const skinToneOptions = ["Light", "Fair", "Medium", "Olive", "Tan", "Dark", "Deep"];
const bodyTypeOptions = ["rectangle", "hourglass", "inverted_triangle", "pear"];

/* ------------------------------------------------------------------ */
/* Main Profile component                                              */
/* ------------------------------------------------------------------ */

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [closetCount, setClosetCount] = useState(0);
  const [bodyType, setBodyType] = useState("rectangle");
  const [skinTone, setSkinTone] = useState("Medium");
  const [modelGender, setModelGender] = useState<"women" | "men" | "neutral">("neutral");
  const [bodyPhoto, setBodyPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [measurements, setMeasurements] = useState<Record<string, any> | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");

  const topSizeOptions = ["XS", "S", "M", "L", "XL", "XXL"];
  const bottomSizeOptions = ["26", "28", "30", "32", "34", "36", "38", "40"];
  const shoeSizeOptions = ["6", "7", "8", "9", "10", "11", "12", "13"];

  const handleSizeUpdate = async (key: string, value: string) => {
    if (!user) return;
    const current = measurements || {};
    const updated = { ...current, [key]: value };
    setMeasurements(updated);
    try {
      await updateProfile(user.id, { body_measurements: updated });
    } catch (e) {
      console.error("Failed to save size update:", e);
    }
  };

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [p, items] = await Promise.all([
        getProfile(user.id),
        getClosetItems(user.id),
      ]);
      if (p) {
        setProfile(p);
        setBodyType(p.body_type || "rectangle");
        setSkinTone(p.skin_tone || "Medium");
        setModelGender((p.model_gender as any) || "neutral");
        setBodyPhoto(p.body_image_url || null);
      }
      setClosetCount(items.length);
      if (p.body_measurements) {
        setMeasurements(p.body_measurements);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const savePreferences = async (updates: Record<string, any>) => {
    if (!user) return;
    setSaving(true);
    await updateProfile(user.id, updates);
    setSaving(false);
  };

  /**
   * Shrink any image (including HEIC) to a safe JPEG File.
   *
   * TestFlight / WKWebView has ~100-150 MB memory limit. A 48 MP iPhone photo
   * decoded at native resolution uses ~200 MB just for the bitmap, which
   * crashes the WebView before our code even touches a canvas.
   *
   * Strategy:
   * 1. Try createImageBitmap() with resizeWidth/Height — this tells the
   *    browser to decode at the TARGET resolution, so the full-res bitmap
   *    never exists in memory. Supported in iOS 15+/WKWebView.
   * 2. Fallback: OffscreenCanvas (if available).
   * 3. Last resort: classic Image + canvas with small target.
   */
  const shrinkToSafeJpeg = async (file: File, maxDim = 1024, quality = 0.75): Promise<File> => {
    try {
      // ---- Strategy 1: createImageBitmap with resize (best for iOS WKWebView) ----
      if (typeof createImageBitmap !== "undefined") {
        // We don't know actual dimensions yet, but we can ask the browser to
        // constrain to maxDim×maxDim while preserving aspect ratio.
        const bitmap = await createImageBitmap(file, {
          resizeWidth: maxDim,
          resizeHeight: maxDim,
          resizeQuality: "medium",
        });
        // bitmap dimensions will be at most maxDim on each side (aspect preserved)
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(bitmap, 0, 0);
          bitmap.close(); // free GPU/CPU memory immediately

          const blob: Blob | null = await new Promise((r) =>
            canvas.toBlob(r, "image/jpeg", quality)
          );
          // Free canvas memory
          canvas.width = 0;
          canvas.height = 0;

          if (blob) {
            return new File(
              [blob],
              file.name.replace(/\.[^.]+$/, ".jpg"),
              { type: "image/jpeg" }
            );
          }
        }
        bitmap.close();
      }
    } catch (e) {
      console.warn("createImageBitmap resize failed, trying fallback:", e);
    }

    // ---- Strategy 2: classic Image + canvas (lower iOS compat) ----
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
          else { w = Math.round(w * maxDim / h); h = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { URL.revokeObjectURL(url); resolve(file); return; }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            canvas.width = 0;
            canvas.height = 0;
            if (!blob) { resolve(file); return; }
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  };

  const handleBodyPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingPhoto(true);
    setUploadStatus("idle");
    try {
      // Step 1: Shrink image ONCE to ≤1024px JPEG using createImageBitmap
      // (decodes at target res, full 48MP image never exists in memory).
      // This prevents WKWebView/TestFlight crashes on high-res iPhone photos.
      const safeFile = await shrinkToSafeJpeg(file);

      // Step 2: Upload the already-small JPEG (no further conversion needed)
      const url = await uploadImage("body-photos", user.id, safeFile);

      if (!url) {
        setUploadingPhoto(false);
        setUploadStatus("error");
        setTimeout(() => setUploadStatus("idle"), 3000);
        e.target.value = "";
        return;
      }

      setBodyPhoto(url);
      await updateProfile(user.id, { body_photo_url: url });
      setUploadingPhoto(false);
      setUploadStatus("success");
      setTimeout(() => setUploadStatus("idle"), 2000);

      // Step 3: Run AI detection on the same small JPEG (not the raw 48MP file)
      setIsAnalyzing(true);
      try {
        const attrs = await detectBodyAttributes(safeFile);
        setBodyType(attrs.body_type);
        setSkinTone(attrs.skin_tone);
        await savePreferences({
          body_type: attrs.body_type,
          skin_tone: attrs.skin_tone,
        });
      } catch (aiErr) {
        console.error("AI detection failed:", aiErr);
      } finally {
        setIsAnalyzing(false);
      }
    } catch (err) {
      console.error("Upload error:", err);
      setUploadingPhoto(false);
      setUploadStatus("error");
      setTimeout(() => setUploadStatus("idle"), 3000);
    }
    // Reset file input so re-selecting the same file triggers onChange
    e.target.value = "";
  };

  const handleRemovePhoto = async () => {
    if (!user) return;
    setBodyPhoto(null);
    try {
      await updateProfile(user.id, { body_photo_url: null, body_image_url: null });
    } catch (err) {
      console.error("Failed to remove photo:", err);
    }
  };

  const currentBody = bodyTypeData[bodyType];
  const userName = profile?.name || user?.user_metadata?.name || "Style Enthusiast";

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="px-5 pt-5 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">
            Profile
          </h1>
          <p className="text-sm text-muted-foreground font-body">
            Your style identity
          </p>
        </div>
      </div>

      {/* Profile card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-5 flex items-center justify-between rounded-2xl bg-card p-5"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(43,70%,50%)] to-[hsl(220,10%,65%)] text-white font-display font-bold text-lg">
            {userName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div>
            <h2 className="text-base font-display font-semibold text-foreground">
              {userName}
            </h2>
            <p className="text-xs text-muted-foreground font-body">
              {closetCount} {closetCount === 1 ? "item" : "items"} in closet
            </p>
          </div>
        </div>
      </motion.div>

      {/* Full-Body Image */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mt-4 rounded-2xl bg-card p-5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <h3 className="text-sm font-display font-semibold text-foreground">
                Full-Body Image
              </h3>
              <p className="text-xs text-muted-foreground font-body">
                Full-body photo for body type detection
              </p>
            </div>
          </div>
          <span className="rounded-full bg-ai/10 px-3 py-1 text-[10px] font-semibold text-ai font-body">
            {currentBody.type}
          </span>
        </div>

        <div className="mt-4 flex items-start gap-4">
          {bodyPhoto ? (
            <div
              onClick={() => !uploadingPhoto && setShowImageModal(true)}
              className={"cursor-pointer relative h-28 w-20 shrink-0 overflow-hidden rounded-xl bg-background ring-2 " + (uploadingPhoto ? "ring-ai/40 animate-pulse" : uploadStatus === "success" ? "ring-green-500/60" : "ring-[hsl(43,70%,50%)]/20")}
              title={uploadingPhoto ? "Uploading..." : "Click to view full size"}
            >
              <img
                src={bodyPhoto}
                alt="Full body"
                className={"h-full w-full object-cover transition-opacity duration-300 " + (uploadingPhoto ? "opacity-40" : "opacity-100")}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              {uploadingPhoto && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-xl">
                  <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
                  <span className="mt-1 text-[10px] font-semibold text-yellow-400">Uploading</span>
                </div>
              )}
              {uploadStatus === "success" && !uploadingPhoto && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-500/30 rounded-xl animate-pulse">
                  <Check className="h-6 w-6 text-green-400" />
                  <span className="mt-1 text-[10px] font-semibold text-green-400">Updated!</span>
                </div>
              )}
              {uploadStatus === "error" && !uploadingPhoto && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-500/20 rounded-xl">
                  <span className="text-[9px] font-medium text-red-400">Failed</span>
                </div>
              )}
            </div>
          ) : uploadingPhoto ? (
            <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-xl bg-background ring-2 ring-ai/40 animate-pulse">
              <div className="flex flex-col items-center">
                <Loader2 className="h-5 w-5 animate-spin text-ai" />
                <span className="mt-1 text-[9px] font-medium text-muted-foreground">Uploading</span>
              </div>
            </div>
          ) : (
            <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-xl bg-background ring-2 ring-border">
              <User className="h-8 w-8 text-muted-foreground/30" />
            </div>
          )}

          <div className="flex-1">
            <p className="text-xs text-muted-foreground font-body">
              Upload a full-body photo in fitted clothing for accurate body type
              detection. Use a well-lit environment.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className={"flex cursor-pointer items-center gap-1.5 rounded-lg bg-background px-3 py-1.5 text-xs font-body font-medium text-muted-foreground transition-colors hover:text-foreground" + (uploadingPhoto ? " opacity-50 pointer-events-none" : "")}>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleBodyPhotoUpload}
                  disabled={uploadingPhoto}
                />
                <Camera className="h-3.5 w-3.5" />
                Camera
              </label>
              <label className={"flex cursor-pointer items-center gap-1.5 rounded-lg bg-background px-3 py-1.5 text-xs font-body font-medium text-muted-foreground transition-colors hover:text-foreground" + (uploadingPhoto ? " opacity-50 pointer-events-none" : "")}>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleBodyPhotoUpload}
                  disabled={uploadingPhoto}
                />
                <ImageIcon className="h-3.5 w-3.5" />
                Gallery
              </label>
              {bodyPhoto && !uploadingPhoto && (
                <button
                  onClick={handleRemovePhoto}
                  className="flex items-center gap-1 text-[11px] font-body text-destructive/70 hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  Remove Photo
                </button>
              )}
            </div>
            {uploadingPhoto && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-yellow-400 font-body animate-pulse">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Uploading your photo...
              </div>
            )}
            {uploadStatus === "success" && !uploadingPhoto && !isAnalyzing && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-green-400 font-body">
                <Check className="h-3.5 w-3.5" />
                Photo uploaded successfully!
              </div>
            )}
            {uploadStatus === "error" && !uploadingPhoto && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-red-400 font-body">
                Upload failed. Please try again.
              </div>
            )}
            {isAnalyzing && !uploadingPhoto && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-ai font-body">
                <Loader2 className="h-3 w-3 animate-spin" />
                Analyzing body type...
              </div>
            )}
          </div>
        </div>

      </motion.div>

      {/* Your Sizes */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="mt-4 rounded-2xl bg-card p-5"
      >
        <div className="flex items-center gap-2">
          <Ruler className="h-4 w-4 text-ai" />
          <h3 className="text-sm font-display font-semibold text-foreground">
            Your Sizes
          </h3>
        </div>

        {/* Top Size */}
        <div className="mt-4">
          <label className="text-xs font-body text-muted-foreground">Top / Shirt Size</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {topSizeOptions.map((s) => (
              <button
                key={s}
                onClick={() => handleSizeUpdate("recommended_size", s)}
                className={"rounded-full px-3 py-1 text-[11px] font-body font-medium transition-colors " + (measurements?.recommended_size === s ? "bg-ai text-white" : "bg-background text-muted-foreground hover:text-foreground")}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Size */}
        <div className="mt-4">
          <label className="text-xs font-body text-muted-foreground">Bottom / Trouser Size</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {bottomSizeOptions.map((s) => (
              <button
                key={s}
                onClick={() => handleSizeUpdate("recommended_trouser", s)}
                className={"rounded-full px-3 py-1 text-[11px] font-body font-medium transition-colors " + (measurements?.recommended_trouser === s ? "bg-ai text-white" : "bg-background text-muted-foreground hover:text-foreground")}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Shoe Size */}
        <div className="mt-4">
          <label className="text-xs font-body text-muted-foreground">Shoe Size (US)</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {shoeSizeOptions.map((s) => (
              <button
                key={s}
                onClick={() => handleSizeUpdate("shoe_size", s)}
                className={"rounded-full px-3 py-1 text-[11px] font-body font-medium transition-colors " + (measurements?.shoe_size === s ? "bg-ai text-white" : "bg-background text-muted-foreground hover:text-foreground")}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Styling Tips */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-4 rounded-2xl bg-card p-5"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-ai" />
          <h3 className="text-sm font-display font-semibold text-foreground">
            Styling Tips for {currentBody.type} Body Type
          </h3>
        </div>

        <div className="mt-3 space-y-2">
          {currentBody.tips.map((tip) => (
            <div key={tip} className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ai" />
              <p className="text-xs font-body text-muted-foreground">{tip}</p>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <p className="text-xs font-body font-semibold text-foreground">
            Best Silhouettes
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {currentBody.bestSilhouettes.map((s) => (
              <span
                key={s}
                className="rounded-full bg-ai/10 px-2.5 py-1 text-[10px] font-body font-medium text-ai"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <p className="text-xs font-body text-muted-foreground flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
            Styles to Avoid
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {currentBody.stylesToAvoid.map((s) => (
              <span
                key={s}
                className="rounded-full bg-destructive/10 px-2.5 py-1 text-[10px] font-body font-medium text-destructive"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Style Preferences */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="mt-4 rounded-2xl bg-card p-5"
      >
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-display font-semibold text-foreground">
            Style Preferences
          </h3>
        </div>

        {/* Skin Tone */}
        <div className="mt-4">
          <label className="text-xs font-body text-muted-foreground">Skin Tone</label>
          <select
            value={skinTone}
            onChange={(e) => {
              setSkinTone(e.target.value);
              savePreferences({ skin_tone: e.target.value });
            }}
            className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-body text-foreground outline-none appearance-none"
          >
            {skinToneOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Body Type */}
        <div className="mt-3">
          <label className="text-xs font-body text-muted-foreground">Body Type</label>
          <select
            value={bodyType}
            onChange={(e) => {
              setBodyType(e.target.value);
              savePreferences({ body_type: e.target.value });
            }}
            className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-body text-foreground outline-none appearance-none capitalize"
          >
            {bodyTypeOptions.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        {/* Default Model Gender */}
        <div className="mt-4">
          <label className="text-xs font-body text-muted-foreground">Default Model Gender</label>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {(["women", "men", "neutral"] as const).map((g) => (
              <button
                key={g}
                onClick={() => {
                  setModelGender(g);
                  savePreferences({ model_gender: g });
                }}
                className={"flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-body font-medium capitalize transition-all " + (modelGender === g ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground")}
              >
                {modelGender === g && <Check className="h-3 w-3" />}
                {g}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Full-size Image Modal */}
      {showImageModal && bodyPhoto && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowImageModal(false)}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative max-w-lg w-full max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <span className="text-2xl font-bold">&times;</span>
            </button>
            <img
              src={bodyPhoto}
              alt="Full body photo"
              className="w-full h-auto max-h-[85vh] object-contain rounded-xl"
            />
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default Profile;
