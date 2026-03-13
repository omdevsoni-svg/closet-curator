import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sparkles,
  Camera,
  HeartPulse,
  ShoppingBag,
  Shirt,
  Zap,
  Star,
  ArrowRight,
  ChevronRight,
  Check,
  Instagram,
  Twitter,
  Github,
} from "lucide-react";
import Logo from "@/components/Logo";
import AuthModal from "@/components/AuthModal";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.6, ease: "easeOut" },
};

const staggerContainer = {
  whileInView: { transition: { staggerChildren: 0.1 } },
  viewport: { once: true },
};

const Landing = () => {
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");

  const openAuth = (mode: "login" | "signup") => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  const handleAuthSuccess = () => {
    setAuthOpen(false);
    navigate("/closet");
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* ─── Navbar ─── */}
      <nav className="fixed top-0 z-40 w-full border-b border-white/10 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <Logo className="h-8 w-8" />
            <span className="text-lg font-display font-bold tracking-tight text-foreground">
              StyleVault
            </span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm font-body font-medium text-muted-foreground transition-colors hover:text-foreground">Features</a>
            <a href="#how-it-works" className="text-sm font-body font-medium text-muted-foreground transition-colors hover:text-foreground">How It Works</a>
            <a href="#pricing" className="text-sm font-body font-medium text-muted-foreground transition-colors hover:text-foreground">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => openAuth("login")}
              className="text-sm font-body font-medium text-foreground transition-colors hover:text-accent"
            >
              Log In
            </button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => openAuth("signup")}
              className="rounded-xl bg-gradient-to-r from-[hsl(263,70%,66%)] to-[hsl(280,80%,75%)] px-5 py-2.5 text-sm font-display font-semibold text-white shadow-lg shadow-accent/20 transition-all hover:shadow-xl hover:shadow-accent/30"
            >
              Get Started
            </motion.button>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32">
        {/* Background gradient orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-32 top-20 h-[500px] w-[500px] rounded-full bg-accent/10 blur-[120px]" />
          <div className="absolute -right-32 top-40 h-[400px] w-[400px] rounded-full bg-[hsl(280,80%,75%)]/10 blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-5">
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="mx-auto max-w-3xl text-center"
          >
            <div className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-4 py-1.5 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <span className="text-xs font-body font-medium text-accent">AI-Powered Wardrobe Management</span>
            </div>

            <h1 className="text-4xl font-display font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
              Your Closet,{" "}
              <span className="text-gradient-ai">Reimagined</span>
              {" "}by AI
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground font-body sm:text-lg">
              Upload your wardrobe, get AI-styled outfits for every occasion, and discover the gaps holding your style back.
            </p>

            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => openAuth("signup")}
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[hsl(263,70%,66%)] to-[hsl(280,80%,75%)] px-8 py-4 text-base font-display font-semibold text-white shadow-xl shadow-accent/25 transition-all hover:shadow-2xl hover:shadow-accent/30"
              >
                Start For Free
                <ArrowRight className="h-4 w-4" />
              </motion.button>
              <button
                onClick={() => {
                  const el = document.getElementById("how-it-works");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="flex items-center gap-2 rounded-2xl border border-black/10 bg-white/50 px-8 py-4 text-base font-display font-medium text-foreground backdrop-blur-sm transition-all hover:bg-white/70"
              >
                See How It Works
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>

          {/* Hero mockup - glassmorphism card */}
          <motion.div
            initial={{ opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mx-auto mt-16 max-w-4xl"
          >
            <div className="overflow-hidden rounded-3xl border border-white/20 bg-white/40 p-2 shadow-2xl backdrop-blur-xl">
              <div className="rounded-2xl bg-gradient-to-br from-background to-card p-6 sm:p-10">
                <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
                  {[
                    { name: "Blazer", color: "bg-blue-900/10", emoji: "🧥" },
                    { name: "T-Shirt", color: "bg-gray-100", emoji: "👕" },
                    { name: "Jeans", color: "bg-indigo-100", emoji: "👖" },
                    { name: "Sneakers", color: "bg-orange-100", emoji: "👟" },
                    { name: "Dress", color: "bg-pink-100", emoji: "👗" },
                    { name: "Watch", color: "bg-amber-100", emoji: "⌚" },
                  ].map((item, i) => (
                    <motion.div
                      key={item.name}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 + i * 0.08 }}
                      className={`flex aspect-square flex-col items-center justify-center rounded-2xl ${item.color} border border-white/30 backdrop-blur-sm`}
                    >
                      <span className="text-3xl sm:text-4xl">{item.emoji}</span>
                      <span className="mt-1 text-[10px] font-body font-medium text-muted-foreground">{item.name}</span>
                    </motion.div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-accent/5 p-3 border border-accent/10">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <span className="text-sm font-body font-medium text-accent">AI suggests: Blazer + T-Shirt + Jeans for your meeting</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-body font-semibold uppercase tracking-widest text-accent">Features</span>
            <h2 className="mt-3 text-3xl font-display font-bold tracking-tight text-foreground sm:text-4xl">
              Everything your wardrobe needs
            </h2>
            <p className="mt-3 text-base text-muted-foreground font-body">
              Powerful AI tools to digitize, style, and optimize your closet.
            </p>
          </motion.div>

          <motion.div {...staggerContainer} className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Camera,
                title: "Smart Upload",
                description: "Snap a photo and AI removes backgrounds, categorizes items, and detects colors automatically.",
                gradient: "from-purple-500/10 to-purple-600/5",
                iconColor: "text-purple-500",
              },
              {
                icon: Sparkles,
                title: "AI Stylist",
                description: "Get personalized outfit recommendations for any occasion — date night, office, weekend, or party.",
                gradient: "from-blue-500/10 to-blue-600/5",
                iconColor: "text-blue-500",
              },
              {
                icon: HeartPulse,
                title: "Closet Health",
                description: "AI analyzes your wardrobe for versatility gaps, color balance, and occasion coverage scores.",
                gradient: "from-rose-500/10 to-rose-600/5",
                iconColor: "text-rose-500",
              },
              {
                icon: ShoppingBag,
                title: "Smart Shopping",
                description: "Get recommendations for pieces that fill your wardrobe gaps — only buy what you actually need.",
                gradient: "from-amber-500/10 to-amber-600/5",
                iconColor: "text-amber-600",
              },
              {
                icon: Shirt,
                title: "Digital Closet",
                description: "Browse your entire wardrobe from your phone. Filter by category, season, or color palette.",
                gradient: "from-emerald-500/10 to-emerald-600/5",
                iconColor: "text-emerald-500",
              },
              {
                icon: Zap,
                title: "Outfit History",
                description: "Track what you wear and when. Never repeat an outfit at the same event again.",
                gradient: "from-orange-500/10 to-orange-600/5",
                iconColor: "text-orange-500",
              },
            ].map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                  className="group relative overflow-hidden rounded-3xl border border-white/20 bg-white/50 p-7 backdrop-blur-sm transition-all hover:bg-white/70 hover:shadow-xl hover:shadow-black/5"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 transition-opacity group-hover:opacity-100`} />
                  <div className="relative">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.gradient} ${feature.iconColor}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 text-lg font-display font-semibold text-foreground">{feature.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground font-body leading-relaxed">{feature.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="relative py-20 md:py-28">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-accent/5 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-5">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-body font-semibold uppercase tracking-widest text-accent">How It Works</span>
            <h2 className="mt-3 text-3xl font-display font-bold tracking-tight text-foreground sm:text-4xl">
              Three steps to a smarter closet
            </h2>
          </motion.div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Upload Your Clothes",
                description: "Take photos of your clothing items. Our AI instantly removes backgrounds and categorizes each piece.",
                emoji: "📸",
              },
              {
                step: "02",
                title: "Get Styled by AI",
                description: "Tell us the occasion and our AI creates the perfect outfit from your existing wardrobe.",
                emoji: "✨",
              },
              {
                step: "03",
                title: "Optimize & Shop Smart",
                description: "See your wardrobe health score and get recommendations to fill gaps — only buy what you need.",
                emoji: "🎯",
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="relative text-center"
              >
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-white/20 bg-white/60 text-4xl shadow-lg backdrop-blur-xl">
                  {item.emoji}
                </div>
                <span className="mt-4 block text-xs font-body font-bold uppercase tracking-widest text-accent">
                  Step {item.step}
                </span>
                <h3 className="mt-2 text-xl font-display font-bold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground font-body leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-body font-semibold uppercase tracking-widest text-accent">Testimonials</span>
            <h2 className="mt-3 text-3xl font-display font-bold tracking-tight text-foreground sm:text-4xl">
              Loved by style enthusiasts
            </h2>
          </motion.div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                name: "Priya Sharma",
                role: "Fashion Blogger",
                text: "StyleVault completely changed how I plan outfits. The AI recommendations are surprisingly spot-on for Indian occasions.",
                rating: 5,
              },
              {
                name: "Arjun Mehta",
                role: "Software Engineer",
                text: "I never thought I'd enjoy organizing my clothes. The closet health feature showed me I was buying too many similar shirts!",
                rating: 5,
              },
              {
                name: "Sneha Patel",
                role: "Marketing Manager",
                text: "Perfect for someone who wants to look put-together without spending 30 minutes deciding what to wear every morning.",
                rating: 5,
              },
            ].map((testimonial, i) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="rounded-3xl border border-white/20 bg-white/50 p-7 backdrop-blur-sm"
              >
                <div className="flex gap-1">
                  {Array.from({ length: testimonial.rating }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="mt-4 text-sm text-foreground font-body leading-relaxed">
                  "{testimonial.text}"
                </p>
                <div className="mt-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent to-[hsl(280,80%,75%)] text-sm font-display font-bold text-white">
                    {testimonial.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-display font-semibold text-foreground">{testimonial.name}</p>
                    <p className="text-xs text-muted-foreground font-body">{testimonial.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" className="relative py-20 md:py-28">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute right-0 top-1/4 h-[500px] w-[500px] rounded-full bg-accent/5 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-5">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-body font-semibold uppercase tracking-widest text-accent">Pricing</span>
            <h2 className="mt-3 text-3xl font-display font-bold tracking-tight text-foreground sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-3 text-base text-muted-foreground font-body">
              Start free. Upgrade when you're ready.
            </p>
          </motion.div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              {
                name: "Free",
                price: "₹0",
                period: "forever",
                description: "Perfect for getting started",
                features: ["Upload up to 20 items", "Basic AI styling", "Closet health score", "1 occasion preset"],
                cta: "Get Started",
                highlight: false,
              },
              {
                name: "Pro",
                price: "₹299",
                period: "/month",
                description: "For the style-conscious",
                features: ["Unlimited items", "Advanced AI styling", "Full closet analytics", "All occasion presets", "Shopping recommendations", "Outfit history"],
                cta: "Start Free Trial",
                highlight: true,
              },
              {
                name: "Premium",
                price: "₹599",
                period: "/month",
                description: "For fashion enthusiasts",
                features: ["Everything in Pro", "Personal style coach AI", "Trend predictions", "Seasonal wardrobe planning", "Priority support", "Early access to features"],
                cta: "Start Free Trial",
                highlight: false,
              },
            ].map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                className={`relative overflow-hidden rounded-3xl border p-8 transition-all ${
                  plan.highlight
                    ? "border-accent/30 bg-white/70 shadow-2xl shadow-accent/10 backdrop-blur-xl"
                    : "border-white/20 bg-white/50 backdrop-blur-sm hover:bg-white/60"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -right-8 top-6 rotate-45 bg-gradient-to-r from-[hsl(263,70%,66%)] to-[hsl(280,80%,75%)] px-10 py-1 text-[10px] font-display font-bold uppercase text-white">
                    Popular
                  </div>
                )}
                <h3 className="text-lg font-display font-bold text-foreground">{plan.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground font-body">{plan.description}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-display font-extrabold text-foreground">{plan.price}</span>
                  <span className="text-sm text-muted-foreground font-body">{plan.period}</span>
                </div>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm font-body text-foreground">
                      <Check className="h-4 w-4 shrink-0 text-accent" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => openAuth("signup")}
                  className={`mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-display font-semibold transition-all ${
                    plan.highlight
                      ? "bg-gradient-to-r from-[hsl(263,70%,66%)] to-[hsl(280,80%,75%)] text-white shadow-lg shadow-accent/20 hover:shadow-xl"
                      : "border border-black/10 bg-white/60 text-foreground hover:bg-white/80"
                  }`}
                >
                  {plan.cta}
                  <ArrowRight className="h-4 w-4" />
                </motion.button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Banner ─── */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-5">
          <motion.div
            {...fadeUp}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[hsl(263,70%,66%)] to-[hsl(280,80%,75%)] p-10 text-center sm:p-16"
          >
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -left-20 -top-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute -bottom-20 -right-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
            </div>
            <div className="relative">
              <h2 className="text-3xl font-display font-bold text-white sm:text-4xl">
                Ready to transform your wardrobe?
              </h2>
              <p className="mx-auto mt-3 max-w-md text-base text-white/80 font-body">
                Join thousands of style-savvy users who let AI handle their outfit decisions.
              </p>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => openAuth("signup")}
                className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-base font-display font-semibold text-foreground shadow-xl transition-all hover:shadow-2xl"
              >
                Get Started for Free
                <ArrowRight className="h-4 w-4" />
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border py-12">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2">
                <Logo className="h-7 w-7" />
                <span className="text-base font-display font-bold text-foreground">StyleVault</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground font-body leading-relaxed">
                Your AI-powered digital wardrobe manager. Dress smarter, shop less, style more.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-display font-semibold text-foreground">Product</h4>
              <ul className="mt-3 space-y-2">
                {["Features", "Pricing", "How It Works", "FAQ"].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm font-body text-muted-foreground transition-colors hover:text-foreground">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-display font-semibold text-foreground">Company</h4>
              <ul className="mt-3 space-y-2">
                {["About", "Blog", "Careers", "Contact"].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm font-body text-muted-foreground transition-colors hover:text-foreground">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-display font-semibold text-foreground">Legal</h4>
              <ul className="mt-3 space-y-2">
                {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm font-body text-muted-foreground transition-colors hover:text-foreground">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
            <p className="text-xs text-muted-foreground font-body">
              &copy; {new Date().getFullYear()} StyleVault. All rights reserved.
            </p>
            <div className="flex gap-4">
              <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                <Twitter className="h-4 w-4" />
              </a>
              <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                <Github className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        initialMode={authMode}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
};

export default Landing;
