import { createFileRoute, Link } from "@tanstack/react-router";
import { ChefHat, Sun, Moon, Sunrise, IceCream, WheatOff } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { MEALS_WITH_RECIPE_SELECT, unwrapMealRecipe } from "@/lib/meal-helpers";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/app/mode")({
  component: ModePage,
});

type MealTime = "breakfast" | "lunch" | "dinner" | "dessert";

export function getDefaultMealTime(): MealTime {
  const hour = new Date().getHours();
  if (hour >= 3 && hour < 12) return "breakfast";
  if (hour >= 12 && hour < 18) return "lunch";
  return "dinner";
}

const STORAGE_KEY = "swipebite.mealTimeFilter";
const GF_KEY = "swipebite.glutenFreeOnly";

const mealTimeOptions: { value: MealTime; label: string; icon: React.ReactNode }[] = [
  { value: "breakfast", label: "Breakfast", icon: <Sunrise size={18} /> },
  { value: "lunch", label: "Lunch", icon: <Sun size={18} /> },
  { value: "dinner", label: "Dinner", icon: <Moon size={18} /> },
  { value: "dessert", label: "Dessert", icon: <IceCream size={18} /> },
];

function ModePage() {
  const defaultMealTime = getDefaultMealTime();
  const [mealTime, setMealTime] = useState<MealTime>(defaultMealTime);
  const [userChanged, setUserChanged] = useState(false);
  const [glutenFree, setGlutenFree] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { value: MealTime; userChanged: boolean };
        if (parsed.userChanged) {
          setMealTime(parsed.value);
          setUserChanged(true);
        }
      }
      const gf = sessionStorage.getItem(GF_KEY);
      if (gf === "1") setGlutenFree(true);
    } catch {
      // ignore
    }
  }, []);

  function selectMealTime(value: MealTime) {
    setMealTime(value);
    setUserChanged(true);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ value, userChanged: true }));
    } catch {
      // ignore
    }
  }

  function toggleGF() {
    const next = !glutenFree;
    setGlutenFree(next);
    try {
      sessionStorage.setItem(GF_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  }

  // Prefetch & preload 20 cards for the current (mealTime, glutenFree) so
  // navigating to /app/swipe shows ready slides instantly.
  const { userId } = useAuth();
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const slot = mealTime;
    const gfOnly = glutenFree;
    const key = `swipebite.deck.${userId}.cook.${slot}.${gfOnly ? "gf" : "all"}`;

    (async () => {
      const [{ data: swipes }, { data: meals }] = await Promise.all([
        supabase.from("swipes").select("meal_id").eq("user_id", userId).eq("mode", "cook"),
        supabase
          .from("meals")
          .select(MEALS_WITH_RECIPE_SELECT)
          .eq("is_alcohol", false)
          .limit(500),
      ]);
      if (cancelled || !meals) return;
      const paired = (
        meals as Array<Tables<"meals"> & { recipes: Tables<"recipes"> | Tables<"recipes">[] }>
      )
        .map(unwrapMealRecipe)
        .filter((m): m is NonNullable<typeof m> => Boolean(m));
      const swiped = new Set((swipes || []).map((s) => s.meal_id));
      const matchesSlot = (m: (typeof paired)[number]) => {
        const times = Array.isArray(m.meal_time) ? m.meal_time : [];
        const tags = Array.isArray(m.tags) ? m.tags : [];
        if (slot === "dessert") {
          return (
            times.includes("dessert") ||
            tags.some((t) => t?.toLowerCase().includes("dessert")) ||
            (m.cuisine?.toLowerCase().includes("dessert") ?? false)
          );
        }
        return times.includes(slot);
      };
      const isGF = (m: (typeof paired)[number]) => {
        const tags = (Array.isArray(m.tags) ? m.tags : []).map((t) => t?.toLowerCase() ?? "");
        const flags = (Array.isArray(m.health_flags) ? m.health_flags : []).map((t) => t?.toLowerCase() ?? "");
        return tags.some((t) => t.includes("gluten-free") || t.includes("gluten free")) ||
          flags.some((t) => t.includes("gluten-free") || t.includes("gluten free"));
      };

      let pool = paired.filter((m) => !swiped.has(m.id) && matchesSlot(m));
      if (gfOnly) pool = pool.filter(isGF);
      const fresh = pool.slice(0, 20);

      try {
        sessionStorage.setItem(key, JSON.stringify(fresh.map((m) => m.id)));
      } catch {
        // ignore
      }
      // Warm browser image cache
      fresh.forEach((m) => {
        const url = m.recipes.image_url ?? m.image_url;
        if (!url || !/^https?:\/\//.test(url)) return;
        const img = new Image();
        img.src = url;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, mealTime, glutenFree]);

  return (
    <div className="py-8">

      <h1 className="font-display text-4xl font-black tracking-tight text-balance">
        What sounds <span className="italic text-romance">good?</span>
      </h1>
      <p className="mt-2 text-base" style={{ color: "var(--romance-muted-fg)" }}>
        Pick how you want to eat today.
      </p>

      {/* Meal-time toggle (original slider) */}
      <div className="mt-6 flex justify-center">
        <div className="flex items-center gap-1 rounded-full p-1.5" style={{ background: "var(--accent)" }}>
          {mealTimeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => selectMealTime(opt.value)}
              className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
                mealTime === opt.value
                  ? "bg-card text-primary shadow-card"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {userChanged && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Matches will be filtered to <span className="font-semibold text-primary">{mealTime}</span>.
        </p>
      )}

      {/* Gluten-free quick filter */}
      <div className="mt-5 flex justify-center">
        <button
          onClick={toggleGF}
          aria-pressed={glutenFree}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            glutenFree
              ? "bg-romance text-white"
              : "bg-card text-muted-foreground hover:text-foreground"
          }`}
          style={glutenFree ? { background: "var(--gradient-warm)", color: "white" } : undefined}
        >
          <WheatOff size={14} />
          Gluten-free only
        </button>
      </div>

      <div className="mt-6 grid gap-4">
        <Link
          to="/app/swipe"
          search={{ mode: "cook" }}
          className="group relative overflow-hidden rounded-3xl bg-card p-6 transition-transform hover:-translate-y-1 shadow-card"
        >
          <div
            className="mb-4 grid h-12 w-12 place-items-center rounded-2xl text-white gradient-romance"
          >
            <ChefHat />
          </div>
          <h2 className="font-display text-2xl font-bold">Cook Your Match</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--romance-muted-fg)" }}>
            Recipes with ingredients, prep time, nutrition, and grocery stores nearby.
          </p>
        </Link>
      </div>
    </div>
  );
}
