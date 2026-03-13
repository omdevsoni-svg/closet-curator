import { useState } from "react";
import { Plus, Filter } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import mockBlazer from "@/assets/mock-blazer.png";
import mockSneakers from "@/assets/mock-sneakers.png";
import mockJeans from "@/assets/mock-jeans.png";
import mockTshirt from "@/assets/mock-tshirt.png";
import mockDressShirt from "@/assets/mock-dress-shirt.png";
import mockChinos from "@/assets/mock-chinos.png";

type ClothingItem = {
  id: string;
  name: string;
  category: string;
  image: string;
};

const mockItems: ClothingItem[] = [
  { id: "1", name: "Navy Blazer", category: "Outerwear", image: mockBlazer },
  { id: "2", name: "White Sneakers", category: "Footwear", image: mockSneakers },
  { id: "3", name: "Blue Denim Jeans", category: "Bottoms", image: mockJeans },
  { id: "4", name: "White T-Shirt", category: "Tops", image: mockTshirt },
  { id: "5", name: "Black Dress Shirt", category: "Tops", image: mockDressShirt },
  { id: "6", name: "Beige Chinos", category: "Bottoms", image: mockChinos },
];

const categories = ["All", "Tops", "Bottoms", "Outerwear", "Footwear"];

const DigitalCloset = () => {
  const [activeCategory, setActiveCategory] = useState("All");
  const [showUpload, setShowUpload] = useState(false);

  const filtered =
    activeCategory === "All"
      ? mockItems
      : mockItems.filter((i) => i.category === activeCategory);

  return (
    <div className="px-5 pt-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">
            My Closet
          </h1>
          <p className="text-sm text-muted-foreground font-body">
            {mockItems.length} items
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowUpload(!showUpload)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"
        >
          <Plus className="h-5 w-5" />
        </motion.button>
      </div>

      {/* Upload area */}
      <AnimatePresence>
        {showUpload && (
          <motion.label
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-4 block cursor-pointer overflow-hidden"
          >
            <input type="file" accept="image/*" multiple className="hidden" />
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card py-8">
              <Plus className="h-8 w-8 text-muted-foreground" />
              <span className="mt-2 text-sm text-muted-foreground font-body">
                Upload clothing photos
              </span>
              <span className="mt-1 text-[10px] text-muted-foreground/60 font-body">
                AI will remove backgrounds automatically
              </span>
            </div>
          </motion.label>
        )}
      </AnimatePresence>

      {/* Category filters */}
      <div className="mt-6 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium font-body transition-colors ${
              activeCategory === cat
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Clothing grid */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {filtered.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="group"
          >
            <div className="overflow-hidden rounded-2xl bg-card p-3">
              <div className="aspect-square overflow-hidden rounded-xl">
                <img
                  src={item.image}
                  alt={item.name}
                  className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="mt-2">
                <p className="text-xs font-medium font-body text-foreground truncate">
                  {item.name}
                </p>
                <p className="text-[10px] text-muted-foreground font-body">
                  {item.category}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default DigitalCloset;
