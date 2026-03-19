import { useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid, Shirt, Sparkles, HeartPulse, User } from "lucide-react";
import { motion } from "framer-motion";

const sideItems = [
  { path: "/home", label: "Home", icon: LayoutGrid },
  { path: "/closet", label: "Closet", icon: Shirt },
  // center FAB goes here visually
  { path: "/health", label: "Health", icon: HeartPulse },
  { path: "/profile", label: "Profile", icon: User },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isStylistActive = location.pathname === "/stylist";

  const renderNavButton = (item: (typeof sideItems)[0]) => {
    const isActive = location.pathname === item.path;
    const Icon = item.icon;
    return (
      <button
        key={item.path}
        onClick={() => navigate(item.path)}
        className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors"
      >
        {isActive && (
          <motion.div
            layoutId="nav-pill"
            className="absolute inset-0 rounded-xl bg-primary/5"
            transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
          />
        )}
        <Icon
          className={`relative z-10 h-5 w-5 transition-colors ${
            isActive ? "text-foreground" : "text-muted-foreground"
          }`}
          strokeWidth={isActive ? 2.5 : 1.8}
        />
        <span
          className={`relative z-10 text-[10px] font-body font-medium transition-colors ${
            isActive ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {item.label}
        </span>
        {isActive && (
          <motion.div
            layoutId="nav-dot"
            className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-foreground"
            transition={{ type: "spring", bounce: 0.3, duration: 0.5 }}
          />
        )}
      </button>
    );
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
        {sideItems.slice(0, 2).map(renderNavButton)}

        {/* Center Stylist FAB */}
        <div className="relative -mt-7">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate("/stylist")}
            className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg transition-all ${
              isStylistActive
                ? "bg-gradient-to-br from-[hsl(43,70%,50%)] to-[hsl(220,10%,65%)] text-white shadow-ai/30"
                : "bg-card text-muted-foreground shadow-black/10 hover:text-foreground dark:shadow-black/30"
            }`}
          >
            <Sparkles className="h-6 w-6" strokeWidth={isStylistActive ? 2.5 : 1.8} />
          </motion.button>
          <span
            className={`mt-1 block text-center text-[10px] font-body font-medium transition-colors ${
              isStylistActive ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            Stylist
          </span>
        </div>

        {sideItems.slice(2).map(renderNavButton)}
      </div>
    </nav>
  );
};

export default BottomNav;
