import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { User, Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";

interface StoredUser {
  name: string;
  email: string;
  password: string;
}

function getUsers(): StoredUser[] {
  try {
    return JSON.parse(localStorage.getItem("sv_users") || "[]");
  } catch {
    return [];
  }
}

function saveUsers(users: StoredUser[]) {
  localStorage.setItem("sv_users", JSON.stringify(users));
}

const ProfileSetup = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = () => {
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

    const users = getUsers();

    if (mode === "signup") {
      const trimName = name.trim();
      if (!trimName) {
        setError("Please enter your name");
        return;
      }
      if (users.find((u) => u.email === trimEmail)) {
        setError("An account with this email already exists. Please log in.");
        return;
      }
      users.push({ name: trimName, email: trimEmail, password: trimPassword });
      saveUsers(users);
      localStorage.setItem("sv_user_name", trimName);
      localStorage.setItem("sv_user_email", trimEmail);
      navigate("/home");
    } else {
      const user = users.find(
        (u) => u.email === trimEmail && u.password === trimPassword
      );
      if (!user) {
        setError("Invalid email or password");
        return;
      }
      localStorage.setItem("sv_user_name", user.name);
      localStorage.setItem("sv_user_email", user.email);
      navigate("/home");
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center px-5 py-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md space-y-7"
      >
        <div className="text-center space-y-2">
          <div
            className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold"
            style={{
              background: "linear-gradient(135deg, hsl(38,90%,50%), hsl(350,80%,58%))",
            }}
          >
            V
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="text-sm text-gray-500">
            {mode === "signup"
              ? "Sign up to get your personalised style"
              : "Log in to continue your style journey"}
          </p>
        </div>

        <div className="space-y-4">
          {mode === "signup" && (
            <div className="relative">
              <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400/60 transition"
              />
            </div>
          )}

          <div className="relative">
            <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400/60 transition"
            />
          </div>

          <div className="relative">
            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-11 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400/60 transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500 text-center -mt-2">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          className="w-full py-3.5 rounded-xl text-white font-semibold flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform"
          style={{
            background: "linear-gradient(135deg, hsl(38,90%,50%), hsl(350,80%,58%))",
          }}
        >
          {mode === "signup" ? "Create Account" : "Log In"}
          <ArrowRight size={18} />
        </button>

        <p className="text-center text-sm text-gray-500">
          {mode === "signup" ? (
            <>
              Already have an account?{" "}
              <button
                onClick={() => { setMode("login"); setError(""); }}
                className="font-semibold text-amber-600 hover:underline"
              >
                Log in
              </button>
            </>
          ) : (
            <>
              Don&apos;t have an account?{" "}
              <button
                onClick={() => { setMode("signup"); setError(""); }}
                className="font-semibold text-amber-600 hover:underline"
              >
                Sign up
              </button>
            </>
          )}
        </p>

        <p className="text-center text-xs text-gray-400">
          By continuing you agree to our Terms &amp; Privacy Policy
        </p>
      </motion.div>
    </div>
  );
};

export default ProfileSetup;
