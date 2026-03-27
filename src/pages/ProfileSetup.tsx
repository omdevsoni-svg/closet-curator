import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { User, Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const ProfileSetup = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signUp, signIn } = useAuth();

  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect to home if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      navigate("/home", { replace: true });
    }
  }, [user, authLoading, navigate]);

  // While auth is loading or user is already logged in, show a minimal spinner
  // instead of the login form — this prevents the "flash" on PWA launch
  if (authLoading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary/30 border-t-primary" />
      </div>
    );
  }

  const handleSubmit = async () => {
    setError("");
    const trimEmail = email.trim().toLowerCase();
    const trimPassword = password.trim();

    if (!trimEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) {
      setError("Please enter a valid email address");
      return;
    }
    if (!trimPassword || trimPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    if (mode === "signup") {
      const trimName = name.trim();
      if (!trimName) {
        setError("Please enter your name");
        setLoading(false);
        return;
      }
      const { error: signUpError } = await signUp(trimEmail, trimPassword, trimName);
      if (signUpError) {
        setError(signUpError);
        setLoading(false);
        return;
      }
      navigate("/verify-email");
    } else {
      const { error: signInError } = await signIn(trimEmail, trimPassword);
      if (signInError) {
        setError(signInError);
        setLoading(false);
        return;
      }
      navigate("/home");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold tracking-tight bg-gradient-to-r from-[hsl(43,72%,50%)] to-[hsl(220,12%,68%)] bg-clip-text text-transparent">
            StyleOS
          </h1>
          <p className="mt-2 text-sm text-muted-foreground font-body">
            {mode === "signup"
              ? "Create your account to get started"
              : "Welcome back! Sign in to continue"}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-2xl bg-card p-1 mb-6">
          <button
            onClick={() => { setMode("signup"); setError(""); }}
            className={`flex-1 rounded-xl py-2.5 text-sm font-body font-medium transition-all ${
              mode === "signup"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign Up
          </button>
          <button
            onClick={() => { setMode("login"); setError(""); }}
            className={`flex-1 rounded-xl py-2.5 text-sm font-body font-medium transition-all ${
              mode === "login"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Log In
          </button>
        </div>

        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive font-body"
          >
            {error}
          </motion.div>
        )}

        {/* Form */}
        <div className="space-y-4">
          {mode === "signup" && (
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Name"
                className="h-12 w-full rounded-xl border border-border bg-card pl-11 pr-4 text-sm font-body text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email Address"
              className="h-12 w-full rounded-xl border border-border bg-card pl-11 pr-4 text-sm font-body text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="h-12 w-full rounded-xl border border-border bg-card pl-11 pr-11 text-sm font-body text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {mode === "login" && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => navigate("/reset-password")}
                className="text-xs text-primary font-body font-medium hover:underline"
              >
                Forgot password?
              </button>
            </div>
          )}

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleSubmit}
            disabled={loading}
            className="h-12 w-full rounded-xl bg-gradient-to-r from-[hsl(43,72%,50%)] to-[hsl(220,12%,68%)] text-white font-display font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <>
                {mode === "signup" ? "Create Account" : "Sign In"}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </motion.button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground font-body">
          {mode === "signup" ? (
            <>
              Already have an account?{" "}
              <button onClick={() => { setMode("login"); setError(""); }} className="text-primary font-medium">
                Log in
              </button>
            </>
          ) : (
            <>
              Don't have an account?{" "}
              <button onClick={() => { setMode("signup"); setError(""); }} className="text-primary font-medium">
                Sign up
              </button>
            </>
          )}
        </p>
      </motion.div>
    </div>
  );
};

export default ProfileSetup;
