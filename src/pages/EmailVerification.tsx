import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, RefreshCw, CheckCircle, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const EmailVerification = () => {
  const navigate = useNavigate();
  const { user, emailVerified, signOut, resendVerificationEmail } = useAuth();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  // If user is already verified, redirect to home
  useEffect(() => {
    if (emailVerified && user) {
      navigate("/home", { replace: true });
    }
  }, [emailVerified, user, navigate]);

  // If no user at all, redirect to signup
  useEffect(() => {
    if (!user) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  // Cooldown timer for resend button
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (!user?.email || cooldown > 0) return;
    setResending(true);
    setError("");
    setResent(false);

    const { error: resendError } = await resendVerificationEmail(user.email);
    if (resendError) {
      setError(resendError);
    } else {
      setResent(true);
      setCooldown(60); // 60-second cooldown between resends
    }
    setResending(false);
  };

  const handleBackToSignIn = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md text-center"
      >
        {/* Animated mail icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10"
        >
          <Mail className="h-10 w-10 text-primary" />
        </motion.div>

        {/* Header */}
        <h1 className="text-2xl font-display font-bold text-foreground mb-2">
          Check your email
        </h1>
        <p className="text-sm text-muted-foreground font-body mb-2">
          We've sent a verification link to
        </p>
        <p className="text-sm font-body font-semibold text-foreground mb-6">
          {user?.email ?? "your email"}
        </p>

        {/* Instructions card */}
        <div className="rounded-2xl bg-card border border-border p-5 mb-6 text-left">
          <p className="text-sm text-muted-foreground font-body leading-relaxed">
            Click the link in the email to verify your account. Once verified, you'll be
            automatically signed in to StyleOS.
          </p>
          <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground font-body">
            <span className="mt-0.5 block h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0" />
            <span>Check your spam or junk folder if you don't see the email.</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive font-body"
          >
            {error}
          </motion.div>
        )}

        {/* Resent success */}
        {resent && !error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-xl bg-green-500/10 px-4 py-3 text-sm text-green-600 dark:text-green-400 font-body flex items-center justify-center gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            Verification email resent!
          </motion.div>
        )}

        {/* Resend button */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleResend}
          disabled={resending || cooldown > 0}
          className="h-12 w-full rounded-xl bg-gradient-to-r from-[hsl(43,72%,50%)] to-[hsl(220,12%,68%)] text-white font-display font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {resending ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : cooldown > 0 ? (
            <>
              <RefreshCw className="h-4 w-4" />
              Resend in {cooldown}s
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Resend Verification Email
            </>
          )}
        </motion.button>

        {/* Back to sign in */}
        <button
          onClick={handleBackToSignIn}
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground font-body hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Sign In
        </button>
      </motion.div>
    </div>
  );
};

export default EmailVerification;
