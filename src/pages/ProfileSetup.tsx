import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { User, Mail, ArrowRight } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Google Identity Services                                           */
/* ------------------------------------------------------------------ */
const GOOGLE_CLIENT_ID = "447102577651-dcg76ksa2gi14rhf7l5ohsqu6ca6uvcj.apps.googleusercontent.com";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (el: HTMLElement, config: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

function decodeJwt(token: string): Record<string, string> {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
const ProfileSetup = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const googleBtnRef = useRef<HTMLDivElement>(null);

  /* --- load Google Sign-In button --- */
  useEffect(() => {
    if (GOOGLE_CLIENT_ID === "YOUR_GOOGLE_CLIENT_ID") return; // not configured

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      if (!window.google || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response: { credential: string }) => {
          const payload = decodeJwt(response.credential);
          const gName = payload.name || payload.given_name || "User";
          const gEmail = payload.email || "";
          localStorage.setItem("sv_user_name", gName);
          localStorage.setItem("sv_user_email", gEmail);
          navigate("/home");
        },
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: "outline",
        size: "large",
        width: googleBtnRef.current.offsetWidth,
        text: "continue_with",
        shape: "pill",
      });
    };
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [navigate]);

  /* --- manual form continue --- */
  const handleContinue = () => {
    const trimName = name.trim();
    const trimEmail = email.trim();

    if (!trimName) {
      setError("Please enter your name");
      return;
    }
    if (!trimEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    localStorage.setItem("sv_user_name", trimName);
    localStorage.setItem("sv_user_email", trimEmail);
    navigate("/home");
  };

  /* --- render --- */
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5 py-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md space-y-8"
      >
        {/* heading */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[hsl(38,90%,50%)] to-[hsl(350,80%,58%)] mb-3">
            <span className="text-2xl text-white font-bold">V</span>
          </div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">
            Welcome to Vastrika AI
          </h1>
          <p className="text-sm text-muted-foreground font-body">
            Sign in to get your personalised style
          </p>
        </div>

        {/* Google Sign-In (rendered by GIS SDK) */}
        <div ref={googleBtnRef} className="flex justify-center" />

        {/* divider â only show when Google is configured */}
        {GOOGLE_CLIENT_ID !== "YOUR_GOOGLE_CLIENT_ID" && (
          <div className="flex items-center gap-3">
            <span className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground font-body">or</span>
            <span className="flex-1 h-px bg-border" />
          </div>
        )}

        {/* form */}
        <div className="space-y-4">
          {/* name */}
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              className="w-full h-13 rounded-2xl border-2 border-border bg-card pl-11 pr-4 text-foreground placeholder:text-muted-foreground/60 text-sm font-body focus:outline-none focus:border-[hsl(38,90%,50%)] transition-colors"
            />
          </div>

          {/* email */}
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleContinue()}
              className="w-full h-13 rounded-2xl border-2 border-border bg-card pl-11 pr-4 text-foreground placeholder:text-muted-foreground/60 text-sm font-body focus:outline-none focus:border-[hsl(38,90%,50%)] transition-colors"
            />
          </div>

          {/* error */}
          {error && (
            <p className="text-xs text-red-500 text-center font-body">{error}</p>
          )}

          {/* continue button */}
          <button
            type="button"
            onClick={handleContinue}
            className="w-full h-13 rounded-2xl bg-gradient-to-r from-[hsl(38,90%,50%)] to-[hsl(350,80%,58%)] text-white font-display text-base font-semibold tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-[hsl(38,90%,50%)]/20 transition hover:opacity-90 active:scale-[0.98]"
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <p className="text-center text-[11px] text-muted-foreground/70 font-body">
          By continuing you agree to our Terms &amp; Privacy Policy
        </p>
      </motion.div>
    </div>
  );
};

export default ProfileSetup;
