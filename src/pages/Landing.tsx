import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Camera, HeartPulse, ShoppingBag, Shirt, Zap,
  Star, ArrowRight, ChevronRight, Instagram, Twitter, Github,
  Menu, X,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      {/* âââ Navbar âââ */}
      <nav className="fixed top-0 z-40 w-full border-b border-white/10 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-14 sm:h-16 max-w-6xl items-center justify-between px-4 sm:px-5">
          <div className="flex items-center gap-2">
            <Logo className="h-7 w-7 sm:h-8 sm:w-8" />
            <span className="text-base sm:text-lg font-display font-bold tracking-tight text-foreground">
              Vastrika AI
            </span>
          </div>

          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm font-body font-medium text-muted-foreground transition-colors hover:text-foreground">Features</a>
            <a href="#how-it-works" className="text-sm font-body font-medium text-muted-foreground transition-colors hover:text-foreground">How It Works</a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => openAuth("login")}
              className="hidden sm:inline-flex text-sm font-body font-medium text-foreground transition-colors hover:text-accent"
            >
              Log In
            </button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => openAuth("signup")}
              className="rounded-xl bg-gradient-to-r from-[hsl(35,80%,50%)] to-[hsl(350,70%,45%)] px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-display font-semibold text-white shadow-lg shadow-accent/20 transition-all hover:shadow-xl hover:shadow-accent/30"
            >
              Get Started
            </motion.button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="ml-1 flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/50 backdrop-blur-sm md:hidden"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-white/10 bg-background/80 backdrop-blur-xl md:hidden"
            >
              <div className="flex flex-col gap-1 px-4 py-3">
                <a href="#features" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-body font-medium text-muted-foreground transition-colors hover:bg-white/50 hover:text-foreground">
                  Features
                </a>
                <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-body font-medium text-muted-foreground transition-colors hover:bg-white/50 hover:text-foreground">
                  How It Works
                </a>
                <button
                  onClick={() => { setMobileMenuOpen(false); openAuth("login"); }}
                  className="rounded-xl px-3 py-2.5 text-left text-sm font-body font-medium text-muted-foreground transition-colors hover:bg-white/50 hover:text-foreground sm:hidden"
                >
                  Log In
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* âââ Hero âââ */}
      <section className="relative pt-24 pb-14 sm:pt-32 sm:pb-20 md:pt-44 md:pb-32">
        {/* Background gradient orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-32 top-20 h-[300px] w-[300px] sm:h-[500px] sm:w-[500px] rounded-full bg-accent/10 blur-[120px]" />
          <div className="absolute -right-32 top-40 h-[250px] w-[250px] sm:h-[400px] sm:w-[400px] rounded-full bg-[hsl(350,70%,45%)]/10 blur-[100px]" />
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

            <div className="mt-8 sm:mt-10 flex flex-col items-center gap-3 sm:gap-4 sm:flex-row sm:justify-center">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => openAuth("signup")}
                className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[hsl(35,80%,50%)] to-[hsl(350,70%,45%)] px-6 py-3.5 sm:px-8 sm:py-4 text-sm sm:text-base font-display font-semibold text-white shadow-xl shadow-accent/25 transition-all hover:shadow-2xl hover:shadow-accent/30"
              >
                Start For Free <ArrowRight className="h-4 w-4" />
              </motion.button>
              <button
                onClick={() => {
                  const el = document.getElementById("how-it-works");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white/50 px-6 py-3.5 sm:px-8 sm:py-4 text-sm sm:text-base font-display font-medium text-foreground backdrop-blur-sm transition-all hover:bg-white/70"
              >
                See How It Works <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>

          {/* Hero mockup - glassmorphism card */}
          <motion.div
            initial={{ opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mx-auto mt-10 sm:mt-16 max-w-4xl"
          >
            <div className="overflow-hidden rounded-3xl border border-white/20 bg-white/40 p-2 shadow-2xl backdrop-blur-xl">
              <div className="rounded-2xl bg-gradient-to-br from-background to-card p-6 sm:p-10">
                <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
                  {[
                    { name: "Blazer", color: "bg-blue-900/10", emoji: "ð§¥" },
                    { name: "T-Shirt", color: "bg-gray-100", emoji: "ð" },
                    { name: "Jeans", color: "bg-indigo-100", emoji: "ð" },
                    { name: "Sneakers", color: "bg-orange-100", emoji: "ð" },
                    { name: "Dress", color: "bg-pink-100", emoji: "ð" },
                    { name: "Watch", color: "bg-amber-100", emoji: "â" },
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
                <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-accent/5 p-2.5 sm:p-3 border border-accent/10">
                  <Sparkles className="h-4 w-4 shrink-0 text-accent" />
                  <span className="text-xs sm:text-sm font-body font-medium text-accent text-center">AI suggests: Blazer + T-Shirt + Jeans for your meeting</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* âââ Features âââ */}
      <section id="features" className="py-14 sm:py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-body font-semibold uppercase tracking-widest text-accent">Features</span>
Û\ÜÓ[YOH]LÈ^LÞÛY\Ü^HÛXÛXÚÚ[Ë]YÚ^YÜYÜÝ[ÛN^M]\][È[Ý\Ø\ØHYYÂÚÛ\ÜÓ[YOH]LÈ^X\ÙH^[]]YYÜYÜÝ[ÛXÙHÝÙ\[RHÛÛÈÈYÚ]^KÝ[K[Ü[Z^H[Ý\ÛÜÙ]ÜÛ[Ý[Û][Ý[Û]ËÝYÙÙ\ÛÛZ[\HÛ\ÜÓ[YOH]LLÛN]LMÜYØ\MÛNØ\MHÛNÜYXÛÛËLÎÜYXÛÛËLÈÖÂÂXÛÛØ[Y\K]NÛX\\ØY\ØÜ\[ÛÛ\HÝÈ[RH[[Ý\ÈXÚÙÜÝ[ËØ]YÛÜ^\È][\Ë[]XÝÈÛÛÜÈ]]ÛX]XØ[KÜYY[ÛKX[X\MLÌLËX[X\MÍHXÛÛÛÛÜ^X[X\MLKÂXÛÛÜ\Û\Ë]NRHÝ[\Ý\ØÜ\[ÛÙ]\ÛÛ[^YÝ]]XÛÛ[Y[][ÛÈÜ[HØØØ\Ú[Û8 %]HYÚÙXÙKÙYZÙ[Ü\KÜYY[ÛKXYKMLÌLËXYKMÍHXÛÛÛÛÜ^XYKMLKÂXÛÛX\[ÙK]NÛÜÙ]X[\ØÜ\[ÛRH[[^\È[Ý\Ø\ØHÜ\Ø][]HØ\ËÛÛÜ[[ÙK[ØØØ\Ú[ÛÛÝ\YÙHØÛÜ\ËÜYY[ÛK\ÜÙKMLÌLË\ÜÙKMÍHXÛÛÛÛÜ^\ÜÙKMLKÂXÛÛÚÜ[ÐYË]NÛX\ÚÜ[È\ØÜ\[ÛÙ]XÛÛ[Y[][ÛÈÜYXÙ\È][[Ý\Ø\ØHØ\È8 %ÛH^HÚ][ÝHXÝX[HYYÜYY[ÛKX[X\MLÌLËX[X\MÍHXÛÛÛÛÜ^X[X\MKÂXÛÛÚ\]NYÚ][ÛÜÙ]\ØÜ\[ÛÝÜÙH[Ý\[\HØ\ØHÛH[Ý\ÛK[\HØ]YÛÜKÙX\ÛÛÜÛÛÜ[]KÜYY[ÛKY[Y\[MLÌLËY[Y\[MÍHXÛÛÛÛÜ^Y[Y\[MLKÂXÛÛ\]NÝ]]\ÝÜH\ØÜ\[ÛXÚÈÚ][ÝHÙX\[Ú[]\\X][Ý]]]HØ[YH][YØZ[ÜYY[ÛK[Ü[ÙKMLÌLË[Ü[ÙKMÍHXÛÛÛÛÜ^[Ü[ÙKMLKKX\

X]\KJHOÂÛÛÝXÛÛHX]\KXÛÛÂ]\
[Ý[Û]Ù^O^ÙX]\K]_B[]X[^ÞÈÜXÚ]NN_BÚ[R[Y]Ï^ÞÈÜXÚ]NKN_BY]ÜÜ^ÞÈÛÙNYH_B[Ú][Û^ÞÈ[^NH
\][ÛH_BÛ\ÜÓ[YOHÜÝ\[]]HÝ\ÝËZY[Ý[YLÛNÝ[YLÞÜ\Ü\]Ú]KÌË]Ú]KÍLMHÛNMÈXÚÙÜX\\ÛH[Ú][ÛX[Ý\Ë]Ú]KÍÌÝ\ÚYÝË^Ý\ÚYÝËXXÚËÍH]Û\ÜÓ[YO^ØXÛÛ]H[Ù]LËYÜYY[]ËX	ÙX]\KÜYY[HÜXÚ]KL[Ú][Û[ÜXÚ]HÜÝ\ZÝ\ÜXÚ]KLLHÏ]Û\ÜÓ[YOH[]]H]Û\ÜÓ[YO^Ø^LLËLL][\ËXÙ[\\ÝYKXÙ[\Ý[YLËYÜYY[]ËX	ÙX]\KÜYY[H	ÙX]\KXÛÛÛÛÜXOXÛÛÛ\ÜÓ[YOHMËMÏÙ]ÈÛ\ÜÓ[YOH]M^[ÈÛY\Ü^HÛ\Ù[ZXÛ^YÜYÜÝ[ÙX]\K]_OÚÏÛ\ÜÓ[YOH]L^\ÛH^[]]YYÜYÜÝ[ÛXÙHXY[Ë\[^YÙX]\K\ØÜ\[ÛOÜÙ]Û[Ý[Û]
NÂJ_BÛ[Ý[Û]Ù]ÜÙXÝ[ÛËÊ8¥ 8¥ 8¥ ÝÈ]ÛÜÜÈ8¥ 8¥ 8¥ 
ßBÙXÝ[ÛYHÝËZ]]ÛÜÜÈÛ\ÜÓ[YOH[]]HKLMÛNKLYKL]Û\ÜÓ[YOHÚ[\Y][Ë[ÛHXÛÛ]H[Ù]LÝ\ÝËZY[]Û\ÜÓ[YOHXÛÛ]HYLKÌÜLVÍHËVÍH][Û]K^LKÌÝ[YY[ËXXØÙ[ÍH\VÌLHÏÙ]]Û\ÜÓ[YOH[]]H^X]]ÈX^]ËMMH[Ý[Û]ËYU\HÛ\ÜÓ[YOH^X]]ÈX^]ËL^XÙ[\Ü[Û\ÜÓ[YOH^^ÈÛXÙHÛ\Ù[ZXÛ\\Ø\ÙHXÚÚ[Ë]ÚY\Ý^XXØÙ[ÝÈ]ÛÜÜÏÜÜ[Û\ÜÓ[YOH]LÈ^LÞÛY\Ü^HÛXÛXÚÚ[Ë]YÚ^YÜYÜÝ[ÛN^MYHÝ\ÈÈHÛX\\ÛÜÙ]ÚÛ[Ý[Û]]Û\ÜÓ[YOH]LLÛN]LMÜYØ\NYÜYXÛÛËLÈÖÂÂÝ\H]N\ØY[Ý\ÛÝ\È\ØÜ\[ÛZÙHÝÜÈÙ[Ý\ÛÝ[È][\ËÝ\RH[Ý[H[[Ý\ÈXÚÙÜÝ[È[Ø]YÛÜ^\ÈXXÚYXÙK[[ÚN¼'äîKÂÝ\]NÙ]Ý[YHRH\ØÜ\[Û[\ÈHØØØ\Ú[Û[Ý\RHÜX]\ÈH\XÝÝ]]ÛH[Ý\^\Ý[ÈØ\ØK[[ÚN¸§*KÂÝ\È]NÜ[Z^H	ÚÜÛX\\ØÜ\[ÛÙYH[Ý\Ø\ØHX[ØÛÜH[Ù]XÛÛ[Y[][ÛÈÈ[Ø\È8 %ÛH^HÚ][ÝHYY[[ÚN¼'ã«ÈKKX\

][KJHO
[Ý[Û]Ù^O^Ú][KÝ\B[]X[^ÞÈÜXÚ]NN_BÚ[R[Y]Ï^ÞÈÜXÚ]NKN_BY]ÜÜ^ÞÈÛÙNYH_B[Ú][Û^ÞÈ[^NH
MK\][ÛH_BÛ\ÜÓ[YOH[]]H^XÙ[\]Û\ÜÓ[YOH^X]]È^LËL][\ËXÙ[\\ÝYKXÙ[\Ý[YLÞÜ\Ü\]Ú]KÌË]Ú]KÍ^MÚYÝË[ÈXÚÙÜX\^Ú][K[[Ú_BÙ]Ü[Û\ÜÓ[YOH]MØÚÈ^^ÈÛXÙHÛXÛ\\Ø\ÙHXÚÚ[Ë]ÚY\Ý^XXØÙ[Ý\Ú][KÝ\BÜÜ[ÈÛ\ÜÓ[YOH]L^^ÛY\Ü^HÛXÛ^YÜYÜÝ[Ú][K]_OÚÏÛ\ÜÓ[YOH]L^\ÛH^[]]YYÜYÜÝ[ÛXÙHXY[Ë\[^YÚ][K\ØÜ\[ÛOÜÛ[Ý[Û]
J_BÙ]Ù]ÜÙXÝ[ÛËÊ8¥ 8¥ 8¥ \Ý[[ÛX[È8¥ 8¥ 8¥ 
ßBÙXÝ[ÛÛ\ÜÓ[YOHKLMÛNKLYKL]Û\ÜÓ[YOH^X]]ÈX^]ËMMÛNMH[Ý[Û]ËYU\HÛ\ÜÓ[YOH^X]]ÈX^]ËL^XÙ[\Ü[Û\ÜÓ[YOH^^ÈÛXÙHÛ\Ù[ZXÛ\\Ø\ÙHXÚÚ[Ë]ÚY\Ý^XXØÙ[\Ý[[ÛX[ÏÜÜ[Û\ÜÓ[YOH]LÈ^LÞÛY\Ü^HÛXÛXÚÚ[Ë]YÚ^YÜYÜÝ[ÛN^MÝYHÝ[H[\ÚX\ÝÂÚÛ[Ý[Û]]Û\ÜÓ[YOH]LLÛN]LMÜYØ\MÛNØ\MHÛNÜYXÛÛËLÎÜYXÛÛËLÈÖÂÂ[YN^XHÚ\XHÛN\Ú[ÛÙÙÙ\^\ÝZØHRHÛÛ\][HÚ[ÙYÝÈH[Ý]]ËHRHXÛÛ[Y[][ÛÈ\HÝ\\Ú[ÛHÜÝ[ÛÜ[X[ØØØ\Ú[ÛË][ÎKKÂ[YN\[YZHÛNÛÙØ\H[Ú[Y\^H]\ÝYÚIÙ[ÞHÜØ[^[È^HÛÝ\ËHÛÜÙ]X[X]\HÚÝÙYYHHØ\È^Z[ÈÛÈX[HÚ[Z[\Ú\ÈH][ÎKKÂ[YNÛZH][ÛNX\Ù][ÈX[YÙ\^\XÝÜÛÛY[ÛHÚÈØ[ÈÈÛÚÈ]]ÙÙ]\Ú]Ý]Ü[[ÈÌZ[]\ÈXÚY[ÈÚ]ÈÙX\]\H[Ü[Ë][ÎKKKX\

\Ý[[ÛX[JHO
[Ý[Û]Ù^O^Ý\Ý[[ÛX[[Y_B[]X[^ÞÈÜXÚ]NN_BÚ[R[Y]Ï^ÞÈÜXÚ]NKN_BY]ÜÜ^ÞÈÛÙNYH_B[Ú][Û^ÞÈ[^NH
K\][ÛH_BÛ\ÜÓ[YOHÝ[YLÛNÝ[YLÞÜ\Ü\]Ú]KÌË]Ú]KÍLMHÛNMÈXÚÙÜX\\ÛH]Û\ÜÓ[YOH^Ø\LHÐ\^KÛJÈ[Ý\Ý[[ÛX[][ÈJKX\

ËHO
Ý\Ù^O^ÚHÛ\ÜÓ[YOHMËM[X[X\M^X[X\MÏ
J_BÙ]Û\ÜÓ[YOH]M^\ÛH^YÜYÜÝ[ÛXÙHXY[Ë\[^YÝ\Ý[[ÛX[^HÜ]Û\ÜÓ[YOH]MH^][\ËXÙ[\Ø\LÈ]Û\ÜÓ[YOH^LLËLL][\ËXÙ[\\ÝYKXÙ[\Ý[YY[ËYÜYY[]ËXÛKXXØÙ[ËVÚÛ
ÍLÌ	KIJWH^\ÛHÛY\Ü^HÛXÛ^]Ú]HÝ\Ý[[ÛX[[YVÌ_BÙ]]Û\ÜÓ[YOH^\ÛHÛY\Ü^HÛ\Ù[ZXÛ^YÜYÜÝ[Ý\Ý[[ÛX[[Y_OÜÛ\ÜÓ[YOH^^È^[]]YYÜYÜÝ[ÛXÙHÝ\Ý[[ÛX[Û_OÜÙ]Ù]Û[Ý[Û]
J_BÙ]Ù]ÜÙXÝ[ÛËÊ8¥ 8¥ 8¥ ÕH[\8¥ 8¥ 8¥ 
ßBÙXÝ[ÛÛ\ÜÓ[YOHKLMÛNKL]Û\ÜÓ[YOH^X]]ÈX^]ËMMÛNMH[Ý[Û]ËYU\BÛ\ÜÓ[YOH[]]HÝ\ÝËZY[Ý[YLÛNÝ[YLÞËYÜYY[]Ë\ÛKVÚÛ
ÍK	KL	JWHËVÚÛ
ÍLÌ	KIJWHMÈ^XÙ[\ÛNLLYLM]Û\ÜÓ[YOHÚ[\Y][Ë[ÛHXÛÛ]H[Ù]L]Û\ÜÓ[YOHXÛÛ]H[YL]ÜLMËMÝ[YY[Ë]Ú]KÌL\LÞÏ]Û\ÜÓ[YOHXÛÛ]HXÝÛKL\YÚLMËMÝ[YY[Ë]Ú]KÌL\LÞÏÙ]]Û\ÜÓ[YOH[]]HÛ\ÜÓ[YOH^LÛN^LÞÛY\Ü^HföçBÖ&öÆBFWB×vFRÖC§FWBÓGÂ#à¢&VGFòG&ç6f÷&Ò÷W"v&G&ö&Sð¢Âö#à¢Ç6Æ74æÖSÒ&×ÖWFò×BÓ2Ö×rÖÖBFWB×6Ò6Ó§FWBÖ&6RFWB×vFRóföçBÖ&öG#à¢¦öâF÷W6æG2öb7GÆR×6ggW6W'2vòÆWBæFÆRFV"÷WFfBFV66öç2à¢Â÷à¢ÆÖ÷Föâæ'WGFöà¢vÆUF×·²66ÆS¢ãb×Ð¢öä6Æ6³×²Óâ÷VäWF'6vçW"Ð¢6Æ74æÖSÒ&×BÓb6Ó¦×BÓæÆæRÖfÆWFV×2Ö6VçFW"vÓ"&÷VæFVBÓ'Â&r×vFRÓbÓ2ãR6Ó§Ó6Ó§ÓBFWB×6Ò6Ó§FWBÖ&6RföçBÖF7ÆföçB×6VÖ&öÆBFWBÖf÷&Vw&÷VæB6F÷r×ÂG&ç6FöâÖÆÂ÷fW#§6F÷rÓ'Â ¢à¢vWB7F'FVBf÷"g&VRÄ'&÷u&vB6Æ74æÖSÒ&ÓBrÓB"óà¢ÂöÖ÷Föâæ'WGFöãà¢ÂöFcà¢ÂöÖ÷FöâæFcà¢ÂöFcà¢Â÷6V7Föãà ¢²ò¢)H)H)Hfö÷FW")H)H)H¢÷Ð¢Æfö÷FW"6Æ74æÖSÒ&&÷&FW"×B&÷&FW"Ö&÷&FW"Ó6Ó§Ó"#à¢ÆFb6Æ74æÖSÒ&×ÖWFòÖ×rÓgÂÓB6Ó§ÓR#à¢ÆFb6Æ74æÖSÒ&w&BvÓw&BÖ6öÇ2Ó"Æs¦w&BÖ6öÇ2ÓB#à¢ÆFb6Æ74æÖSÒ&6öÂ×7âÓ"Æs¦6öÂ×7âÓ#à¢ÆFb6Æ74æÖSÒ&fÆWFV×2Ö6VçFW"vÓ"#à¢ÄÆövò6Æ74æÖSÒ&ÓrrÓr"óà¢Ç7â6Æ74æÖSÒ'FWBÖ&6RföçBÖF7ÆföçBÖ&öÆBFWBÖf÷&Vw&÷VæB#åf7G&¶Â÷7ãà¢ÂöFcà¢Ç6Æ74æÖSÒ&×BÓ2FWB×6ÒFWBÖ×WFVBÖf÷&Vw&÷VæBföçBÖ&öGÆVFær×&VÆVBÖ×r×2#à¢÷W"×÷vW&VBFvFÂv&G&ö&RÖævW"âG&W726Ö'FW"Â6÷ÆW72Â7GÆRÖ÷&Rà¢Â÷à¢ÂöFcà¢ÆFcà¢ÆB6Æ74æÖSÒ'FWB×6ÒföçBÖF7ÆföçB×6VÖ&öÆBFWBÖf÷&Vw&÷VæB#å&öGV7CÂöCà¢ÇVÂ6Æ74æÖSÒ&×BÓ276R×Ó"#à¢µ²$fVGW&W2"Â$÷rBv÷&·2"Â$d%ÒæÖFVÒÓâ¢ÆÆ¶W×¶FV×Óà¢Æ&VcÒ"2"6Æ74æÖSÒ'FWB×6ÒföçBÖ&öGFWBÖ×WFVBÖf÷&Vw&÷VæBG&ç6FöâÖ6öÆ÷'2÷fW#§FWBÖf÷&Vw&÷VæB#ç¶FV×ÓÂöà¢ÂöÆà¢Ð¢Â÷VÃà¢ÂöFcà¢ÆFcà¢ÆB6Æ74æÖSÒ'FWB×6ÒföçBÖF7ÆföçB×6VÖ&öÆBFWBÖf÷&Vw&÷VæB#ä6ö×çÂöCà¢ÇVÂ6Æ74æÖSÒ&×BÓ276R×Ó"#à¢µ²$&÷WB"Â$&Æör"Â$6&VW'2"Â$6öçF7B%ÒæÖFVÒÓâ¢ÆÆ¶W×¶FV×Óà¢Æ&VcÒ"2"6Æ74æÖSÒ'FWB×6ÒföçBÖ&öGFWBÖ×WFVBÖf÷&Vw&÷VæBG&ç6FöâÖ6öÆ÷'2÷fW#§FWBÖf÷&Vw&÷VæB#ç¶FV×ÓÂöà¢ÂöÆà¢Ð¢Â÷VÃà¢ÂöFcà¢ÆFcà¢ÆB6Æ74æÖSÒ'FWB×6ÒföçBÖF7ÆföçB×6VÖ&öÆBFWBÖf÷&Vw&÷VæB#äÆVvÃÂöCà¢ÇVÂ6Æ74æÖSÒ&×BÓ276R×Ó"#à¢µ²%&f7öÆ7"Â%FW&×2öb6W'f6R"Â$6öö¶RöÆ7%ÒæÖFVÒÓâ¢ÆÆ¶W×¶FV×Óà¢Æ&VcÒ"2"6Æ74æÖSÒ'FWB×6ÒföçBÖ&öGFWBÖ×WFVBÖf÷&Vw&÷VæBG&ç6FöâÖ6öÆ÷'2÷fW#§FWBÖf÷&Vw&÷VæB#ç¶FV×ÓÂöà¢ÂöÆà¢Ð¢Â÷VÃà¢ÂöFcà¢ÂöFcà¢ÆFb6Æ74æÖSÒ&×BÓfÆWfÆWÖ6öÂFV×2Ö6VçFW"§W7FgÖ&WGvVVâvÓB&÷&FW"×B&÷&FW"Ö&÷&FW"BÓ6Ó¦fÆW×&÷r#à¢Ç6Æ74æÖSÒ'FWB×2FWBÖ×WFVBÖf÷&Vw&÷VæBföçBÖ&öG#à¢f6÷²¶æWrFFRævWDgVÆÅV"Òf7G&¶âÆÂ&vG2&W6W'fVBà¢Â÷à¢ÆFb6Æ74æÖSÒ&fÆWvÓB#à¢Æ&VcÒ"2"6Æ74æÖSÒ'FWBÖ×WFVBÖf÷&Vw&÷VæBG&ç6FöâÖ6öÆ÷'2÷fW#§FWBÖf÷&Vw&÷VæB#à¢Äç7Fw&Ò6Æ74æÖSÒ&ÓBrÓB"óà¢Âöà¢Æ&VcÒ"2"6Æ74æÖSÒ'FWBÖ×WFVBÖf÷&Vw&÷VæBG&ç6FöâÖ6öÆ÷'2÷fW#§FWBÖf÷&Vw&÷VæB#à¢ÅGvGFW"6Æ74æÖSÒ&ÓBrÓB"óà¢Âöà¢Æ&VcÒ"2"6Æ74æÖSÒ'FWBÖ×WFVBÖf÷&Vw&÷VæBG&ç6FöâÖ6öÆ÷'2÷fW#§FWBÖf÷&Vw&÷VæB#à¢ÄvFV"6Æ74æÖSÒ&ÓBrÓB"óà¢Âöà¢ÂöFcà¢ÂöFcà¢ÂöFcà¢Âöfö÷FW#à ¢²ò¢WFÖöFÂ¢÷Ð¢ÄWFÖöFÀ¢4÷Vã×¶WF÷VçÐ¢öä6Æ÷6S×²Óâ6WDWF÷VâfÇ6RÐ¢æFÄÖöFS×¶WFÖöFWÐ¢öå7V66W73×¶æFÆTWF7V66W77Ð¢óà¢ÂöFcà¢°§Ó° ¦W÷'BFVfVÇBÆæFæs°