import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  ImageIcon,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getClosetItems,
  getOutfitPlans,
  saveOutfitPlan,
  deleteOutfitPlan,
  type ClothingItem,
  type OutfitPlan,
} from "@/lib/database";

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/*  Plan Outfit Modal                                                   */
/* ------------------------------------------------------------------ */
interface PlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  closetItems: ClothingItem[];
  userId: string;
  onSaved: (plan: OutfitPlan) => void;
}

const PlanOutfitModal = ({ isOpen, onClose, date, closetItems, userId, onSaved }: PlanModalProps) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [occasion, setOccasion] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (selectedIds.length === 0) return;
    setSaving(true);
    const plan = await saveOutfitPlan({
      user_id: userId,
      date,
      occasion: occasion || undefined,
      item_ids: selectedIds,
    });
    setSaving(false);
    if (plan) {
      onSaved(plan);
      setSelectedIds([]);
      setOccasion("");
      onClose();
    }
  };

  const activeItems = closetItems.filter((i) => !i.archived);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
            className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-background p-6 pb-24 sm:rounded-3xl sm:pb-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-display font-bold text-foreground">
                  Plan Outfit
                </h2>
                <p className="text-xs font-body text-muted-foreground">
                  {new Date(date + "T12:00:00").toLocaleDateString("en-IN", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </p>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Occasion */}
            <div className="mt-4">
              <input
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                placeholder="Occasion (optional) e.g. Office, Date Night"
                className="h-10 w-full rounded-xl border border-border bg-card px-4 text-sm font-body text-foreground placeholder:text-muted-foreground outline-none focus:border-ai focus:ring-2 focus:ring-ai/20"
              />
            </div>

            {/* Item grid */}
            <p className="mt-4 text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">
              Select items ({selectedIds.length} chosen)
            </p>
            <div className="mt-2 grid grid-cols-4 gap-2 max-h-[40vh] overflow-y-auto">
              {activeItems.map((item) => {
                const selected = selectedIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className={`relative overflow-hidden rounded-xl border-2 transition-all ${
                      selected
                        ? "border-ai shadow-md shadow-ai/10"
                        : "border-transparent"
                    }`}
                  >
                    <div className="aspect-square bg-card p-1">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-full w-full object-contain rounded-lg"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ImageIcon className="h-5 w-5 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    <p className="px-1 py-0.5 text-[8px] font-body text-foreground truncate text-center">
                      {item.name}
                    </p>
                    {selected && (
                      <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-ai text-white text-[8px] font-bold">
                        {selectedIds.indexOf(item.id) + 1}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Save */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={selectedIds.length === 0 || saving}
              className="mt-5 h-12 w-full rounded-xl bg-gradient-to-r from-[hsl(43,72%,50%)] to-[hsl(220,12%,68%)] text-white font-display font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Calendar className="h-4 w-4" />
                  Save to Calendar
                </>
              )}
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ------------------------------------------------------------------ */
/*  Calendar component                                                  */
/* ------------------------------------------------------------------ */
const OutfitCalendar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [plans, setPlans] = useState<OutfitPlan[]>([]);
  const [closetItems, setClosetItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [planModalDate, setPlanModalDate] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [items, monthPlans] = await Promise.all([
        getClosetItems(user.id),
        getOutfitPlans(
          user.id,
          toDateStr(year, month, 1),
          toDateStr(year, month, getDaysInMonth(year, month))
        ),
      ]);
      setClosetItems(items);
      setPlans(monthPlans);
      setLoading(false);
    };
    load();
  }, [user, year, month]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const handleDeletePlan = async (planId: string) => {
    await deleteOutfitPlan(planId);
    setPlans((prev) => prev.filter((p) => p.id !== planId));
  };

  // Group plans by date
  const plansByDate: Record<string, OutfitPlan[]> = {};
  for (const p of plans) {
    if (!plansByDate[p.date]) plansByDate[p.date] = [];
    plansByDate[p.date].push(p);
  }

  return (
    <div className="px-5 pt-5 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-ai" />
            <h1 className="text-2xl font-display font-bold tracking-tight">
              Outfit Calendar
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground font-body">
            Plan what to wear ahead of time
          </p>
        </div>
      </div>

      {/* Month navigation */}
      <div className="mt-5 flex items-center justify-between">
        <button onClick={prevMonth} className="flex h-9 w-9 items-center justify-center rounded-xl bg-card text-foreground">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="text-base font-display font-semibold text-foreground">
          {MONTHS[month]} {year}
        </h2>
        <button onClick={nextMonth} className="flex h-9 w-9 items-center justify-center rounded-xl bg-card text-foreground">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="mt-4 grid grid-cols-7 gap-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-body font-semibold text-muted-foreground uppercase py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="mt-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for offset */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}
          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = toDateStr(year, month, day);
            const isToday = dateStr === todayStr;
            const hasPlans = !!plansByDate[dateStr];

            return (
              <motion.button
                key={day}
                whileTap={{ scale: 0.9 }}
                onClick={() => setPlanModalDate(dateStr)}
                className={`relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-body transition-all ${
                  isToday
                    ? "bg-ai text-ai-foreground font-bold shadow-md shadow-ai/20"
                    : hasPlans
                    ? "bg-ai/10 text-ai font-semibold"
                    : "bg-card text-foreground hover:bg-card/80"
                }`}
              >
                {day}
                {hasPlans && (
                  <div className="absolute bottom-1 flex gap-0.5">
                    {plansByDate[dateStr].slice(0, 3).map((_, j) => (
                      <div key={j} className="h-1 w-1 rounded-full bg-ai" />
                    ))}
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Upcoming planned outfits */}
      {plans.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-ai" />
            <h3 className="text-sm font-display font-semibold text-foreground">
              Planned Outfits
            </h3>
          </div>
          <div className="space-y-3">
            {plans.map((plan) => {
              const planItems = plan.item_ids
                .map((id) => closetItems.find((i) => i.id === id))
                .filter(Boolean) as ClothingItem[];
              const dateObj = new Date(plan.date + "T12:00:00");
              const dayLabel = dateObj.toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
              });

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl bg-card p-4 border border-border"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-xs font-display font-semibold text-foreground">
                        {dayLabel}
                      </span>
                      {plan.occasion && (
                        <span className="ml-2 text-[10px] font-body text-ai font-medium">
                          {plan.occasion}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeletePlan(plan.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto scrollbar-none">
                    {planItems.map((item) => (
                      <div key={item.id} className="shrink-0">
                        <div className="h-16 w-14 overflow-hidden rounded-lg bg-background border border-border p-1">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.name} className="h-full w-full object-contain" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <ImageIcon className="h-3 w-3 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>
                        <p className="mt-0.5 text-center text-[8px] font-body text-muted-foreground truncate w-14">
                          {item.name}
                        </p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Plan outfit modal */}
      {user && planModalDate && (
        <PlanOutfitModal
          isOpen={!!planModalDate}
          onClose={() => setPlanModalDate(null)}
          date={planModalDate}
          closetItems={closetItems}
          userId={user.id}
          onSaved={(plan) => setPlans((prev) => [...prev, plan].sort((a, b) => a.date.localeCompare(b.date)))}
        />
      )}
    </div>
  );
};

export default OutfitCalendar;