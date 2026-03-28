import { Moon, Sun, Settings, ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "@/hooks/useTheme";
import Logo from "./Logo";

/* Pages that live in the bottom nav — no back button needed */
const MAIN_PAGES = ["/home", "/closet", "/stylist", "/health", "/profile"];

/* Friendly titles for sub-pages */
const SUB_PAGE_TITLES: Record<string, string> = {
  "/settings": "Settings",
  "/calendar": "Outfit Calendar",
};

const TopBar = () => {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const isSubPage = !MAIN_PAGES.includes(location.pathname);
  const subPageTitle = SUB_PAGE_TITLES[location.pathname];

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border/50 bg-background/80 px-5 py-3 backdrop-blur-xl">
      <div className="flex items-center gap-2.5">
        {isSubPage ? (
          <>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </motion.button>
            {subPageTitle && (
              <span className="text-base font-display font-bold tracking-tight text-foreground">
                {subPageTitle}
              </span>
            )}
          </>
        ) : (
          <>
            <Logo className="h-8 w-8" />
            <span className="text-base font-display font-bold tracking-tight text-foreground">
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

        {!isSubPage && (
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
    </header>
  );
};

export default TopBar;
