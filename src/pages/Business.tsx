import { useState, useRef, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import {
  Sparkles, ShirtIcon, Eye, Brain, Users, Store, Crown, Gem,
  BarChart3, TrendingUp, RotateCcw, Heart, Layers, Shield, Zap,
  Play, Send, CheckCircle2, ArrowRight, ChevronDown, Menu, X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

/* ------------------------------------------------------------------ */
/*  Animated section wrapper                                           */
/* ------------------------------------------------------------------ */
const Section = ({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.section
      ref={ref}
      id={id}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.section>
  );
};

/* ------------------------------------------------------------------ */
/*  Feature card with glassmorphism                                    */
/* ------------------------------------------------------------------ */
const GlassCard = ({
  icon: Icon,
  title,
  description,
  accent = "from-violet-500 to-amber-400",
}: {
  icon: any;
  title: string;
  description: string;
  accent?: string;
}) => (
  <div className="group relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 transition-all duration-500 hover:border-white/20 hover:bg-white/[0.08] hover:shadow-2xl hover:shadow-violet-500/5">
    <div
      className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${accent} shadow-lg`}
    >
      <Icon className="h-6 w-6 text-white" />
    </div>
    <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
    <p className="text-sm leading-relaxed text-white/60">{description}</p>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Metric card                                                        */
/* ------------------------------------------------------------------ */
const MetricCard = ({
  icon: Icon,
  title,
  description,
  track,
}: {
  icon: any;
  title: string;
  description: string;
  track: string;
}) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 hover:border-violet-500/30 transition-all duration-500">
    <Icon className="h-8 w-8 text-violet-400 mb-4" />
    <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
    <p className="text-sm text-white/60 mb-3">{description}</p>
    <p className="text-xs font-medium text-amber-400/80">Track: {track}</p>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Main Business Page                                                 */
/* ------------------------------------------------------------------ */
const Business = () => {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    message: "",
  });
  const [formStatus, setFormStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");

  // Smooth scroll to section
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileMenu(false);
  };

  // Form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.company) return;
    setFormStatus("sending");
    try {
      const { error } = await supabase.from("demo_requests").insert({
        name: formData.name,
        email: formData.email,
        company: formData.company,
        message: formData.message,
      });
      if (error) throw error;
      setFormStatus("success");
      setFormData({ name: "", email: "", company: "", message: "" });
    } catch (err) {
      console.error("Form submission error:", err);
      setFormStatus("error");
    }
    setTimeout(() => setFormStatus("idle"), 4000);
  };

  const navItems = [
    { label: "Problem", id: "problem" },
    { label: "Product", id: "product" },
    { label: "Features", id: "features" },
    { label: "Outcomes", id: "outcomes" },
    { label: "Demo", id: "demo" },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-white overflow-x-hidden">
      {/* ========== NAVBAR ========== */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-amber-400 flex items-center justify-center text-white font-bold text-sm">
              S
            </div>
            <span className="text-lg font-bold tracking-tight">StyleOS</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="text-sm text-white/50 hover:text-white transition-colors"
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => scrollTo("contact")}
              className="rounded-full bg-gradient-to-r from-violet-600 to-violet-500 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 transition-all"
            >
              Book a Demo
            </button>
          </div>
          <button
            className="md:hidden text-white/70"
            onClick={() => setMobileMenu(!mobileMenu)}
          >
            {mobileMenu ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {/* Mobile menu */}
        {mobileMenu && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden border-t border-white/5 bg-[#09090b]/95 backdrop-blur-2xl px-6 py-4 space-y-3"
          >
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="block w-full text-left text-sm text-white/60 hover:text-white py-2"
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => scrollTo("contact")}
              className="w-full rounded-full bg-violet-600 px-5 py-2.5 text-sm font-medium text-white mt-2"
            >
              Book a Demo
            </button>
          </motion.div>
        )}
      </nav>

      {/* ========== HERO ========== */}
      <section className="relative pt-32 pb-24 md:pt-44 md:pb-36 px-6 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-violet-600/10 blur-[120px]" />
          <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] rounded-full bg-amber-500/8 blur-[100px]" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-1.5 text-xs font-medium text-violet-300"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI-Powered Wardrobe Intelligence for Brands
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]"
          >
            Your Customers' Wardrobe,{" "}
            <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-amber-400 bg-clip-text text-transparent">
              Reimagined with AI
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-6 text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed"
          >
            StyleOS is an AI wardrobe layer that helps brands connect each
            customer's closet with personalized styling and commerce
            recommendations — turning wardrobe context into a personalization
            engine.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button
              onClick={() => scrollTo("contact")}
              className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-violet-500 px-8 py-3.5 text-sm font-semibold text-white shadow-xl shadow-violet-500/20 hover:shadow-violet-500/40 transition-all"
            >
              Book a Demo
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => scrollTo("demo")}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-8 py-3.5 text-sm font-medium text-white/80 hover:bg-white/10 transition-all"
            >
              <Play className="h-4 w-4" />
              Watch Demo
            </button>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="mt-20 flex justify-center"
          >
            <ChevronDown className="h-5 w-5 text-white/20 animate-bounce" />
          </motion.div>
        </div>
      </section>

      {/* ========== PROBLEM ========== */}
      <Section id="problem" className="py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-400 mb-3">
              The Problem
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Fashion Commerce Is Flying Blind
            </h2>
            <p className="mt-4 text-white/50 max-w-2xl mx-auto">
              Brands recommend products without knowing what customers already
              own. Discovery, confidence, and repeat purchases break down.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                num: "01",
                title: "Full Closets, Low Visibility",
                desc: "Customers own enough clothing but still struggle to see what works together or what is missing. The result is decision fatigue.",
                color: "from-red-500 to-orange-500",
              },
              {
                num: "02",
                title: "Recommendations Lack Context",
                desc: "Most retail journeys recommend products without knowing what the customer already owns. Generic discovery fails.",
                color: "from-amber-500 to-yellow-500",
              },
              {
                num: "03",
                title: "Buying Confidence Drops",
                desc: "When customers can't picture fit, styling, or wardrobe compatibility, they hesitate or return items later.",
                color: "from-violet-500 to-purple-500",
              },
            ].map((item) => (
              <div
                key={item.num}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] p-8 hover:border-white/20 transition-all duration-500"
              >
                <span
                  className={`inline-block text-xs font-bold bg-gradient-to-r ${item.color} bg-clip-text text-transparent mb-4`}
                >
                  {item.num}
                </span>
                <h3 className="text-xl font-semibold text-white mb-3">
                  {item.title}
                </h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/5 px-6 py-2.5 text-sm text-violet-300">
              <Sparkles className="h-4 w-4" />
              Opportunity: turn wardrobe context into a personalization layer
              brands can use before checkout
            </p>
          </div>
        </div>
      </Section>

      {/* ========== WHAT IS STYLEOS ========== */}
      <Section id="product" className="py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-3">
              The Product
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              What is StyleOS?
            </h2>
            <p className="mt-4 text-white/50 max-w-2xl mx-auto">
              An AI wardrobe layer that helps brands connect each customer's
              closet with personalized styling and commerce recommendations.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <GlassCard
              icon={ShirtIcon}
              title="Digital Closet"
              description="Customers digitize clothing and past purchases into a searchable wardrobe database that improves with every interaction."
              accent="from-blue-500 to-cyan-400"
            />
            <GlassCard
              icon={Brain}
              title="AI Styling Engine"
              description="Context-aware outfit suggestions based on occasion, preference, weather, and wardrobe contents — getting smarter over time."
              accent="from-violet-500 to-purple-400"
            />
            <GlassCard
              icon={Eye}
              title="Virtual Try-On"
              description="Customers see how new catalog pieces work with what they already own before making a purchase decision."
              accent="from-amber-500 to-orange-400"
            />
          </div>

          <div className="mt-12 text-center">
            <p className="text-sm text-white/40">
              Customer Wardrobe + Brand Catalog + AI Styling ={" "}
              <span className="text-white font-medium">
                Better Purchase Confidence
              </span>
            </p>
          </div>
        </div>
      </Section>

      {/* ========== WHO IT'S FOR ========== */}
      <Section className="py-24 px-6 relative">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-violet-600/5 blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-400 mb-3">
              Who It's For
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Built for Every Fashion Business
            </h2>
            <p className="mt-4 text-white/50 max-w-2xl mx-auto">
              StyleOS supports brands with different positioning, customer
              journeys, and commerce models using the same wardrobe intelligence
              layer.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Store,
                title: "D2C & E-Commerce",
                desc: "Help shoppers understand how new arrivals work with what they already own.",
              },
              {
                icon: Users,
                title: "Fashion Brands",
                desc: "Embed a digital closet inside your app or website to deepen engagement.",
              },
              {
                icon: Layers,
                title: "Marketplaces",
                desc: "Differentiate with a utility customers use beyond transactional moments.",
              },
              {
                icon: Crown,
                title: "Premium & Luxury",
                desc: "Offer a high-touch digital styling experience that strengthens brand loyalty.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center hover:border-violet-500/20 transition-all duration-500"
              >
                <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center">
                  <item.icon className="h-6 w-6 text-violet-400" />
                </div>
                <h3 className="font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-white/50">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ========== FEATURES DEEP DIVE ========== */}
      <Section id="features" className="py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-3">
              Capabilities
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Powerful Features, Seamless Experience
            </h2>
          </div>

          {/* Smart Wardrobe */}
          <div className="mb-20">
            <h3 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
              <ShirtIcon className="h-5 w-5 text-blue-400" />
              Smart Wardrobe Management
            </h3>
            <p className="text-white/50 mb-8 max-w-xl">
              Every closet becomes a searchable, living wardrobe database that
              improves with each item, purchase, and interaction.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  title: "Capture & Classify",
                  desc: "Upload clothing photos and let AI organize items by category, color, season, and occasion.",
                },
                {
                  title: "Search & Filter",
                  desc: "Browse the wardrobe visually with attributes, tags, filters, and voice-enabled search.",
                },
                {
                  title: "Import Purchases",
                  desc: "Past orders can populate the closet and keep it current through partner integrations.",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl border border-white/5 bg-white/[0.02] p-5"
                >
                  <h4 className="font-medium text-white mb-1">{f.title}</h4>
                  <p className="text-sm text-white/40">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* AI Styling */}
          <div className="mb-20">
            <h3 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
              <Brain className="h-5 w-5 text-violet-400" />
              AI-Powered Styling Engine
            </h3>
            <p className="text-white/50 mb-8 max-w-xl">
              The intelligence layer adapts to context, preference, and routine
              — making outfit guidance more useful with every interaction.
            </p>
            <div className="grid gap-4 md:grid-cols-4">
              {[
                {
                  title: "Context-Aware Styling",
                  desc: "Shaped by occasion, weather, calendar, and wardrobe availability.",
                },
                {
                  title: "Mix & Match Engine",
                  desc: "Finds combinations customers may not think to pair on their own.",
                },
                {
                  title: "Preference Signals",
                  desc: "Saved looks and interactions improve recommendations over time.",
                },
                {
                  title: "Complete Outfits",
                  desc: "One tap delivers a full look for work, dates, weekends, and more.",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl border border-white/5 bg-white/[0.02] p-5"
                >
                  <h4 className="font-medium text-white mb-1">{f.title}</h4>
                  <p className="text-sm text-white/40">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* VTO */}
          <div>
            <h3 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
              <Eye className="h-5 w-5 text-amber-400" />
              Virtual Try-On
            </h3>
            <p className="text-white/50 mb-8 max-w-xl">
              Let customers evaluate new products in the context of what they
              already own before they buy.
            </p>
            <div className="grid gap-4 md:grid-cols-4">
              {[
                {
                  title: "Wardrobe Context",
                  desc: "Pair new catalog items with owned pieces so recommendations feel personal.",
                },
                {
                  title: "AI Visual Preview",
                  desc: "Generate outfit previews that reduce the need to imagine the result.",
                },
                {
                  title: "Checkout Confidence",
                  desc: "Help customers decide faster when fit and compatibility are clear.",
                },
                {
                  title: "Fast Brand Activation",
                  desc: "Works with quality product imagery and lightweight integration paths.",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl border border-white/5 bg-white/[0.02] p-5"
                >
                  <h4 className="font-medium text-white mb-1">{f.title}</h4>
                  <p className="text-sm text-white/40">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ========== DEMO VIDEO ========== */}
      <Section id="demo" className="py-24 px-6 relative">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />
        </div>
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-400 mb-3">
            See It in Action
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            StyleOS Demo Walkthrough
          </h2>
          <p className="text-white/50 mb-10 max-w-xl mx-auto">
            Watch the product flow from digital closet to AI styling and virtual
            try-on.
          </p>
          <div className="aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-violet-500/10">
            <iframe
              className="w-full h-full"
              src="https://www.youtube.com/embed/SE2tzr37PwU"
              title="StyleOS Demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      </Section>

      {/* ========== BUSINESS OUTCOMES ========== */}
      <Section id="outcomes" className="py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-3">
              Business Impact
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Outcomes That Matter
            </h2>
            <p className="mt-4 text-white/50 max-w-2xl mx-auto">
              StyleOS connects wardrobe utility to measurable outcomes across
              engagement, conversion, returns, and customer lifetime value.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              icon={TrendingUp}
              title="Repeat Engagement"
              description="Turn the closet into a daily utility that brings customers back between purchases."
              track="Repeat visits, outfits generated"
            />
            <MetricCard
              icon={BarChart3}
              title="Conversion Confidence"
              description="Show products in the context of what customers already own before checkout."
              track="Recommendation CTR, try-on to cart"
            />
            <MetricCard
              icon={RotateCcw}
              title="Lower Return Exposure"
              description="Reduce style uncertainty by helping customers choose pieces that fit their wardrobe."
              track="Return rate, fit/style reasons"
            />
            <MetricCard
              icon={Heart}
              title="LTV Growth"
              description="Surface wardrobe gaps and complete-the-look moments that drive repeat purchases."
              track="AOV, repeat purchase rate"
            />
          </div>
        </div>
      </Section>

      {/* ========== INTEGRATION ========== */}
      <Section className="py-24 px-6 relative">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 right-0 w-[500px] h-[500px] rounded-full bg-amber-500/5 blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-400 mb-3">
              Integration
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Integration-Ready Architecture
            </h2>
            <p className="mt-4 text-white/50 max-w-2xl mx-auto">
              Designed to fit into existing commerce journeys without replacing
              core systems.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Zap,
                title: "Deployment Options",
                desc: "Standalone PWA, embedded web module, Android APK, or brand-app integration path.",
              },
              {
                icon: Layers,
                title: "Data Inputs",
                desc: "Connect product catalog, SKU metadata, product images, and order history.",
              },
              {
                icon: Shield,
                title: "Privacy & Controls",
                desc: "Consent-led wardrobe data usage with secure storage and clear user control.",
              },
              {
                icon: Gem,
                title: "Pilot Setup",
                desc: "Start with a limited catalog, defined user group, and measurable goals.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:border-violet-500/20 transition-all duration-500"
              >
                <item.icon className="h-6 w-6 text-violet-400 mb-4" />
                <h3 className="font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-white/50">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <p className="text-sm text-white/40">
              No rip and replace — begin with a scoped pilot, then expand
              modules as value is proven.
            </p>
          </div>
        </div>
      </Section>

      {/* ========== CONTACT FORM ========== */}
      <Section id="contact" className="py-24 px-6 relative">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-violet-600/10 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-2xl">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-3">
              Get Started
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Let's Build the Future of Fashion Together
            </h2>
            <p className="mt-4 text-white/50">
              Tell us about your brand and we'll set up a personalized demo.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 space-y-5"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">
                  Your Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">
                  Work Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
                  placeholder="jane@brand.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">
                Company / Brand *
              </label>
              <input
                type="text"
                required
                value={formData.company}
                onChange={(e) =>
                  setFormData({ ...formData, company: e.target.value })
                }
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
                placeholder="Your brand name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">
                Message (optional)
              </label>
              <textarea
                rows={3}
                value={formData.message}
                onChange={(e) =>
                  setFormData({ ...formData, message: e.target.value })
                }
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all resize-none"
                placeholder="Tell us about your use case or what you'd like to explore..."
              />
            </div>

            <button
              type="submit"
              disabled={formStatus === "sending" || formStatus === "success"}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 disabled:opacity-60 transition-all"
            >
              {formStatus === "sending" ? (
                "Sending..."
              ) : formStatus === "success" ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  We'll be in touch!
                </>
              ) : formStatus === "error" ? (
                "Something went wrong — try again"
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Book a Demo
                </>
              )}
            </button>
          </form>
        </div>
      </Section>

      {/* ========== FOOTER ========== */}
      <footer className="border-t border-white/5 py-10 px-6">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-amber-400 flex items-center justify-center text-white font-bold text-xs">
              S
            </div>
            <span className="text-sm font-semibold">StyleOS</span>
            <span className="text-xs text-white/30">by Impetus / Fynd</span>
          </div>
          <p className="text-xs text-white/30">
            Proprietary & Confidential &copy; {new Date().getFullYear()} Fynd
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Business;
