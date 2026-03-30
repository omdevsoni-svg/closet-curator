import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shirt,
  Sparkles,
  HeartPulse,
  User,
  CloudSun,
  Droplets,
  Wind,
  TrendingUp,
  Heart,
  ChevronRight,
  Star,
  X,
  ImageIcon,
  Loader2,
  Shuffle,
  Calendar,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { getClosetStats, getProfile, type ClothingItem, type Profile } from "@/lib/database";
import { getOutfitRecommendation } from "@/lib/ai-service";

/* ------------------------------------------------------------------ */
/*  Weather hook                                                       */
/* ------------------------------------------------------------------ */
interface WeatherData {
  temp: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  city: string;
  icon: string;
  tip: string;
}

const weatherTips: Record<string, string> = {
  hot: "Opt for light fabrics, breathable cotton, and open footwear.",
  warm: "Go with light layers -- a tee with optional light jacket works great.",
  mild: "Perfect layering weather -- try a shirt with a light blazer.",
  cool: "Add a structured jacket or sweater over your outfit.",
  cold: "Bundle up with coats, scarves, and warm boots.",
};

const getWeatherCategory = (temp: number) => {
  if (temp >= 35) return "hot";
  if (temp >= 28) return "warm";
  if (temp >= 20) return "mild";
  if (temp >= 12) return "cool";
  return "cold";
};

const conditionFromCode = (code: number): string => {
  if (code <= 1) return "Clear Sky";
  if (code <= 3) return "Partly Cloudy";
  if (code <= 48) return "Foggy";
  if (code <= 67) return "Rainy";
  if (code <= 77) return "Snowy";
  if (code <= 82) return "Showers";
  return "Stormy";
};

const useWeather = (): WeatherData | null => {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    const fetchWeatherForCoords = async (lat: number, lon: number) => {
      try {
        // Reverse geocode
        let city = "Your Location";
        try {
          const geoRes = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
          );
          const geoData = await geoRes.json();
          city = geoData.city || geoData.locality || "Your Location";
        } catch {}

        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,is_day&timezone=auto`
        );
        const data = await res.json();
        const current = data.current;
        const temp = Math.round(current.temperature_2m);
        const cat = getWeatherCategory(temp);
        const isDay = current.is_day === 1;
        const getWeatherIcon = (code: number, day: boolean): string => {
          if (code <= 1) return day ? "☀️" : "🌙";
          if (code <= 3) return day ? "⛅" : "☁️";
          if (code <= 48) return "🌫️";
          if (code <= 67) return "🌧️";
          if (code <= 77) return "🌨️";
          if (code <= 82) return "🌧️";
          return "⛈️";
        };

        setWeather({
          temp,
          condition: conditionFromCode(current.weather_code),
          humidity: current.relative_humidity_2m,
          windSpeed: Math.round(current.wind_speed_10m),
          city,
          icon: getWeatherIcon(current.weather_code, isDay),
          tip: weatherTips[cat],
        });
      } catch {
        setWeather({
          temp: 28,
          condition: "Partly Cloudy",
          humidity: 65,
          windSpeed: 12,
          city: "Your Location",
          icon: "⛅",
          tip: weatherTips.warm,
        });
      }
    };

    const fetchWeather = async () => {
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, {
            enableHighAccuracy: false,
            timeout: 5000,
          })
        );
        await fetchWeatherForCoords(pos.coords.latitude, pos.coords.longitude);
      } catch {
        try {
          const ipRes = await fetch("https://ipapi.co/json/");
          const ipData = await ipRes.json();
          if (ipData.latitude && ipData.longitude) {
            await fetchWeatherForCoords(ipData.latitude, ipData.longitude);
          } else {
            throw new Error("No coords");
          }
        } catch {
          setWeather({
            temp: 28,
            condition: "Partly Cloudy",
            humidity: 65,
            windSpeed: 12,
            city: "Your Location",
            icon: "⛅",
            tip: weatherTips.warm,
          });
        }
      }
    };

    fetchWeather();
  }, []);

  return weather;
};

/* ------------------------------------------------------------------ */
/*  Feature cards                                                      */
/* ------------------------------------------------------------------ */
const featureCards = [
  {
    label: "My Closet",
    icon: Shirt,
    path: "/closet",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  {
    label: "AI Stylist",
    icon: Sparkles,
    path: "/stylist",
    color: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  },
  {
    label: "Closet Health",
    icon: HeartPulse,
    path: "/health",
    color: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
  },
  {
    label: "Profile",
    icon: User,
    path: "/profile",
    color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  },
];

/* ------------------------------------------------------------------ */
/*  Home component                                                     */
/* ------------------------------------------------------------------ */
const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const weather = useWeather();
  const [showWelcome, setShowWelcome] = useState(() => {
    return !localStorage.getItem("styleos_welcome_dismissed");
  });
  const [userName, setUserName] = useState("Style Enthusiast");
  const [stats, setStats] = useState({ totalItems: 0, favorites: 0, styleScore: 0, items: [] as any[] });
  const [loadingStats, setLoadingStats] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [weatherOutfit, setWeatherOutfit] = useState<ClothingItem[]>([]);
  const [weatherTipAI, setWeatherTipAI] = useState<string | null>(null);
  const [loadingWeatherOutfit, setLoadingWeatherOutfit] = useState(false);
  const [allWeatherCombos, setAllWeatherCombos] = useState<{ item_ids: string[]; tip: string }[]>([]);
  const [currentComboIdx, setCurrentComboIdx] = useState(0);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      // Load profile name
      const prof = await getProfile(user.id);
      setProfile(prof);
      if (prof?.name) setUserName(prof.name);

      // Load closet stats
      const s = await getClosetStats(user.id);
      setStats(s);
      setLoadingStats(false);
    };
    load();
  }, [user]);

  // Fetch AI weather-based outfit when weather + items are ready
  useEffect(() => {
    if (!weather || stats.items.length === 0 || loadingStats || loadingWeatherOutfit || weatherOutfit.length > 0) return;

    const fetchWeatherOutfit = async () => {
      setLoadingWeatherOutfit(true);
      try {
        const occasion = `Everyday outfit for ${weather.temp}°C ${weather.condition} weather`;
        const result = await getOutfitRecommendation({
          occasion,
          items: stats.items.map((item: ClothingItem) => ({
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
          weather: {
            temp: weather.temp,
            condition: weather.condition,
            humidity: weather.humidity,
            windSpeed: weather.windSpeed,
          },
        });

        if (result.success) {
          // Use first combination from the new multi-combo response
          setAllWeatherCombos(result.combinations);
          const startIdx = Math.floor(Math.random() * result.combinations.length);
          setCurrentComboIdx(startIdx);
          const combo = result.combinations[startIdx];
          const picked = combo.item_ids
            .map((id) => stats.items.find((item: ClothingItem) => item.id === id))
            .filter(Boolean) as ClothingItem[];
          setWeatherOutfit(picked);
          setWeatherTipAI(combo.tip);
        }
      } catch {
        // Silently fall back to default tip
      } finally {
        setLoadingWeatherOutfit(false);
      }
    };

    fetchWeatherOutfit();
  }, [weather, stats.items, loadingStats]);

  // First-time onboarding
  const [onboardStep, setOnboardStep] = useState(() => {
    if (localStorage.getItem("styleos_onboarded")) return -1;
    return 0;
  });

  const onboardSteps = [
    { title: "Add Your Wardrobe", desc: "Upload photos of your clothes. Our AI detects the type, color, and material automatically.", icon: Shirt },
    { title: "Get AI Outfit Picks", desc: "Tell the AI your occasion and get personalized outfit suggestions from your actual closet.", icon: Sparkles },
    { title: "Track Closet Health", desc: "See what's missing, what you wear most, and get smart shopping suggestions.", icon: HeartPulse },
  ];

  const finishOnboarding = () => {
    localStorage.setItem("styleos_onboarded", "1");
    setOnboardStep(-1);
  };

  const shuffleWeatherOutfit = () => {
    if (allWeatherCombos.length <= 1) return;
    const nextIdx = (currentComboIdx + 1) % allWeatherCombos.length;
    setCurrentComboIdx(nextIdx);
    const combo = allWeatherCombos[nextIdx];
    const picked = combo.item_ids
      .map((id) => stats.items.find((item: ClothingItem) => item.id === id))
      .filter(Boolean) as ClothingItem[];
    setWeatherOutfit(picked);
    setWeatherTipAI(combo.tip);
  };

  return (
    <div className="px-5 pt-6 pb-4">
      {/* Onboarding overlay for first-time users */}
      <AnimatePresence>
        {onboardStep >= 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              key={onboardStep}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
              className="mx-6 w-full max-w-sm rounded-3xl bg-background p-8 text-center shadow-2xl"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-ai/10">
                {(() => { const Icon = onboardSteps[onboardStep].icon; return <Icon className="h-8 w-8 text-ai" />; })()}
              </div>
              <h2 className="mt-5 text-xl font-display font-bold text-foreground">
                {onboardSteps[onboardStep].title}
              </h2>
              <p className="mt-2 text-sm font-body text-muted-foreground">
                {onboardSteps[onboardStep].desc}
              </p>
              {/* Step dots */}
              <div className="mt-6 flex justify-center gap-2">
                {onboardSteps.map((_, i) => (
                  <div key={i} className={`h-2 rounded-full transition-all ${i === onboardStep ? "w-6 bg-ai" : "w-2 bg-border"}`} />
                ))}
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={finishOnboarding}
                  className="flex-1 rounded-xl py-3 text-sm font-body font-medium text-muted-foreground hover:text-foreground"
                >
                  Skip
                </button>
                <button
                  onClick={() => onboardStep < 2 ? setOnboardStep(onboardStep + 1) : finishOnboarding()}
                  className="flex-1 rounded-xl bg-ai py-3 text-sm font-display font-semibold text-ai-foreground"
                >
                  {onboardStep < 2 ? "Next" : "Get Started"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Welcome banner */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="relative mb-5 overflow-hidden rounded-2xl bg-gradient-to-r from-[hsl(43,70%,50%)] to-[hsl(220,10%,65%)] p-5 text-white"
          >
            <button
              onClick={() => {
                localStorage.setItem("styleos_welcome_dismissed", "1");
                setShowWelcome(false);
              }}
              className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white/80 hover:bg-white/30"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              <h2 className="text-lg font-display font-bold">
                {stats.totalItems === 0 ? `Welcome, ${userName}!` : `Hey, ${userName}!`}
              </h2>
            </div>
            <p className="mt-1 text-sm font-body text-white/80">
              {stats.totalItems === 0
                ? "Your AI stylist is ready. Add items to your closet and get personalized outfit suggestions."
                : `You have ${stats.totalItems} items in your closet. Get styled by AI or check your closet health.`}
            </p>
            <button
              onClick={() => navigate(stats.totalItems === 0 ? "/closet" : "/stylist")}
              className="mt-3 flex items-center gap-1 rounded-xl bg-white/20 px-4 py-2 text-sm font-body font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/30"
            >
              {stats.totalItems === 0 ? "Add Your First Item" : "Get Styled"}
              <ChevronRight className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wardrobe stats */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex flex-col items-center rounded-2xl bg-card p-4"
        >
          <Shirt className="h-5 w-5 text-ai" />
          <span className="mt-1.5 text-xl font-display font-bold text-foreground">
            {loadingStats ? "--" : stats.totalItems}
          </span>
          <span className="text-[10px] font-body text-muted-foreground">Total Items</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col items-center rounded-2xl bg-card p-4"
        >
          <Heart className="h-5 w-5 text-rose-500" />
          <span className="mt-1.5 text-xl font-display font-bold text-foreground">
            {loadingStats ? "--" : stats.favorites}
          </span>
          <span className="text-[10px] font-body text-muted-foreground">Favorites</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex flex-col items-center rounded-2xl bg-card p-4"
        >
          <Star className="h-5 w-5 text-amber-500" />
          <span className="mt-1.5 text-xl font-display font-bold text-foreground">
            {loadingStats ? "--" : stats.styleScore || "--"}
          </span>
          <span className="text-[10px] font-body text-muted-foreground">Style Score</span>
        </motion.div>
      </div>

      {/* Laundry reminder */}
      {!loadingStats && (() => {
        const laundryItems = stats.items.filter((i: any) => i.laundry_status === "in_laundry");
        const oldItems = laundryItems.filter((i: any) => i.laundry_sent_at && (Date.now() - new Date(i.laundry_sent_at).getTime()) > 3 * 86400000);
        if (laundryItems.length === 0) return null;
        return (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-5 rounded-2xl px-4 py-3 flex items-center justify-between ${oldItems.length > 0 ? "bg-amber-500/10" : "bg-blue-500/10"}`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${oldItems.length > 0 ? "bg-amber-500/20" : "bg-blue-500/20"}`}>
                <span className="text-base">🧺</span>
              </div>
              <div>
                <p className={`text-xs font-body font-medium ${oldItems.length > 0 ? "text-amber-700 dark:text-amber-400" : "text-blue-700 dark:text-blue-400"}`}>
                  {laundryItems.length} item{laundryItems.length > 1 ? "s" : ""} in laundry
                  {oldItems.length > 0 && " -- some over 3 days!"}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate("/health")}
              className={`text-[11px] font-body font-semibold ${oldItems.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"}`}
            >
              View
            </button>
          </motion.div>
        );
      })()}

      {/* Unworn items nudge */}
      {!loadingStats && (() => {
        const unworn = stats.items.filter(
          (i: any) => !i.archived && (!i.worn_count || i.worn_count === 0)
        );
        if (unworn.length === 0) return null;
        return (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/10">
                  <Shirt className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                </div>
                <p className="text-xs font-body font-semibold text-violet-700 dark:text-violet-400">
                  {unworn.length} item{unworn.length > 1 ? "s" : ""} never worn
                </p>
              </div>
              <button
                onClick={() => navigate("/closet")}
                className="text-[11px] font-body font-semibold text-violet-600 dark:text-violet-400"
              >
                View All
              </button>
            </div>
            <div className="flex gap-2.5 overflow-x-auto scrollbar-none pb-1">
              {unworn.slice(0, 8).map((item: any) => (
                <div key={item.id} className="shrink-0">
                  <div className="h-20 w-16 overflow-hidden rounded-xl bg-card border border-violet-200/50 dark:border-violet-800/30 p-1.5">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <p className="mt-0.5 text-center text-[9px] font-body text-muted-foreground truncate w-16">
                    {item.name}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        );
      })()}

      {/* Explore Features */}
      <h2 className="text-base font-display font-semibold text-foreground">
        Explore Features
      </h2>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {featureCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.button
              key={card.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(card.path)}
              className="flex flex-col items-center gap-2 rounded-2xl bg-card p-3 transition-colors hover:bg-card/80"
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.color}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-body font-medium text-foreground">
                {card.label}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Weather-Based Outfit Suggestion */}
      {weather && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-display font-semibold text-foreground">
            <CloudSun className="h-4 w-4 text-ai" />
            Today's Weather Outfit
          </h2>
            {allWeatherCombos.length > 1 && (
              <motion.button whileTap={{ scale: 0.9 }} onClick={shuffleWeatherOutfit}
                className="flex items-center gap-1 rounded-lg bg-card px-2.5 py-1 text-[11px] font-display font-medium text-muted-foreground hover:text-foreground transition-colors">
                <Shuffle className="h-3 w-3" /> Shuffle
              </motion.button>
            )}
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl bg-card">
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-emoji">{weather.icon}</span>
                <div>
                  <span className="text-2xl font-display font-bold text-foreground">
                    {weather.temp}°C
                  </span>
                  <p className="text-xs font-body text-muted-foreground">
                    {weather.condition} · {weather.city}
                  </p>
                </div>
              </div>
              <div className="flex gap-4 text-xs font-body text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Droplets className="h-3 w-3" /> {weather.humidity}%
                </span>
                <span className="flex items-center gap-1">
                  <Wind className="h-3 w-3" /> {weather.windSpeed} km/h
                </span>
              </div>
            </div>

            <div className="px-4 py-3">
              <p className="text-xs font-body text-ai font-medium">
                <Sparkles className="mr-1 inline h-3 w-3" />
                {weatherTipAI ? "AI Styling Tip" : "Styling Tip"}
              </p>
              <p className="mt-0.5 text-sm font-body text-foreground">
                {weatherTipAI || weather.tip}
              </p>
            </div>

            {/* Show AI-recommended weather outfit or loading state */}
            {loadingWeatherOutfit ? (
              <div className="flex items-center justify-center gap-2 px-4 pb-4">
                <Loader2 className="h-4 w-4 animate-spin text-ai" />
                <span className="text-xs font-body text-muted-foreground">
                  AI is picking your weather outfit...
                </span>
              </div>
            ) : weatherOutfit.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto px-4 pb-4 scrollbar-none">
                {weatherOutfit.map((item: ClothingItem, i: number) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    className="shrink-0"
                  >
                    <div className="h-28 w-24 overflow-hidden rounded-xl bg-background p-2">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    <p className="mt-1 text-center text-[10px] font-body font-medium text-foreground truncate w-24">
                      {item.name}
                    </p>
                  </motion.div>
                ))}
              </div>
              {/* Try On button */}
              <div className="px-4 pb-3 pt-1">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate(`/stylist?tryOn=${weatherOutfit.map(i => i.id).join(",")}`)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-ai/10 py-2.5 text-sm font-display font-semibold text-ai hover:bg-ai/20 transition-colors"
                >
                  <Sparkles className="h-4 w-4" />
                  Try On This Outfit
                </motion.button>
              </div>
            ) : stats.items.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto px-4 pb-4 scrollbar-none">
                {stats.items.slice(0, 4).map((item: any, i: number) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    className="shrink-0"
                  >
                    <div className="h-28 w-24 overflow-hidden rounded-xl bg-background p-2">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    <p className="mt-1 text-center text-[10px] font-body font-medium text-foreground truncate w-24">
                      {item.name}
                    </p>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="px-4 pb-4">
                <button
                  onClick={() => navigate("/closet")}
                  className="w-full rounded-xl border-2 border-dashed border-border py-4 text-xs font-body text-muted-foreground hover:border-muted-foreground transition-colors"
                >
                  Add items to your closet to see outfit suggestions
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Quick Actions */}
      <div className="mt-6">
        <h2 className="text-base font-display font-semibold text-foreground">
          Quick Actions
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/stylist")}
            className="flex items-center gap-3 rounded-2xl bg-card p-4 transition-colors hover:bg-card/80"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-body font-medium text-foreground">Get Styled</p>
              <p className="text-[10px] font-body text-muted-foreground">AI outfit picks</p>
            </div>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/stylist?tab=mix")}
            className="flex items-center gap-3 rounded-2xl bg-card p-4 transition-colors hover:bg-card/80"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
              <Shuffle className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-body font-medium text-foreground">Mix & Match</p>
              <p className="text-[10px] font-body text-muted-foreground">Build your outfit</p>
            </div>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/health")}
            className="flex items-center gap-3 rounded-2xl bg-card p-4 transition-colors hover:bg-card/80"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-body font-medium text-foreground">View Analytics</p>
              <p className="text-[10px] font-body text-muted-foreground">Closet insights</p>
            </div>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/calendar")}
            className="flex items-center gap-3 rounded-2xl bg-card p-4 transition-colors hover:bg-card/80"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <Calendar className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-body font-medium text-foreground">Plan Outfits</p>
              <p className="text-[10px] font-body text-muted-foreground">Outfit calendar</p>
            </div>
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default Home;