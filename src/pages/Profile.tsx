import { useState } from "react";
import {
  User,
  Settings,
  LogOut,
  ChevronRight,
  Camera,
  ImageIcon,
  Sparkles,
  Check,
  Moon,
  Sun,
  Bell,
  BellOff,
  Shield,
  Trash2,
  Pencil,
} from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/hooks/useTheme";

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
  const { theme, toggleTheme } = useTheme();
  const userName = localStorage.getItem("sv_user_name") || "Style Enthusiast";
  const [bodyType, setBodyType] = useState("rectangle");
  const [skinTone, setSkinTone] = useState("Medium");
  const [modelGender, setModelGender] = useState<"women" | "men" | "neutral">("neutral");
  const [bodyPhoto, setBodyPhoto] = useState<string | null>(null);
  const [notifOutfits, setNotifOutfits] = useState(true);
  const [notifGaps, setNotifGaps] = useState(true);
  const [personalization, setPersonalization] = useState(true);

  const currentBody = bodyTypeData[bodyType];

  const handleBodyPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setBodyPhoto(URL.createObjectURL(file));
  };

  return (
    <div className="px-5 pt-5 pb-4">
      <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">
        Settings
      </h1>
      <p className="text-sm text-muted-foreground font-body">
        Manage your account and preferences
      </p>

      {/* Profile card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-5 flex items-center justify-between rounded-2xl bg-card p-5"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(263,70%,66%)] to-[hsl(280,80%,75%)] text-white font-display font-bold text-lg">
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
            <p className="text-xs text-muted-foreground font-body">6 items in closet</p>
          </div>
        </div>
        <button className="flex h-8 w-8 items-center justify-center rounded-full bg-background text-muted-foreground hover:text-foreground">
          <Pencil className="h-4 w-4" />
        </button>
      </motion.div>

      {/* Body Type Photo */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-4 rounded-2xl bg-card p-5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <h3 className="text-sm font-display font-semibold text-foreground">
                Body Type Photo
              </h3>
              <p className="text-xs text-muted-foreground font-body">
                Full-body photo for accurate detection
              </p>
            </div>
          </div>
          <span className="rounded-full bg-ai/10 px-3 py-1 text-[10px] font-semibold text-ai font-body">
            {currentBody.type}
          </span>
        </div>

        <div className="mt-4 flex items-start gap-4">
          {bodyPhoto ? (
            <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-background">
              <img
                src={bodyPhoto}
                alt="Body type"
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-24 w-20 shrink-0 items-center justify-center rounded-xl bg-background">
              <User className="h-8 w-8 text-muted-foreground/30" />
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground font-body">
              Upload a full-body photo for better body type detection. Use a well-lit photo in
              fitted clothing.
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
        transition={{ delay: 0.15 }}
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
        transition={{ delay: 0.2 }}
        className="mt-4 rounded-2xl bg-card p-5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-display font-semibold text-foreground">
              Style Preferences
            </h3>
          </div>
          <button className="flex items-center gap-1 rounded-lg bg-ai/10 px-2.5 py-1 text-[10px] font-body font-medium text-ai">
            <Sparkles className="h-3 w-3" />
            Detect from Photo
          </button>
        </div>

        {/* Skin Tone */}
        <div className="mt-4">
          <label className="text-xs font-body text-muted-foreground">
            Skin Tone
          </label>
          <select
            value={skinTone}
            onChange={(e) => setSkinTone(e.target.value)}
            className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-body text-foreground outline-none appearance-none"
          >
            {skinToneOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Body Type */}
        <div className="mt-3">
          <label className="text-xs font-body text-muted-foreground">
            Body Type
          </label>
          <select
            value={bodyType}
            onChange={(e) => setBodyType(e.target.value)}
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
          <label className="text-xs font-body text-muted-foreground">
            Default Model Gender
          </label>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {(["women", "men", "neutral"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setModelGender(g)}
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

      {/* Notifications */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="mt-4 rounded-2xl bg-card p-5"
      >
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-display font-semibold text-foreground">
            Notifications
          </h3>
        </div>

        <div className="mt-3 space-y-3">
          <ToggleRow
            label="Outfit suggestions"
            desc="Get notified for new outfit ideas"
            value={notifOutfits}
            onChange={setNotifOutfits}
          />
          <ToggleRow
            label="Gap recommendations"
            desc="Alerts for wardrobe gaps"
            value={notifGaps}
            onChange={setNotifGaps}
          />
        </div>
      </motion.div>

      {/* Privacy */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-4 rounded-2xl bg-card p-5"
      >
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-display font-semibold text-foreground">
            Privacy
          </h3>
        </div>
        <div className="mt-3">
          <ToggleRow
            label="Personalization"
            desc="Allow AI to learn preferences"
            value={personalization}
            onChange={setPersonalization}
          />
        </div>
      </motion.div>

      {/* Danger zone */}
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="mt-4 flex w-full items-center justify-between rounded-2xl bg-card p-5 text-destructive transition-colors hover:bg-destructive/5"
      >
        <span className="text-sm font-body font-medium">Delete All Data</span>
        <ChevronRight className="h-4 w-4" />
      </motion.button>

      {/* Sign Out */}
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-card p-4 text-muted-foreground transition-colors hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        <span className="text-sm font-body font-medium">Sign Out</span>
      </motion.button>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Toggle row helper                                                  */
/* ------------------------------------------------------------------ */
const ToggleRow = ({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) => (
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-body font-medium text-foreground">{label}</p>
      <p className="text-xs font-body text-muted-foreground">{desc}</p>
    </div>
    <button
      onClick={() => onChange(!value)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        value ? "bg-primary" : "bg-border"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          value ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  </div>
);

export default Profile;
