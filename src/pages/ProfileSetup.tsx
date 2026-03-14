import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Mail, Pencil, Check } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ProfileSetup = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "confirm">("email");
  const [derivedName, setDerivedName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [customName, setCustomName] = useState("");

  const extractName = (emailStr: string): string => {
    const local = emailStr.split("@")[0] || "";
    return local
      .replace(/[._\-+0-9]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  };

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleEmailSubmit = () => {
    if (!isValidEmail(email)) return;
    const name = extractName(email);
    setDerivedName(name);
    setCustomName(name);
    setStep("confirm");
  };

  const handleConfirm = () => {
    const finalName = customName.trim() || derivedName;
    localStorage.setItem("sv_user_name", finalName);
    localStorage.setItem("sv_user_email", email.trim());
    navigate("/home");
  };

  const displayName = customName.trim() || derivedName;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[hsl(38,90%,50%)] to-[hsl(350,80%,58%)] mb-4">
            <span className="text-2xl text-white font-bold">V</span>
          </div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">
            Welcome to Vastrika AI
          </h1>
          <p className="mt-2 text-sm text-muted-foreground font-body">
            {step === "email"
              ? "Enter your email to get started"
              : `Hi ${displayName}! Confirm your name to continue`}
          </p>
        </div>

        {step === "email" ? (
          <motion.div
            key="email-step"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-5"
          >
            {/* Email Input */}
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()}
                  placeholder="you@example.com"
                  className="h-14 pl-10 rounded-2xl border-2 border-border bg-card text-foreground font-body text-base placeholder:text-muted-foreground/50 focus:border-[hsl(38,90%,50%)] focus:ring-[hsl(38,90%,50%)] transition-colors"
                />
              </div>
            </div>

            <Button
              onClick={handleEmailSubmit}
              disabled={!isValidEmail(email)}
              className="h-14 w-full rounded-2xl bg-gradient-to-r from-[hsl(38,90%,50%)] to-[hsl(350,80%,58%)] text-white font-display text-base font-semibold tracking-wide transition-all hover:opacity-90 disabled:opacity-40 shadow-lg shadow-[hsl(38,90%,50%)]/25"
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="confirm-step"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-5"
          >
            {/* Name Display / Edit */}
            <div className="rounded-2xl border-2 border-border bg-card p-5">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3 block">
                Your Name
              </label>
              {editingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setEditingName(false);
                    }}
                    className="h-12 rounded-xl border-2 border-[hsl(38,90%,50%)] bg-background text-foreground font-body text-base focus:ring-[hsl(38,90%,50%)]"
                  />
                  <button
                    onClick={() => setEditingName(false)}
                    className="flex-shrink-0 h-10 w-10 rounded-xl bg-gradient-to-r from-[hsl(38,90%,50%)] to-[hsl(350,80%,58%)] flex items-center justify-center text-white"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-xl font-display font-bold text-foreground">
                    {displayName || "Your Name"}
                  </span>
                  <button
                    onClick={() => setEditingName(true)}
                    className="h-9 px-3 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-[hsl(38,90%,50%)] transition-colors flex items-center gap-1.5 text-xs font-medium"
                  >
                    <Pencil className="h-3 w-3" />
                    Rename
                  </button>
                </div>
              )}

              {/* Email shown for reference */}
              <p className="mt-3 text-xs text-muted-foreground font-body flex items-center gap-1.5">
                <Mail className="h-3 w-3" />
                {email}
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep("email")}
                className="h-14 flex-1 rounded-2xl border-2 border-border font-display text-sm font-semibold"
              >
                Back
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!displayName}
                className="h-14 flex-[2] rounded-2xl bg-gradient-to-r from-[hsl(38,90%,50%)] to-[hsl(350,80%,58%)] text-white font-display text-base font-semibold tracking-wide transition-all hover:opacity-90 disabled:opacity-40 shadow-lg shadow-[hsl(38,90%,50%)]/25"
              >
                Let's Go
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default ProfileSetup;
