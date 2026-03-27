import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    setError("");
    const trimEmail = email.trim().toLowerCase();

    if (!trimEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    const { error: resetError } = await resetPassword(trimEmail);
    if (resetError) {
      setError(resetError);
      setLoading(false);
      return;
    }
    setLoading(false);
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold tracking-tight bg-gradient-to-r from-[hsl(43,72%,50%)] to-[hsl(220,12%,68%)] bg-clip-text text-transparent">
            StyleOS
          </h1>
          <p className="mt-2 text-sm text-muted-foreground font-body">
            {sent ? "Check your inbox" : "Reset your password"}
          </p>
        </div>

        {sent ? (
          /* Success state */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-4"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle className="h-7 w-7 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground font-body leading-relaxed px-4">
              We've sent a password reset link to <span className="font-medium text-foreground">{email}</span>. Please check your email and follow the instructions.
            </p>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/")}
              className="h-12 w-full rounded-xl bg-gradient-to-r from-[hsl(43,72%,50%)] to-[hsl(220,12%,68%)] text-white font-display font-semibold text-sm transition-all hover:opacity-90 flex items-center justify-center gap-2"
            >
              Back to Sign In
            </motion.button>
          </motion.div>
        ) : (
          /* Form state */
          <>
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

            <div className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address"
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  className="h-12 w-full rounded-xl border border-border bg-card pl-11 pr-4 text-sm font-body text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleSubmit}
                disabled={loading}
                className="h-12 w-full rounded-xl bg-gradient-to-r from-[hsl(43,72%,50%)] to-[hsl(220,12%,68%)] text-white font-display font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  "Send Reset Link"
                )}
              </motion.button>
            </div>

            <button
              onClick={() => navigate("/")}
              className="mt-6 flex items-center justify-center gap-1.5 w-full text-xs text-muted-foreground font-body hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Sign In
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default ResetPassword;
