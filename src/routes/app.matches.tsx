import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, Trash2, Clock, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type MatchRow = Tables<"matches"> & { meal: Tables<"meals"> | null };

export const Route = createFileRoute("/app/matches")({
  component: MatchesPage,
});

type MealTime = "breakfast" | "lunch" | "dinner" | "dessert";
const STORAGE_KEY = "swipebite.mealTimeFilter";

const CAT_EMOJI: Record<MealTime, string> = {
  breakfast: "🌅",
  lunch: "☀️",
  dinner: "🌙",
  dessert: "🍰",
};

function MatchesPage() {
  const { userId } = useAuth();
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<MealTime | null>(null);
  const [recipeImageByMeal, setRecipeImageByMeal] = useState<Record<string, string>>({});

  // Read meal-time filter set by the slider on the mode page.
  // Only applied when the user explicitly changed it.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { value: MealTime; userChanged: boolean };
        setFilter(parsed.userChanged ? parsed.value : null);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    const uid = userId;
    void load();
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("matches")
        .select("*, meal:meals(*)")
        .eq("user_id", uid)
        .eq("archived", false)
        .eq("mode", "cook")
        .order("matched_at", { ascending: false });
      const rowsData = (data as MatchRow[]) || [];
      setRows(rowsData);

      const mealIds = Array.from(new Set(rowsData.map((r) => r.meal?.id).filter(Boolean) as string[]));
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
    }
  }, [userId]);

  async function remove(id: string) {
    if (!userId) return;
    await supabase.from("matches").delete().eq("id", id).eq("user_id", userId);
    setRows((r) => r.filter((x) => x.id !== id));
    toast.success("Removed");
  }

  async function clearAll() {
    if (!userId) return;
    const { error } = await supabase.from("matches").delete().eq("user_id", userId);
    if (error) {
      toast.error("Couldn't clear matches");
      return;
    }
    setRows([]);
    toast.success("All matches cleared");
  }

  const visibleRows = filter
    ? rows.filter((r) => {
        if (!r.meal) return false;
        const times = Array.isArray(r.meal.meal_time) ? r.meal.meal_time : [];
        const tags = Array.isArray(r.meal.tags) ? r.meal.tags : [];
        if (filter === "dessert") {
          // Dessert = anything tagged/categorized as dessert; available all day.
          return (
            times.includes("dessert") ||
            tags.some((t) => t?.toLowerCase().includes("dessert")) ||
            r.meal.cuisine?.toLowerCase().includes("dessert")
          );
        }
        return times.includes(filter);
      })
    : rows;

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading…</div>;

  if (rows.length === 0) {
    return (
      <div className="py-6">
        <h1 className="font-display text-3xl font-black tracking-tight">Your matches</h1>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">Swipe recipes to fill these up!</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["breakfast", "lunch", "dinner", "dessert"] as const).map((cat) => (
            <Link key={cat} to="/app/mode">
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-accent/40 p-6 text-center min-h-[160px] hover:border-primary transition-colors cursor-pointer">
                <span className="text-3xl mb-2 opacity-50">{CAT_EMOJI[cat]}</span>
                <p className="text-sm text-muted-foreground capitalize">Swipe {cat} recipes</p>
                <p className="text-xs font-bold text-primary mt-1">Start swiping →</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black tracking-tight">Your matches</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filter ? (
              <>
                Showing <span className="font-semibold capitalize text-primary">{filter}</span> · {visibleRows.length} of {rows.length}
              </>
            ) : (
              <>{rows.length} saved meals</>
            )}
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-full">
              <Trash2 size={14} /> Clear all
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all matches?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes every match. You can't undo this.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={clearAll}>Clear all</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {filter && visibleRows.length === 0 ? (
        <Link to="/app/mode" className="mt-5 block">
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-accent/40 p-8 text-center hover:border-primary transition-colors cursor-pointer">
            <span className="text-4xl mb-3 opacity-50">{CAT_EMOJI[filter]}</span>
            <p className="text-sm text-muted-foreground">
              Swipe some <span className="font-semibold capitalize text-primary">{filter}</span> recipes to fill this up!
            </p>
            <p className="mt-2 text-xs font-bold text-primary">Go to Match →</p>
          </div>
        </Link>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {visibleRows.map((m) => (
            <article
              key={m.id}
              className="group relative overflow-hidden rounded-2xl bg-card shadow-card"
            >
              <Link
                to="/app/match/$id"
                params={{ id: m.id }}
                className="block"
                aria-label={`Open ${m.meal?.name ?? "match"}`}
              >
                {m.meal?.image_url && (
                  <div
                    className="h-40 w-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${recipeImageByMeal[m.meal.id] || m.meal.image_url})` }}
                  />
                )}
                <div className="flex items-center justify-between p-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-lg font-bold leading-tight">
                      {m.meal?.name ?? "Meal"}
                    </h3>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      {m.meal?.cuisine && <span className="truncate">{m.meal.cuisine}</span>}
                      {m.meal?.prep_minutes && (
                        <span className="inline-flex items-center gap-1">
                          <Clock size={11} /> {m.meal.prep_minutes}m
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
                </div>
              </Link>
              <button
                type="button"
                aria-label="Remove match"
                onClick={() => remove(m.id)}
                className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Trash2 size={14} />
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
