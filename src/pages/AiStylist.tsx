import { useState } from "react";
import { Sparkles, Send, PartyPopper, Briefcase, Coffee, Dumbbell, Heart, GraduationCap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import mockBlazer from "@/assets/mock-blazer.png";
import mockDressShirt from "@/assets/mock-dress-shirt.png";
import mockChinos from "@/assets/mock-chinos.png";
import mockJeans from "@/assets/mock-jeans.png";
import mockTshirt from "@/assets/mock-tshirt.png";
import mockSneakers from "@/assets/mock-sneakers.png";

const occasions = [
  { label: "Date Night", icon: Heart, color: "bg-rose-100 text-rose-600" },
  { label: "Office", icon: Briefcase, color: "bg-blue-100 text-blue-600" },
  { label: "Casual", icon: Coffee, color: "bg-amber-100 text-amber-700" },
  { label: "Party", icon: PartyPopper, color: "bg-amber-100 text-amber-600" },
  { label: "Workout", icon: Dumbbell, color: "bg-green-100 text-green-600" },
  { label: "Formal", icon: GraduationCap, color: "bg-gray-100 text-gray-700" },
];

type OutfitRecommendation = {
  occasion: string;
  items: { name: string; image: string }[];
  tip: string;
};

const mockRecommendations: Record<string, OutfitRecommendation> = {
  "Date Night": {
    occasion: "Date Night",
    items: [
      { name: "Navy Blazer", image: mockBlazer },
      { name: "Black Dress Shirt", image: mockDressShirt },
      { name: "Beige Chinos", image: mockChinos },
    ],
    tip: "Pair with a nice watch and minimal cologne for maximum impact.",
  },
  Office: {
    occasion: "Office",
    items: [
      { name: "Black Dress Shirt", image: mockDressShirt },
      { name: "Beige Chinos", image: mockChinos },
      { name: "White Sneakers", image: mockSneakers },
    ],
    tip: "Smart casual look that balances professionalism with comfort.",
  },
  Casual: {
    occasion: "Casual",
    items: [
      { name: "White T-Shirt", image: mockTshirt },
      { name: "Blue Denim Jeans", image: mockJeans },
      { name: "White Sneakers", image: mockSneakers },
    ],
    tip: "Classic combo that never goes out of style. Roll up the sleeves for extra flair.",
  },
};

const AiStylist = () => {
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [recommendation, setRecommendation] = useState<OutfitRecommendation | null>(null);

  const handleOccasionSelect = (label: string) => {
    setSelectedOccasion(label);
    setRecommendation(mockRecommendations[label] || mockRecommendations["Casual"]);
  };

  const handleSubmitPrompt = () => {
    if (prompt.trim()) {
      setSelectedOccasion(prompt);
      setRecommendation(mockRecommendations["Casual"]);
      setPrompt("");
    }
  };

  return (
    <div className="px-5 pt-8">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-ai" />
        <h1 className="text-2xl font-display font-bold tracking-tight">
          AI Stylist
        </h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground font-body">
        Select an occasion or describe your vibe
      </p>

      {/* Occasion presets */}
      <div className="mt-6 grid grid-cols-3 gap-2">
        {occasions.map((occ) => {
          const Icon = occ.icon;
          const isActive = selectedOccasion === occ.label;
          return (
            <motion.button
              key={occ.label}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleOccasionSelect(occ.label)}
              className={`flex flex-col items-center gap-1.5 rounded-2xl p-4 transition-all ${
                isActive
                  ? "ring-2 ring-ai shadow-lg shadow-ai/10"
                  : "bg-card hover:bg-card/80"
              } ${occ.color}`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[11px] font-medium font-body">{occ.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Custom prompt */}
      <div className="mt-5 flex items-center gap-2 rounded-2xl bg-card p-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmitPrompt()}
          placeholder="Or describe your occasion..."
          className="flex-1 bg-transparent px-3 py-2 text-sm font-body text-foreground placeholder:text-muted-foreground outline-none"
        />
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleSubmitPrompt}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-ai text-ai-foreground"
        >
          <Send className="h-4 w-4" />
        </motion.button>
      </div>

      {/* Recommendation */}
      <AnimatePresence mode="wait">
        {recommendation && (
          <motion.div
            key={recommendation.occasion}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mt-6"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-ai" />
              <h2 className="text-lg font-display font-semibold">
                {recommendation.occasion} Look
              </h2>
            </div>

            <div className="mt-3 flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {recommendation.items.map((item, i) => (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="shrink-0"
                >
                  <div className="h-36 w-28 overflow-hidden rounded-2xl bg-card p-2">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <p className="mt-1.5 text-center text-[10px] font-medium font-body text-foreground">
                    {item.name}
                  </p>
                </motion.div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl bg-ai/5 p-4">
              <p className="text-xs text-ai font-body font-medium">
                💡 Styling Tip
              </p>
              <p className="mt-1 text-sm text-foreground font-body">
                {recommendation.tip}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AiStylist;
