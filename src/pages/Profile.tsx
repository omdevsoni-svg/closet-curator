import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [measurements, setMeasurements] = useState<Record<string, any> | null>(null);
  const [sizeRec, setSizeRec] = useState<Record<string, any> | null>(null);
  const [sizeLoading, setSizeLoading] = useState(false);
  const [sizeCategory, setSizeCategory] = useState("general");
  const [sizeBrand, setSizeBrand] = useState("");
  const [showImageModal, setShowImageModal] = useState(false);
  const [capturingMeasurements, setCapturingMeasurements] = useState(false);

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

  const handleBodyPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      // Upload image first
      const url = await uploadImage(file, user.id, "body-photos");
      setBodyPhotoUrl(url);
      await updateProfile(user.id, { body_photo_url: url });

      // Run AI detection
      setIsAnalyzing(true);
      try {
        const attrs = await detectBodyAttributes(file);
        setBodyType(attrs.body_type);
        setSkinTone(attrs.skin_tone);
        await savePreferences({ body_type: attrs.body_type, skin_tone: attrs.skin_tone });
        toast({ title: "Body analysis complete", description: "Body type: " + attrs.body_type.replace("_", " ") + " | Skin tone: " + attrs.skin_tone + " (Confidence: " + attrs.confidence + ")" });
      } catch (aiErr) {
        console.error("AI detection failed:", aiErr);
        toast({ title: "Photo uploaded", description: "Body photo saved but AI analysis failed. You can set body type manually.", variant: "destructive" });
      } finally {
      // Capture body measurements from VTO API
      try {
        const capToken = (await supabase.auth.getSession()).data.session?.access_token;
        const reader = new FileReader();
        const imgBase64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(String(reader.result).split(",").pop() || "");
          reader.readAsDataURL(file);
        });
        const capRes = await fetch("/api/capture-measurements", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(capToken ? { Authorization: "Bearer " + capToken } : {}) },
          body: JSON.stringify({ userId: user.id, imageBase64: imgBase64 }),
        });
        const capData = await capRes.json();
        if (capData.success && capData.measurements) {
          setMeasurements(capData.measurements);
          await updateProfile(user.id, { body_measurements: capData.measurements });
        }
      } catch (capErr) {
        console.error("Measurement capture failed:", capErr);
      }

        setIsAnalyzing(false);
      }
    } catch (err) {
      console.error("Upload error:", err);
      toast({ title: "Upload failed", description: "Could not upload body photo.", variant: "destructive" });
    }
  };

  const currentBody = bodyTypeData[bodyType];
  const userName = profile?.name || user?.user_metadata?.name || "Style Enthusiast";

  const getSizeRecommendation = async () => {
  if (!measurements) return;
  setSizeLoading(true);
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const res = await fetch("/api/size-recommendation", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
      body: JSON.stringify({ measurements, category: sizeCategory, brand: sizeBrand || undefined }),
    });
    const data = await res.json();
    if (data.success) setSizeRec(data.sizes);
  } catch (err) {
    console.error("Size rec error:", err);
  } finally {
    setSizeLoading(false);
  }
  };


  const captureExistingMeasurements = async () => {
    if (!bodyPhoto) return;
    setCapturingMeasurements(true);
    try {
      const response = await fetch(bodyPhoto);
      const blob = await response.blob();
      const reader = new FileReader();
      const imgBase64 = await new Promise((resolve) => {
        reader.onload = () => resolve(String(reader.result).split(",").pop() || "");
        reader.readAsDataURL(blob);
      });
      const capToken = (await supabase.auth.getSession()).data.session?.access_token;
      const capRes = await fetch("/api/capture-measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + (capToken || "") },
        body: JSON.stringify({ userId: profile.id, imageBase64: imgBase64 }),
      });
      const capData = await capRes.json();
      if (capData.success && capData.measurements) {
        setMeasurements(capData.measurements);
      }
    } catch (e) {
      console.error("Measurement capture error:", e);
    } finally {
      setCapturingMeasurements(false);
    }
  };

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

      {/* My Sizes & Size Translator */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Ruler className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">My Sizes</h3>
            <p className="text-sm text-gray-500">Body measurements & AI size recommendations</p>
          </div>
        </div>
        {measurements ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Chest", key: "chest_cm", unit: "cm" },
                { label: "Waist", key: "waist_cm", unit: "cm" },
                { label: "Hip", key: "hip_cm", unit: "cm" },
                { label: "Shoulder", key: "shoulder_width_cm", unit: "cm" },
                { label: "Height", key: "height_cm", unit: "cm" },
                { label: "Inseam", key: "inseam_cm", unit: "cm" },
              ].map((m) => measurements[m.key] != null ? (
                <div key={m.key} className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">{m.label}</p>
                  <p className="text-lg font-semibold text-gray-900">{measurements[m.key]}<span className="text-xs text-gray-400 ml-0.5">{m.unit}</span></p>
                </div>
              ) : null)}
            </div>
            {(measurements.recommended_size || measurements.recommended_trouser) && (
              <div className="flex gap-3 flex-wrap">
                {measurements.recommended_size && (<div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2"><span className="text-xs text-indigo-600 block">Top Size</span><p className="text-lg font-bold text-indigo-700">{measurements.recommended_size}</p></div>)}
                {measurements.recommended_trouser && (<div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2"><span className="text-xs text-indigo-600 block">Bottom Size</span><p className="text-lg font-bold text-indigo-700">{measurements.recommended_trouser}</p></div>)}
              </div>
            )}
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">AI Size Translator</h4>
              <div className="flex gap-2 mb-3">
                <select value={sizeCategory} onChange={(e) => setSizeCategory(e.target.value)} className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm">
                  <option value="general">General</option>
                  <option value="tops">Tops</option>
                  <option value="bottoms">Bottoms</option>
                  <option value="dresses">Dresses</option>
                </select>
                <input type="text" placeholder="Brand (optional)" value={sizeBrand} onChange={(e) => setSizeBrand(e.target.value)} className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
                <button onClick={getSizeRecommendation} disabled={sizeLoading} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">{sizeLoading ? "..." : "Get Sizes"}</button>
              </div>
              {sizeRec && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[{ label: "Top", val: sizeRec.top_size }, { label: "Bottom", val: sizeRec.bottom_size }, { label: "Dress", val: sizeRec.dress_size }, { label: "Shirt", val: sizeRec.shirt_size }].map((s) => s.val ? (<div key={s.label} className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-center"><span className="text-xs text-emerald-600">{s.label}</span><p className="font-bold text-emerald-700">{s.val}</p></div>) : null)}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[{ label: "EU", val: sizeRec.eu_size }, { label: "US", val: sizeRec.us_size }, { label: "UK", val: sizeRec.uk_size }].map((s) => s.val ? (<div key={s.label} className="bg-gray-50 rounded-lg p-2 text-center"><span className="text-xs text-gray-500">{s.label}</span><p className="font-semibold text-gray-800">{s.val}</p></div>) : null)}
                  </div>
                  {sizeRec.fit_notes && <p className="text-xs text-gray-500 italic mt-1">{sizeRec.fit_notes}</p>}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-gray-400">
            {bodyPhoto && !measurements ? (
                <>
                  <button
                    onClick={captureExistingMeasurements}
                    disabled={capturingMeasurements}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 mx-auto"
                  >
                    {capturingMeasurements ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Capturing...</>
                    ) : (
                      <><Ruler className="w-4 h-4" /> Capture My Measurements</>
                    )}
                  </button>
                  <p className="text-gray-500 text-xs text-center mt-2">Uses your existing body photo</p>
                </>
              ) : !profile?.body_photo_url ? (
                <>
                  <Ruler className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm text-center">Upload a body photo to capture measurements</p>
                </>
              ) : null}
          </div>
        )}
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
