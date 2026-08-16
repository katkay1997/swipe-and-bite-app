import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { Heart, X, Undo2, Clock, Flame, Sparkles, Users } from "lucide-react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { enrichMealRecipe } from "@/lib/recipe.functions";
import { getSpiceLevel } from "@/lib/meal-helpers";
import placeholderImg from "@/assets/meal-placeholder.jpg";

type Meal = Tables<"meals">;
type RecipePreview = {
  image_url: string | null;
  ingredients: string[];
  steps: string[];
  prep_minutes: number | null;
  total_minutes: number | null;
  servings: number | null;
  status: "loading" | "ready" | "failed";
};

const DECK_LIMIT = 20;

export const Route = createFileRoute("/app/swipe")({
  validateSearch: z.object({
    mode: z.enum(["cook"]).default("cook"),
  }),
  component: SwipePage,
});

function safeImage(url: string | null | undefined): string {
  if (!url) return placeholderImg;
  if (!/^https?:\/\//i.test(url)) return placeholderImg;
  return url;
}

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

function isGlutenFree(meal: Meal): boolean {
  const tags = (Array.isArray(meal.tags) ? meal.tags : []).map((t) => t?.toLowerCase() ?? "");
  const flags = (Array.isArray(meal.health_flags) ? meal.health_flags : []).map((t) => t?.toLowerCase() ?? "");
  if (tags.some((t) => t.includes("gluten-free") || t.includes("gluten free")) ||
      flags.some((t) => t.includes("gluten-free") || t.includes("gluten free"))) {
    return true;
  }
  // Heuristic: exclude if obvious wheat/gluten in ingredients
  const ings = (Array.isArray(meal.ingredients) ? meal.ingredients : []) as Array<{ name?: string }>;
  const text = ings.map((i) => (i?.name ?? "").toLowerCase()).join(" ");
  return !/(wheat|flour|bread|pasta|noodle|barley|rye|couscous|tortilla|bun|pizza dough)/.test(text);
}

// Score meals by user's past swipes (cuisine + tags overlap)
function scoreMeals(meals: Meal[], likes: Meal[], dislikes: Meal[]): Meal[] {
  if (likes.length === 0 && dislikes.length === 0) return meals;
  const likedCuisines = new Map<string, number>();
  const likedTags = new Map<string, number>();
  const dislikedCuisines = new Map<string, number>();
  const dislikedTags = new Map<string, number>();
  for (const m of likes) {
    if (m.cuisine) likedCuisines.set(m.cuisine.toLowerCase(), (likedCuisines.get(m.cuisine.toLowerCase()) ?? 0) + 1);
    for (const t of Array.isArray(m.tags) ? m.tags : []) {
      const k = (t ?? "").toLowerCase();
      if (k) likedTags.set(k, (likedTags.get(k) ?? 0) + 1);
    }
  }
  for (const m of dislikes) {
    if (m.cuisine) dislikedCuisines.set(m.cuisine.toLowerCase(), (dislikedCuisines.get(m.cuisine.toLowerCase()) ?? 0) + 1);
    for (const t of Array.isArray(m.tags) ? m.tags : []) {
      const k = (t ?? "").toLowerCase();
      if (k) dislikedTags.set(k, (dislikedTags.get(k) ?? 0) + 1);
    }
  }
  return [...meals]
    .map((m) => {
      let score = 0;
      const cuisine = m.cuisine?.toLowerCase() ?? "";
      if (cuisine) score += (likedCuisines.get(cuisine) ?? 0) * 3 - (dislikedCuisines.get(cuisine) ?? 0) * 2;
      for (const t of Array.isArray(m.tags) ? m.tags : []) {
        const k = (t ?? "").toLowerCase();
        if (!k) continue;
        score += (likedTags.get(k) ?? 0) - (dislikedTags.get(k) ?? 0);
      }
      score += Math.random() * 0.5; // jitter
      return { m, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.m);
}

type SlotName = "breakfast" | "lunch" | "dinner" | "dessert";

function readFilters(): { slot: SlotName; userChanged: boolean; gfOnly: boolean } {
  let filter: SlotName | null = null;
  let userChanged = false;
  let gfOnly = false;
  try {
    const raw = sessionStorage.getItem("swipebite.mealTimeFilter");
    if (raw) {
      const parsed = JSON.parse(raw) as { value: SlotName; userChanged: boolean };
      filter = parsed.value;
      userChanged = parsed.userChanged;
    }
    gfOnly = sessionStorage.getItem("swipebite.glutenFreeOnly") === "1";
  } catch {
    // ignore
  }
  const h = new Date().getHours();
  const defaultSlot: SlotName = h >= 3 && h < 12 ? "breakfast" : h >= 12 && h < 18 ? "lunch" : "dinner";
  return { slot: filter ?? defaultSlot, userChanged, gfOnly };
}

function cacheKey(userId: string, mode: string, slot: SlotName, gf: boolean): string {
  return `swipebite.deck.${userId}.${mode}.${slot}.${gf ? "gf" : "all"}`;
}

function SwipePage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const [deck, setDeck] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<{ meal: Meal; direction: "left" | "right"; swipeId?: string; matchId?: string }[]>([]);
  const [matchMeal, setMatchMeal] = useState<Meal | null>(null);
  const [filterKey, setFilterKey] = useState(() => {
    const f = typeof window !== "undefined" ? readFilters() : { slot: "dinner" as SlotName, gfOnly: false, userChanged: false };
    return `${f.slot}|${f.gfOnly ? 1 : 0}`;
  });
  const lockRef = useRef(false);

  // Re-evaluate filters when window regains focus (e.g., user toggled on /app/mode then came back)
  useEffect(() => {
    function refresh() {
      const f = readFilters();
      setFilterKey(`${f.slot}|${f.gfOnly ? 1 : 0}`);
    }
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, []);

  // Load deck: meals not yet swiped by this user, cached per (slot, gf)
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const { slot, userChanged, gfOnly } = readFilters();
    const key = cacheKey(userId, mode, slot, gfOnly);

    // Try cached deck first — show it instantly
    let cachedIds: string[] | null = null;
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) cachedIds = JSON.parse(raw) as string[];
    } catch {
      // ignore
    }

    (async () => {
      if (!cachedIds) setLoading(true);
      const [{ data: swipes }, { data: meals, error }] = await Promise.all([
        supabase
          .from("swipes")
          .select("meal_id, direction, meals(*)")
          .eq("user_id", userId)
          .eq("mode", mode),
        supabase.from("meals").select("*").eq("is_alcohol", false).limit(500),
      ]);
      if (error) {
        toast.error("Couldn't load meals");
        setLoading(false);
        return;
      }
      const swipedIds = new Set((swipes || []).map((s) => s.meal_id));
      const likes: Meal[] = [];
      const dislikes: Meal[] = [];
      for (const s of swipes || []) {
        const m = (s as unknown as { meals: Meal | null }).meals;
        if (!m) continue;
        if ((s as { direction: string }).direction === "right") likes.push(m);
        else dislikes.push(m);
      }

      let all = (meals || []).filter((m) => !swipedIds.has(m.id));
      if (gfOnly) all = all.filter(isGlutenFree);

      const matchesSlot = (m: Meal) => {
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

      const slotMatched = all.filter(matchesSlot);
      let fresh = slotMatched.length >= 5
        ? slotMatched
        : userChanged && slotMatched.length > 0
          ? slotMatched
          : slotMatched.length === 0
            ? all
            : slotMatched;

      fresh = scoreMeals(fresh, likes, dislikes).slice(0, DECK_LIMIT);

      // If we have a cached deck, prefer its order so the user keeps swiping the
      // same set; otherwise persist the freshly computed order.
      if (cachedIds && cachedIds.length > 0) {
        const byId = new Map(fresh.map((m) => [m.id, m]));
        const ordered = cachedIds.map((id) => byId.get(id)).filter((m): m is Meal => Boolean(m));
        // Append any new meals not yet cached
        const cachedSet = new Set(cachedIds);
        for (const m of fresh) if (!cachedSet.has(m.id)) ordered.push(m);
        fresh = ordered.slice(0, DECK_LIMIT);
      }

      try {
        sessionStorage.setItem(key, JSON.stringify(fresh.map((m) => m.id)));
      } catch {
        // ignore
      }

      // Preload ALL 20 card images up-front so every slide is instant
      const urls = fresh.map((m) => safeImage(m.image_url));
      await Promise.all(urls.map(preloadImage));

      if (!cancelled) {
        setDeck(fresh);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, mode, filterKey]);

  async function commitSwipe(meal: Meal, direction: "left" | "right") {
    if (!userId) return;
    const { data: swipeRow } = await supabase
      .from("swipes")
      .insert({ user_id: userId, meal_id: meal.id, mode, direction })
      .select("id")
      .single();
    let matchId: string | undefined;
    if (direction === "right") {
      const { data: matchRow } = await supabase
        .from("matches")
        .insert({ user_id: userId, meal_id: meal.id, mode })
        .select("id")
        .single();
      matchId = matchRow?.id;
      setMatchMeal(meal);
    }
    setHistory((h) => [...h, { meal, direction, swipeId: swipeRow?.id, matchId }].slice(-10));
  }

  function handleSwipe(direction: "left" | "right") {
    if (lockRef.current || deck.length === 0) return;
    lockRef.current = true;
    const top = deck[deck.length - 1];
    setDeck((d) => d.slice(0, -1));
    void commitSwipe(top, direction).finally(() => {
      lockRef.current = false;
    });
  }

  async function handleRewind() {
    const last = history[history.length - 1];
    if (!last) {
      toast("Nothing to rewind");
      return;
    }
    setHistory((h) => h.slice(0, -1));
    setDeck((d) => [...d, last.meal]);
    if (!userId) return;
    if (last.swipeId)
      await supabase.from("swipes").delete().eq("id", last.swipeId).eq("user_id", userId);
    if (last.matchId)
      await supabase.from("matches").delete().eq("id", last.matchId).eq("user_id", userId);
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-20 text-muted-foreground">
        Loading meals…
      </div>
    );
  }

  if (deck.length === 0 && !matchMeal) {
    return (
      <div className="py-12 text-center">
        <div
          className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl text-white"
          style={{ background: "var(--gradient-warm)" }}
        >
          <Sparkles />
        </div>
        <h1 className="text-2xl font-bold">You've seen them all!</h1>
        <p className="mt-2 text-muted-foreground">
          Check your matches or come back later for more.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={() => navigate({ to: "/app/matches" })}>View matches</Button>
          <Button variant="outline" onClick={() => navigate({ to: "/app/mode" })}>
            Change mode
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative pt-2 pb-32">
      <div className="mb-3 flex items-center justify-end text-xs text-muted-foreground">
        <span>{deck.length} left</span>
      </div>

      <div className="relative mx-auto h-[600px] w-full max-w-sm">
        {deck.slice(-3).map((meal, idx, arr) => {
          const isTop = idx === arr.length - 1;
          const offset = arr.length - 1 - idx;
          return (
            <SwipeCard
              key={meal.id}
              meal={meal}
              offset={offset}
              isTop={isTop}
              onSwipe={handleSwipe}
            />
          );
        })}
      </div>

      <div className="mx-auto mt-6 flex max-w-sm items-center justify-center gap-3">
        <ActionBtn label="Nope" onClick={() => handleSwipe("left")}>
          <X size={22} />
        </ActionBtn>
        <ActionBtn label="Rewind" variant="ghost" onClick={handleRewind}>
          <Undo2 size={18} />
        </ActionBtn>
        <ActionBtn label="Yum" variant="primary" onClick={() => handleSwipe("right")}>
          <Heart size={22} />
        </ActionBtn>
      </div>

      <AnimatePresence>
        {matchMeal && (
          <MatchOverlay
            meal={matchMeal}
            mode={mode}
            onClose={() => setMatchMeal(null)}
            onView={() => {
              setMatchMeal(null);
              const lastMatch = history[history.length - 1];
              if (lastMatch?.matchId) {
                navigate({ to: "/app/match/$id", params: { id: lastMatch.matchId } });
              } else {
                navigate({ to: "/app/matches" });
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SwipeCard({
  meal,
  offset,
  isTop,
  onSwipe,
}: {
  meal: Meal;
  offset: number;
  isTop: boolean;
  onSwipe: (dir: "left" | "right") => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-15, 0, 15]);

  const enrich = useServerFn(enrichMealRecipe);
  const [recipe, setRecipe] = useState<RecipePreview>({
    image_url: meal.image_url,
    ingredients: [],
    steps: [],
    prep_minutes: meal.prep_minutes,
    total_minutes: null,
    servings: null,
    status: "loading",
  });
  const [imgSrc, setImgSrc] = useState<string>(safeImage(meal.image_url));

  useEffect(() => {
    if (offset > 1) return;
    let cancelled = false;
    (async () => {
      try {
        const gfOnly = typeof window !== "undefined" && sessionStorage.getItem("swipebite.glutenFreeOnly") === "1";
        const res = await enrich({ data: { mealId: meal.id, glutenFree: gfOnly } });
        if (cancelled) return;
        if (res.recipe) {
          const newUrl = res.recipe.image_url ?? meal.image_url;
          setRecipe({
            image_url: newUrl,
            ingredients: res.recipe.ingredients ?? [],
            steps: res.recipe.steps ?? [],
            prep_minutes: res.recipe.prep_minutes ?? meal.prep_minutes,
            total_minutes: res.recipe.total_minutes,
            servings: res.recipe.servings,
            status: "ready",
          });
          if (newUrl && /^https?:\/\//.test(newUrl)) {
            // preload before swap to avoid flash
            await preloadImage(newUrl);
            if (!cancelled) setImgSrc(newUrl);
          }
        } else {
          setRecipe((r) => ({ ...r, status: "failed" }));
        }
      } catch {
        if (!cancelled) setRecipe((r) => ({ ...r, status: "failed" }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [meal.id, offset, enrich, meal.image_url, meal.prep_minutes]);

  function onDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const threshold = 110;
    if (info.offset.x > threshold) onSwipe("right");
    else if (info.offset.x < -threshold) onSwipe("left");
  }

  const scale = 1 - offset * 0.04;
  const y = offset * 10;
  const spice = getSpiceLevel(meal);

  return (
    <motion.div
      className="absolute inset-0 cursor-grab overflow-hidden rounded-3xl bg-card active:cursor-grabbing"
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        scale,
        y,
        zIndex: 10 - offset,
        boxShadow: "var(--shadow-card)",
        touchAction: "none",
      }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.7}
      onDragEnd={onDragEnd}
    >
      {/* Real <img> so browser surfaces load state and onError works */}
      <img
        src={imgSrc}
        alt={meal.name}
        loading={offset === 0 ? "eager" : "lazy"}
        className="absolute inset-0 h-full w-full object-cover"
        onError={() => setImgSrc(placeholderImg)}
      />

      {/* Affordability + spice chips */}
      <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-1.5">
        <div className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[10px] font-medium uppercase text-white backdrop-blur">
          <Flame size={12} /> {meal.affordability ?? "$$"}
        </div>
        <div
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium uppercase text-white backdrop-blur ${
            spice === "Very spicy" ? "bg-red-600/80" : spice === "Med" ? "bg-orange-500/80" : "bg-emerald-600/70"
          }`}
        >
          🌶 {spice}
        </div>
      </div>

      {/* Bottom gradient + content overlay */}
      <div className="absolute inset-x-0 bottom-0 max-h-[70%] overflow-hidden bg-gradient-to-t from-black/95 via-black/75 to-transparent p-5 pt-16 text-white">
        <h2 className="font-display text-2xl font-extrabold leading-tight drop-shadow">
          {meal.name}
        </h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] opacity-95">
          {meal.cuisine && <span>{meal.cuisine}</span>}
          {(recipe.total_minutes ?? recipe.prep_minutes) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 backdrop-blur">
              <Clock size={10} /> {recipe.total_minutes ?? recipe.prep_minutes}m
            </span>
          )}
          {recipe.servings && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 backdrop-blur">
              <Users size={10} /> {recipe.servings}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ActionBtn({
  children,
  onClick,
  label,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  variant?: "default" | "primary" | "ghost";
}) {
  const styles =
    variant === "primary"
      ? { background: "var(--gradient-warm)", color: "white", boxShadow: "var(--shadow-romantic)" }
      : variant === "ghost"
        ? { background: "transparent", color: "var(--muted-foreground)" }
        : { background: "var(--card)", color: "var(--foreground)", boxShadow: "var(--shadow-card)" };
  const size = variant === "ghost" ? "h-11 w-11" : "h-14 w-14";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`grid ${size} place-items-center rounded-full transition-transform active:scale-90`}
      style={styles}
    >
      {children}
    </button>
  );
}

function MatchOverlay({
  meal,
  mode,
  onClose,
  onView,
}: {
  meal: Meal;
  mode: "cook";
  onClose: () => void;
  onView: () => void;
}) {
  const ingredients = useMemo(() => {
    const arr = (meal.ingredients as Array<{ name: string; measure?: string }>) || [];
    return arr.slice(0, 6);
  }, [meal.ingredients]);
  const [bgImg, setBgImg] = useState<string>(safeImage(meal.image_url));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center p-5"
      style={{ background: "color-mix(in oklab, var(--primary) 35%, black 65%)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.85, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 240 }}
        className="w-full max-w-sm overflow-hidden rounded-3xl bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-56 w-full overflow-hidden">
          <img
            src={bgImg}
            alt={meal.name}
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setBgImg(placeholderImg)}
          />
          <div className="absolute inset-0" style={{ background: "var(--gradient-warm)", mixBlendMode: "multiply", opacity: 0.45 }} />
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center text-white">
              <Heart className="mx-auto mb-2" fill="white" />
              <h3 className="text-3xl font-extrabold tracking-tight">It's a match!</h3>
            </div>
          </div>
        </div>
        <div className="p-5">
          <h4 className="text-xl font-bold">{meal.name}</h4>
          {meal.cuisine && (
            <p className="mt-0.5 text-sm text-muted-foreground">{meal.cuisine}</p>
          )}
          {ingredients.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">You'll need</p>
              <ul className="mt-1 grid grid-cols-2 gap-1 text-sm">
                {ingredients.map((ing, i) => (
                  <li key={i} className="truncate">
                    • {ing.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Keep swiping
            </Button>
            <Button
              className="flex-1"
              style={{ background: "var(--gradient-warm)", color: "white" }}
              onClick={onView}
            >
              View match
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
