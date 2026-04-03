import { Moon, Sun, Settings, ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "@/hooks/useTheme";
import Logo from "./Logo";

/* Only the home page has no back button */
const NO_BACK_PAGES = ["/home"];

/* Friendly titles for pages (shown alongside back button) */
const PAGE_TITLES: Record<string, string> = {
  "/closet": "My Closet",
  "/stylist": "AI Stylist",
  "/health": "Closet Health",
  "/profile": "Profile",
  "/settings": "Settings",
  "/calendar": "Outfit Calendar",
  "/unworn": "Items Never Worn",
};

const TopBar = () => {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const showBack = !NO_BACK_PAGES.includes(location.pathname);
  const pageTitle = PAGE_TITLES[location.pathname];

  return (
    <header className="sticky top-0 z-40">
      <div className="flex items-center justify-between bg-background/80 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          {showBack ? (
            <>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate(-1)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
              </motion.button>
              {pageTitle && (
                <span className="text-base font-display font-bold tracking-tight text-foreground">
                  {pageTitle}
                </span>
              )}
            </>
          ) : (
            <>
              <Logo className="h-7 w-7" />
              <span
                className="text-[17px] font-display font-extrabold tracking-tight"
                style={{
                  background: "linear-gradient(135deg, #A855F7 0%, #C084FC 40%, #F59E0B 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  filter: "drop-shadow(0 0 8px rgba(168,85,247,0.3))",
                  letterSpacing: "-0.03em",
                }}
              >
                StyleOS
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="h-[18px] w-[18px]" />
            ) : (
              <Moon className="h-[18px] w-[18px]" />
            )}
          </motion.button>

          {!showBack && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate("/settings")}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
              aria-label="Settings"
            >
              <Settings className="h-[18px] w-[18px]" />
            </motion.button>
          )}
        </div>
      </div>
      {/* Gradient accent line */}
      <div
        className="h-[2px] w-full"
        style={{
          background: "linear-gradient(90deg, #7C3AED 0%, #A855F7 30%, #F59E0B 70%, #7C3AED 100%)",
          opacity: 0.6,
        }}
      />
    </header>
  );
};

export default TopBar;
