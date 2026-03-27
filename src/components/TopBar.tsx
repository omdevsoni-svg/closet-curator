import { Moon, Sun, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "@/hooks/useTheme";
import Logo from "./Logo";

const TopBar = () => {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border/50 bg-background/80 px-5 py-3 backdrop-blur-xl">
      <div className="flex items-center gap-2.5">
        <Logo className="h-7 w-7" />
        <span className="text-base font-display font-bold tracking-tight text-foreground">
          StyleOS
        </span>
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

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate("/settings")}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          aria-label="Settings"
        >
          <Settings className="h-[18px] w-[18px]" />
        </motion.button>
      </div>
    </header>
  );
};

export default TopBar;
