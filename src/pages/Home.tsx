import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shirt,
  Sparkles,
  HeartPulse,
  Calendar,
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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { getClosetStats, getProfile } from "@/lib/database";

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
  warm: "Go with light layers  -  a tee with optional light jacket works great.",
  mild: "Perfect layering weather  -  try a shirt with a light blazer.",
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
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`
        );
        const data = await res.json();
        const current = data.current;
        const temp = Math.round(current.temperature_2m);
        const cat = getWeatherCategory(temp);

        setWeather({
          temp,
          condition: conditionFromCode(current.weather_code),
          humidity: current.relative_humidity_2m,
          windSpeed: Math.round(current.wind_speed_10m),
          city,
          icon: current.weather_code <= 1 ? " - " : current.weather_code <= 3 ? " - " : " - ",
          tip: weatherTips[cat],
        });
      } catch {
        setWeather({
          temp: 28,
          condition: "Partly Cloudy",
          humidity: 65,
          windSpeed: 12,
          city: "Your Location",
          icon: " - ",
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
            icon: " - ",
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
    label: "OOTD",
    icon: Calendar,
    path: "/stylist",
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
  const [showWelcome, setShowWelcome] = useState(true);
  const [userName, setUserName] = useState("Style Enthusiast");
  const [stats, setStats] = useState({ totalItems: 0, favorites: 0, styleScore: 0, items: [] as any[] });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      // Load profile name
      const profile = await getProfile(user.id);
      if (profile?.name) setUserName(profile.name);

      // Load closet stats
      const s = await getClosetStats(user.id);
      setStats(s);
      setLoadingStats(false);
    };
    load();
  }, [user]);

  return (
    <div className="px-5 pt-6 pb-4">
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
              onClick={() => setShowWelcome(false)}
              className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white/80 hover:bg-white/30"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              <h2 className="text-lg font-display font-bold">
                Welcome, {userName}!
              </h2>
            </div>
            <p className="mt-1 text-sm font-body text-white/80">
              Your AI stylist is ready. Add items to your closet and get personalized outfit suggestions.
            </p>
            <button
              onClick={() => navigate("/closet")}
              className="mt-3 flex items-center gap-1 rounded-xl bg-white/20 px-4 py-2 text-sm font-body font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/30"
            >
              Add Your First Item
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
            {loadingStats ? " - " : stats.totalItems}
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
            {loadingStats ? " - " : stats.favorites}
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
            {loadingStats ? " - " : stats.styleScore || " - "}
          </span>
          <span className="text-[10px] font-body text-muted-foreground">Style Score</span>
        </motion.div>
      </div>

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
          <h2 className="flex items-center gap-2 text-base font-display font-semibold text-foreground">
            <CloudSun className="h-4 w-4 text-ai" />
            Today's Weather Outfit
          </h2>

          <div className="mt-3 overflow-hidden rounded-2xl bg-card">
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-emoji">{weather.icon}</span>
                <div>
                  <span className="text-2xl font-display font-bold text-foreground">
                    {weather.temp}°C
                  </span>
                  <p className="text-xs font-body text-muted-foreground">
                    {weather.condition}  -  {weather.city}
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
                Styling Tip
              </p>
              <p className="mt-0.5 text-sm font-body text-foreground">
                {weather.tip}
              </p>
            </div>

            {/* Show closet items if available */}
            {stats.items.length > 0 ? (
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
        </div>
      </div>
    </div>
  );
};

export default Home;
