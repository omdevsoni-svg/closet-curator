import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sun,
  Moon,
  Bell,
  Shield,
  Trash2,
  LogOut,
  ChevronRight,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Palette,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  getProfile,
  updateProfile,
  type Profile as ProfileType,
} from "@/lib/database";

/* ------------------------------------------------------------------ */
/*  Main Settings component                                            */
/* ------------------------------------------------------------------ */
const Settings = () => {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Toggles
  const [notifOutfits, setNotifOutfits] = useState(true);
  const [notifGaps, setNotifGaps] = useState(true);
  const [personalization, setPersonalization] = useState(true);

  // Change password
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const p = await getProfile(user.id);
      if (p) {
        setProfile(p);
        setNotifOutfits(p.notif_outfits);
        setNotifGaps(p.notif_gaps);
        setPersonalization(p.personalization);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const savePreferences = async (updates: Record<string, any>) => {
    if (!user) return;
    setSaving(true);
    await updateProfile(user.id, updates);
    setSaving(false);
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);

    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordSuccess(false);
      }, 2000);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/setup");
  };

  const handleDeleteAllData = async () => {
    await signOut();
    navigate("/setup");
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="px-5 pt-5 pb-4">
      <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">
        Settings
      </h1>
      <p className="text-sm text-muted-foreground font-body">
        Manage your preferences and account
      </p>

      {/* ── Appearance ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-5 rounded-2xl bg-card p-5"
      >
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-display font-semibold text-foreground">
            Appearance
          </h3>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-body font-medium text-foreground">
              Theme Mode
            </p>
            <p className="text-xs font-body text-muted-foreground">
              Switch between light and dark theme
            </p>
          </div>
          <button
            onClick={toggleTheme}
            className={`relative flex h-10 w-20 items-center rounded-full p-1 transition-colors ${
              theme === "dark" ? "bg-ai" : "bg-border"
            }`}
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm transition-transform ${
                theme === "dark" ? "translate-x-10" : "translate-x-0"
              }`}
            >
              {theme === "dark" ? (
                <Moon className="h-4 w-4 text-ai" />
              ) : (
                <Sun className="h-4 w-4 text-amber-500" />
              )}
            </span>
          </button>
        </div>
      </motion.div>

      {/* ── Notifications ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-4 rounded-2xl bg-card p-5"
      >
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-display font-semibold text-foreground">
            Notifications
          </h3>
        </div>
        <div className="mt-3 divide-y divide-border/50">
          <ToggleRow
            label="Outfit suggestions"
            desc="Get notified for new outfit ideas"
            value={notifOutfits}
            onChange={(v) => {
              setNotifOutfits(v);
              savePreferences({ notif_outfits: v });
            }}
          />
          <ToggleRow
            label="Gap recommendations"
            desc="Alerts for wardrobe gaps"
            value={notifGaps}
            onChange={(v) => {
              setNotifGaps(v);
              savePreferences({ notif_gaps: v });
            }}
          />
        </div>
      </motion.div>

      {/* ── Personalization ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mt-4 rounded-2xl bg-card p-5"
      >
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-display font-semibold text-foreground">
            Privacy
          </h3>
        </div>
        <div className="mt-3">
          <ToggleRow
            label="Personalization"
            desc="Allow AI to learn your style"
            value={personalization}
            onChange={(v) => {
              setPersonalization(v);
              savePreferences({ personalization: v });
            }}
          />
        </div>
      </motion.div>

      {/* ── Change Password ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-4 rounded-2xl bg-card p-5"
      >
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-display font-semibold text-foreground">
            Account Security
          </h3>
        </div>

        {!showPasswordForm ? (
          <button
            onClick={() => setShowPasswordForm(true)}
            className="mt-3 flex w-full items-center justify-between rounded-xl bg-background px-4 py-3 text-sm font-body font-medium text-foreground transition-colors hover:bg-background/80"
          >
            Change Password
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ) : (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 space-y-3"
            >
              {/* New Password */}
              <div>
                <label className="text-xs font-body text-muted-foreground">
                  New Password
                </label>
                <div className="relative mt-1">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 pr-10 text-sm font-body text-foreground outline-none focus:ring-2 focus:ring-ai/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showNew ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="text-xs font-body text-muted-foreground">
                  Confirm Password
                </label>
                <div className="relative mt-1">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 pr-10 text-sm font-body text-foreground outline-none focus:ring-2 focus:ring-ai/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showConfirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {passwordError && (
                <p className="text-xs font-body text-destructive">
                  {passwordError}
                </p>
              )}

              {passwordSuccess && (
                <div className="flex items-center gap-1.5 text-xs font-body text-green-600 dark:text-green-400">
                  <Check className="h-3.5 w-3.5" />
                  Password updated successfully
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowPasswordForm(false);
                    setNewPassword("");
                    setConfirmPassword("");
                    setPasswordError("");
                  }}
                  className="flex-1 rounded-xl bg-background py-2.5 text-xs font-body font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={changingPassword || !newPassword || !confirmPassword}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-ai py-2.5 text-xs font-body font-medium text-white transition-opacity disabled:opacity-40"
                >
                  {changingPassword ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Update Password
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </motion.div>

      {/* ── Danger zone ── */}
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        onClick={handleDeleteAllData}
        className="mt-4 flex w-full items-center justify-between rounded-2xl bg-card p-5 text-destructive transition-colors hover:bg-destructive/5"
      >
        <div className="flex items-center gap-2">
          <Trash2 className="h-4 w-4" />
          <span className="text-sm font-body font-medium">Delete All Data</span>
        </div>
        <ChevronRight className="h-4 w-4" />
      </motion.button>

      {/* ── Sign Out ── */}
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        onClick={handleSignOut}
        className="mt-3 mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-card p-4 text-muted-foreground transition-colors hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        <span className="text-sm font-body font-medium">Sign Out</span>
      </motion.button>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Toggle row helper                                                  */
/* ------------------------------------------------------------------ */
const ToggleRow = ({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) => (
  <div className="flex items-center justify-between gap-4 py-2">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-body font-medium text-foreground">{label}</p>
      <p className="text-xs font-body text-muted-foreground">{desc}</p>
    </div>
    <button
      onClick={() => onChange(!value)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
        value ? "bg-ai" : "bg-border"
      }`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
          value ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  </div>
);

export default Settings;
