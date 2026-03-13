import { useLocation, useNavigate } from "react-router-dom";
import { Shirt, Sparkles, HeartPulse, User } from "lucide-react";
import { motion } from "framer-motion";

const navItems = [
  { path: "/closet", label: "Closet", icon: Shirt },
  { path: "/stylist", label: "Stylist", icon: Sparkles },
  { path: "/health", label: "Health", icon: HeartPulse },
  { path: "/profile", label: "Profile", icon: User },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="relative flex flex-col items-center gap-0.5 px-4 py-1.5 transition-colors"
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
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
