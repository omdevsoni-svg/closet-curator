import { motion } from "framer-motion";
import { HeartPulse, AlertTriangle, TrendingUp, ExternalLink, ShoppingBag } from "lucide-react";

const healthStats = [
  { label: "Versatility Score", value: 72, max: 100, color: "text-ai" },
  { label: "Occasion Coverage", value: 4, max: 8, color: "text-shop" },
  { label: "Color Balance", value: 60, max: 100, color: "text-amber-500" },
];

const gaps = [
  {
    category: "Formal Wear",
    description: "You lack formal options for events & weddings",
    severity: "high",
  },
  {
    category: "Activewear",
    description: "No workout or athletic clothing found",
    severity: "high",
  },
  {
    category: "Accessories",
    description: "Belts, watches, and scarves can elevate your looks",
    severity: "medium",
  },
];

const ajioRecommendations = [
  {
    id: "1",
    name: "Slim Fit Formal Suit",
    price: "₹4,999",
    image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=300&h=400&fit=crop",
    tag: "Fills Formal Gap",
  },
  {
    id: "2",
    name: "Running Shoes",
    price: "₹2,499",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&h=400&fit=crop",
    tag: "Activewear",
  },
  {
    id: "3",
    name: "Leather Belt",
    price: "₹899",
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=300&h=400&fit=crop",
    tag: "Accessory",
  },
  {
    id: "4",
    name: "Track Pants",
    price: "₹1,299",
    image: "https://images.unsplash.com/photo-1556906781-9a412961c28c?w=300&h=400&fit=crop",
    tag: "Activewear",
  },
];

const ClosetHealth = () => {
  return (
    <div className="px-5 pt-8">
      <div className="flex items-center gap-2">
        <HeartPulse className="h-5 w-5 text-shop" />
        <h1 className="text-2xl font-display font-bold tracking-tight">
          Closet Health
        </h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground font-body">
        AI analysis of your wardrobe completeness
      </p>

      {/* Score rings */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        {healthStats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex flex-col items-center rounded-2xl bg-card p-4"
          >
            <div className="relative h-16 w-16">
              <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="hsl(var(--border))"
                  strokeWidth="5"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${(stat.value / stat.max) * 176} 176`}
                  className={stat.color}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-display font-bold">
                {stat.label === "Occasion Coverage"
                  ? `${stat.value}/${stat.max}`
                  : `${stat.value}%`}
              </span>
            </div>
            <span className="mt-2 text-center text-[10px] font-medium font-body text-muted-foreground">
              {stat.label}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Wardrobe gaps */}
      <div className="mt-8">
        <h2 className="flex items-center gap-2 text-base font-display font-semibold">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Wardrobe Gaps
        </h2>
        <div className="mt-3 space-y-2">
          {gaps.map((gap, i) => (
            <motion.div
              key={gap.category}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="flex items-center justify-between rounded-2xl bg-card p-4"
            >
              <div>
                <p className="text-sm font-medium font-body text-foreground">
                  {gap.category}
                </p>
                <p className="text-xs text-muted-foreground font-body">
                  {gap.description}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  gap.severity === "high"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {gap.severity}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Ajio Recommendations */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-display font-semibold">
            <ShoppingBag className="h-4 w-4 text-shop" />
            Recommended for You
          </h2>
          <a
            href="https://www.ajio.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-medium text-shop font-body"
          >
            View on Ajio
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="mt-3 flex gap-3 overflow-x-auto pb-4 scrollbar-none">
          {ajioRecommendations.map((product, i) => (
            <motion.a
              key={product.id}
              href="https://www.ajio.com"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + i * 0.08 }}
              className="group shrink-0"
            >
              <div className="relative h-40 w-32 overflow-hidden rounded-2xl">
                <img
                  src={product.image}
                  alt={product.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <span className="absolute left-2 top-2 rounded-full bg-shop px-2 py-0.5 text-[9px] font-semibold text-shop-foreground">
                  {product.tag}
                </span>
              </div>
              <p className="mt-1.5 text-xs font-medium font-body text-foreground truncate w-32">
                {product.name}
              </p>
              <p className="text-xs font-semibold text-shop font-body">
                {product.price}
              </p>
            </motion.a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ClosetHealth;
