import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import Logo from "./Logo";

interface SplashScreenProps {
  onFinish: () => void;
}

const SplashScreen = ({ onFinish }: SplashScreenProps) => {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");

  useEffect(() => {
    const holdTimer = setTimeout(() => setPhase("hold"), 600);
    const exitTimer = setTimeout(() => setPhase("exit"), 2400);
    const finishTimer = setTimeout(onFinish, 3000);
    return () => {
      clearTimeout(holdTimer);
      clearTimeout(exitTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <AnimatePresence>
      {phase !== "exit" ? null : null}
      <motion.div
        key="splash"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        animate={phase === "exit" ? { opacity: 0 } : { opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0f0a1a 0%, #1a1030 50%, #0f0a1a 100%)" }}
      >
        {/* Animated gradient orbs */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.4 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="pointer-events-none absolute -left-20 -top-20 h-[400px] w-[400px] rounded-full blur-[120px]"
          style={{ background: "hsl(263, 70%, 66%)" }}
        />
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.3 }}
          transition={{ duration: 1.2, delay: 0.2, ease: "easeOut" }}
          className="pointer-events-none absolute -bottom-20 -right-20 h-[350px] w-[350px] rounded-full blur-[100px]"
          style={{ background: "hsl(280, 80%, 75%)" }}
        />

        {/* Glassmorphism card */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex flex-col items-center gap-5 rounded-3xl border border-white/15 bg-white/[0.06] px-12 py-10 shadow-2xl backdrop-blur-2xl sm:px-16 sm:py-14"
        >
          {/* Shimmer overlay */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: "200%" }}
            transition={{ duration: 1.5, delay: 0.8, ease: "easeInOut" }}
            className="pointer-events-none absolute inset-0 rounded-3xl"
            style={{
              background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)",
            }}
          />

          {/* Logo */}
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.6, delay: 0.5, type: "spring", stiffness: 200 }}
          >
            <Logo className="h-16 w-16 sm:h-20 sm:w-20" />
          </motion.div>

          {/* App name */}
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="text-2xl font-display font-extrabold tracking-tight text-white sm:text-3xl"
          >
                        Vastrika AI
          </motion.h1>

          {/* Tagline */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 1.1 }}
            className="flex items-center gap-2"
          >
            <Sparkles className="h-3.5 w-3.5 text-[hsl(263,70%,76%)]" />
            <span className="text-xs font-body font-medium tracking-wider text-white/50 uppercase">
                            AI-Powered Wardrobe
            </span>
          </motion.div>

          {/* Loading dots */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4 }}
            className="mt-2 flex gap-1.5"
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, delay: 1.5 + i * 0.15, repeat: Infinity }}
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: "hsl(263, 70%, 66%)" }}
              />
            ))}
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SplashScreen;
