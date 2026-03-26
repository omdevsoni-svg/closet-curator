import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Settings,
  Camera,
  ImageIcon,
  Sparkles,
  Check,
  Pencil,
  Loader2,
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

/* ------------------------------------------------------------------ */
/*  Body type data                                                     */
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
      "Balanced proportions work best — match volume top & bottom",
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
/*  Main Profile component                                             */
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

  const handleBodyPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const url = await uploadImage("profile-images", user.id, file);
    if (url) {
      setBodyPhoto(url);
      await savePreferences({ body_image_url: url });
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
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate("/settings")}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-card text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Settings"
        >
          <Settings className="h-[18px] w-[18px]" />
        </motion.button>
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
        <button className="flex h-8 w-8 items-center justify-center rounded-full bg-background text-muted-foreground hover:text-foreground">
          <Pencil className="h-4 w-4" />
        </button>
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
            <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-xl bg-background ring-2 ring-[hsl(43,70%,50%)]/20">
              <img
                src={bodyPhoto}
                alt="Full body"
                className="h-full w-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          ) : (
            <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-xl bg-background ring-2 ring-border">
              <User className="h-8 w-8 text-muted-foreground/30" />
            </div>
          )}
          <div className="flex-1">
            <p className="text-xs text-muted-foreground font-body">
              Upload a full-body photo in fitted clothing for accurate body type detection. Use a well-lit environment.
            </p>
            <div className="mt-2 flex gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-background px-3 py-1.5 text-xs font-body font-medium text-muted-foreground transition-colors hover:text-foreground">
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleBodyPhotoUpload} />
                <Camera className="h-3.5 w-3.5" />
                Camera
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-background px-3 py-1.5 text-xs font-body font-medium text-muted-foreground transition-colors hover:text-foreground">
                <input type="file" accept="image/*" className="hidden" onChange={handleBodyPhotoUpload} />
                <ImageIcon className="h-3.5 w-3.5" />
                Gallery
              </label>
            </div>
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
                className={`flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-body font-medium capitalize transition-all ${
                  modelGender === g
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground"
                }`}
              >
                {modelGender === g && <Check className="h-3 w-3" />}
                {g}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

    </div>
  );
};

export default Profile;
