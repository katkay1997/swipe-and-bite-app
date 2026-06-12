import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Utensils, Trash2, Flame } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { estimateMealNutrition } from "@/lib/match.functions";

type PinRow = Tables<"pins"> & { meal: Tables<"meals"> | null };
type Nutrition = {
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
};

export const Route = createFileRoute("/app/ate")({
  component: AtePage,
});

function mealSlotForDate(d: Date): "breakfast" | "lunch" | "dinner" {
  const h = d.getHours();
  if (h >= 5 && h < 12) return "breakfast";
  if (h >= 12 && h < 18) return "lunch";
  return "dinner";
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function hasNutrition(n: unknown): n is Nutrition {
  return !!n && typeof n === "object" && typeof (n as Nutrition).calories === "number";
}

function AtePage() {
  const { userId } = useAuth();
  const estimate = useServerFn(estimateMealNutrition);
  const [rows, setRows] = useState<PinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [estimates, setEstimates] = useState<Record<string, Nutrition>>({});
  const [estimating, setEstimating] = useState(false);

  const [matchIdByMeal, setMatchIdByMeal] = useState<Record<string, string>>({});
  const [recipeImageByMeal, setRecipeImageByMeal] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [{ data: pinsData }, { data: matchesData }] = await Promise.all([
        supabase
          .from("pins")
          .select("*, meal:meals(*)")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase.from("matches").select("id, meal_id").eq("user_id", userId),
      ]);
      const pins = (pinsData as PinRow[]) || [];
      setRows(pins);
      const map: Record<string, string> = {};
      for (const m of matchesData || []) if (m.meal_id) map[m.meal_id] = m.id;
      setMatchIdByMeal(map);

      const mealIds = Array.from(new Set(pins.map((p) => p.meal_id).filter(Boolean) as string[]));
      if (mealIds.length > 0) {
        const { data: recipes } = await supabase
          .from("recipes")
          .select("meal_id, image_url")
          .in("meal_id", mealIds);
        const rmap: Record<string, string> = {};
        for (const r of recipes || []) {
          if (r.meal_id && r.image_url) rmap[r.meal_id] = r.image_url;
        }
        setRecipeImageByMeal(rmap);
      }
      setLoading(false);
    })();
  }, [userId]);


  const today = useMemo(() => rows.filter((r) => isToday(r.created_at)), [rows]);

  // Estimate nutrition for today's meals that don't have it yet
  useEffect(() => {
    if (today.length === 0) return;
    const missing = today.filter(
      (r) => r.meal && !hasNutrition(r.meal.nutrition) && !estimates[r.meal.id],
    );
    if (missing.length === 0) return;
    let cancelled = false;
    setEstimating(true);
    (async () => {
      for (const r of missing) {
        if (cancelled || !r.meal) break;
        try {
          const res = await estimate({ data: { mealId: r.meal.id } });
          if (!cancelled && res.nutrition) {
            setEstimates((prev) => ({ ...prev, [r.meal!.id]: res.nutrition as Nutrition }));
          }
        } catch {
          // ignore individual failures
        }
      }
      if (!cancelled) setEstimating(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [today, estimate, estimates]);

  const totals = useMemo(() => {
    const acc = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    for (const r of today) {
      if (!r.meal) continue;
      const n = hasNutrition(r.meal.nutrition)
        ? (r.meal.nutrition as Nutrition)
        : estimates[r.meal.id];
      if (!n) continue;
      acc.calories += Math.round(n.calories ?? 0);
      acc.protein += Math.round(n.protein_g ?? 0);
      acc.carbs += Math.round(n.carbs_g ?? 0);
      acc.fat += Math.round(n.fat_g ?? 0);
    }
    return acc;
  }, [today, estimates]);

  const grouped = useMemo(() => {
    const g: Record<"breakfast" | "lunch" | "dinner", PinRow[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
    };
    for (const r of today) g[mealSlotForDate(new Date(r.created_at))].push(r);
    return g;
  }, [today]);

  async function remove(id: string) {
    if (!userId) return;
    await supabase.from("pins").delete().eq("id", id).eq("user_id", userId);
    setRows((r) => r.filter((x) => x.id !== id));
    toast.success("Removed");
  }

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading…</div>;

  if (rows.length === 0) {
    return (
      <div className="py-12 text-center">
        <Utensils className="mx-auto mb-3" style={{ color: "hsl(350 90% 48%)" }} />
        <h1 className="font-display text-3xl font-black tracking-tight">
          Nothing eaten <span className="italic text-romance">yet</span>
        </h1>
        <p className="mt-2" style={{ color: "var(--romance-muted-fg)" }}>
          Open a match and tap "Ate" to log it here.
        </p>
        <Link to="/app/matches" className="mt-5 inline-block">
          <Button size="lg" className="rounded-full">View matches</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="py-6">
      <h1 className="font-display text-4xl font-black tracking-tight text-balance">
        What you <span className="italic text-romance">ate</span>
      </h1>
      <p className="mt-1 text-sm" style={{ color: "var(--romance-muted-fg)" }}>
        {today.length} today
      </p>

      <section
        className="mt-4 rounded-2xl p-4 text-white"
        style={{ background: "var(--gradient-warm)", boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide opacity-90">Today</h2>
          <Flame size={14} className="opacity-90" />
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2 text-center">
          <Stat label="cal" value={totals.calories.toString()} />
          <Stat label="protein" value={`${totals.protein}g`} />
          <Stat label="carbs" value={`${totals.carbs}g`} />
          <Stat label="fat" value={`${totals.fat}g`} />
        </div>
        {today.length === 0 ? (
          <p className="mt-2 text-xs opacity-90">Log a meal today to see your totals.</p>
        ) : estimating ? (
          <p className="mt-2 text-xs opacity-90">Estimating nutrition…</p>
        ) : null}
      </section>

      {today.length > 0 && (
        <div className="mt-6 space-y-5">
          {(["breakfast", "lunch", "dinner"] as const).map((slot) =>
            grouped[slot].length > 0 ? (
              <section key={slot}>
                <h3 className="mb-2 text-sm font-semibold capitalize text-muted-foreground">
                  {slot}
                </h3>
                <PinGrid rows={grouped[slot]} onRemove={remove} matchIdByMeal={matchIdByMeal} recipeImageByMeal={recipeImageByMeal} />
              </section>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/15 p-2 backdrop-blur">
      <div className="text-lg font-bold leading-tight">{value}</div>
      <div className="text-[10px] uppercase tracking-wide opacity-90">{label}</div>
    </div>
  );
}

function PinGrid({
  rows,
  onRemove,
  matchIdByMeal,
  recipeImageByMeal,
}: {
  rows: PinRow[];
  onRemove: (id: string) => void;
  matchIdByMeal: Record<string, string>;
  recipeImageByMeal: Record<string, string>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((p) => {
        const matchId = p.meal_id ? matchIdByMeal[p.meal_id] : undefined;
        const imgSrc =
          (p.meal_id ? recipeImageByMeal[p.meal_id] : undefined) ||
          p.meal?.image_url ||
          "/meal-placeholder.jpg";
        const content = (
          <>
            <img
              src={imgSrc}
              alt={p.meal?.name ?? "Meal"}
              loading="lazy"
              className="h-40 w-full object-cover bg-muted"
              onError={(e) => {
                const el = e.currentTarget;
                if (el.src.endsWith("/meal-placeholder.jpg")) return;
                el.src = "/meal-placeholder.jpg";
              }}
            />
            <div className="p-3">
              <h3 className="font-semibold leading-tight">{p.meal?.name ?? "Meal"}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{p.meal?.cuisine}</p>
            </div>
          </>
        );

        return (
          <article
            key={p.id}
            className="group relative overflow-hidden rounded-2xl bg-card"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            {matchId ? (
              <Link
                to="/app/match/$id"
                params={{ id: matchId }}
                className="block"
                aria-label={`Open ${p.meal?.name ?? "match"}`}
              >
                {content}
              </Link>
            ) : (
              content
            )}
            <button
              type="button"
              aria-label="Remove"
              onClick={() => onRemove(p.id)}
              className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <Trash2 size={14} />
            </button>
          </article>
        );
      })}
    </div>
  );
}
