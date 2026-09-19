import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Clock,
  Flame,
  ChefHat,
  Loader2,
  Search,
  Utensils,
  Store,
  ExternalLink,
  Users,
  Wrench,
  ShieldAlert,
  ShieldCheck,
  MessageCircleHeart,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { searchGroceryStores } from "@/lib/match.functions";
import { enrichMealRecipe } from "@/lib/recipe.functions";
import {
  getSpiceLevel,
  getCulinaryLevel,
  getEquipment,
  getSweetMessage,
  summarizeAllergies,
  unwrapMealRecipe,
  type MealWithRecipe,
  type Recipe as DbRecipeRow,
} from "@/lib/meal-helpers";

type MatchRow = Tables<"matches"> & {
  meal: (Tables<"meals"> & { recipes: DbRecipeRow | DbRecipeRow[] | null }) | null;
};
type RecipeData = {
  image_url: string | null;
  source_url: string | null;
  source_domain: string | null;
  title: string | null;
  summary: string | null;
  ingredients: string[];
  steps: string[];
  prep_minutes: number | null;
  cook_minutes: number | null;
  total_minutes: number | null;
  servings: number | null;
};

function toRecipeData(r: DbRecipeRow): RecipeData {
  return {
    image_url: r.image_url,
    source_url: r.source_url,
    source_domain: r.source_domain,
    title: r.title,
    summary: r.summary,
    ingredients: Array.isArray(r.ingredients)
      ? (r.ingredients as string[]).filter((x): x is string => typeof x === "string")
      : [],
    steps: Array.isArray(r.steps)
      ? (r.steps as string[]).filter((x): x is string => typeof x === "string")
      : [],
    prep_minutes: r.prep_minutes,
    cook_minutes: r.cook_minutes,
    total_minutes: r.total_minutes,
    servings: r.servings,
  };
}

export const Route = createFileRoute("/app/match/$id")({
  component: MatchDetailPage,
});

function MatchDetailPage() {
  const { id } = Route.useParams();
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [userAllergies, setUserAllergies] = useState<string[]>([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      const [{ data }, { data: prefs }] = await Promise.all([
        supabase
          .from("matches")
          .select("*, meal:meals!inner(*, recipes!inner(*))")
          .eq("id", id)
          .eq("user_id", userId)
          .maybeSingle(),
        supabase.from("preferences").select("allergies").eq("user_id", userId).maybeSingle(),
      ]);
      setMatch((data as MatchRow) ?? null);
      setUserAllergies((prefs?.allergies as string[] | null) ?? []);
      setLoading(false);
    })();
  }, [userId, id]);

  if (loading) {
    return (
      <div className="grid place-items-center py-20 text-muted-foreground">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!match || !match.meal) {
    return (
      <div className="py-12 text-center">
        <h1 className="font-display text-2xl font-bold">Match not found</h1>
        <Button className="mt-4 rounded-full" onClick={() => navigate({ to: "/app/matches" })}>
          Back to matches
        </Button>
      </div>
    );
  }

  const meal = match.meal;
  const paired = unwrapMealRecipe(meal);
  if (!paired) {
    return (
      <div className="py-12 text-center">
        <h1 className="font-display text-2xl font-bold">Recipe not found</h1>
        <Button className="mt-4 rounded-full" onClick={() => navigate({ to: "/app/matches" })}>
          Back to matches
        </Button>
      </div>
    );
  }

  async function markAte() {
    if (!paired || !userId) return;
    const { error } = await supabase
      .from("pins")
      .upsert(
        { user_id: userId, meal_id: paired.id },
        { onConflict: "user_id,meal_id", ignoreDuplicates: true }
      );
    if (error) {
      console.error(error);
      console.error("PIN INSERT ERROR:", error);
      toast.error("Couldn't log it");
      return;
    }
    toast.success("Logged to Ate");
    navigate({ to: "/app/ate" });
  }

  return (
    <div className="pb-20">
      <RecipeHeader
        meal={paired}
        userAllergies={userAllergies}
        onBack={() => navigate({ to: "/app/matches" })}
        onAte={markAte}
      />
    </div>
  );
}

function RecipeHeader({
  meal,
  userAllergies,
  onBack,
  onAte,
}: {
  meal: MealWithRecipe;
  userAllergies: string[];
  onBack: () => void;
  onAte: () => void;
}) {
  const enrich = useServerFn(enrichMealRecipe);
  const [recipe, setRecipe] = useState<RecipeData>(() => toRecipeData(meal.recipes));
  const [recipeLoading, setRecipeLoading] = useState(meal.recipes.enrichment_status !== "ready");

  useEffect(() => {
    console.log("RECIPE EFFECT FIRING", meal.id);
    // Paired recipe is already ready — skip enrichment network path.
    if (meal.recipes.enrichment_status === "ready") {
      setRecipe(toRecipeData(meal.recipes));
      setRecipeLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setRecipeLoading(true);
      try {
        console.log("ABOUT TO CALL ENRICH");
        const gfOnly = typeof window !== "undefined" && sessionStorage.getItem("swipebite.glutenFreeOnly") === "1";
        const res = await enrich({ data: { mealId: meal.id, glutenFree: gfOnly } });
        console.log("ENRICH RESPONSE:", res);
        if (!cancelled && res.recipe) {
          setRecipe({
            image_url: res.recipe.image_url,
            source_url: res.recipe.source_url,
            source_domain: res.recipe.source_domain,
            title: res.recipe.title,
            summary: res.recipe.summary,
            ingredients: res.recipe.ingredients ?? [],
            steps: res.recipe.steps ?? [],
            prep_minutes: res.recipe.prep_minutes,
            cook_minutes: res.recipe.cook_minutes,
            total_minutes: res.recipe.total_minutes,
            servings: res.recipe.servings,
          });
        } else if (!cancelled) {
          // Always keep the paired recipes row visible.
          setRecipe(toRecipeData(meal.recipes));
        }
      } finally {
        if (!cancelled) setRecipeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [meal.id, enrich, meal.recipes]);

  const heroImage = recipe.image_url || meal.image_url;
  const totalMinutes = recipe.total_minutes ?? recipe.prep_minutes ?? meal.prep_minutes;
  const spice = getSpiceLevel(meal);
  const allergyInfo = useMemo(
    () =>
      summarizeAllergies(
        userAllergies,
        recipe.ingredients ?? [],
        `${meal.name ?? ""} ${meal.cuisine ?? ""} ${meal.instructions ?? ""}`,
      ),
    [userAllergies, recipe.ingredients, meal.name, meal.cuisine, meal.instructions],
  );

  return (
    <>
      <div className="-mx-4 sm:mx-0">
        <div
          className="relative h-72 w-full bg-cover bg-center sm:rounded-3xl"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent sm:rounded-3xl" />
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="absolute inset-x-0 bottom-0 p-5 text-white">
            <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide backdrop-blur">
              <ChefHat size={12} /> Cook your match
            </div>
            <h1 className="font-display text-3xl font-black leading-tight">{meal.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs opacity-95">
              {meal.cuisine && <span>{meal.cuisine}</span>}
              {totalMinutes && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5">
                  <Clock size={12} /> {totalMinutes} min
                </span>
              )}
              {recipe.servings && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5">
                  <Users size={12} /> serves {recipe.servings}
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5">
                <Flame size={12} /> {meal.affordability ?? "$$"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5">
                🌶 {spice}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Allergy chip row */}
      {userAllergies.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 px-1">
          {allergyInfo.has.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 dark:bg-red-950 dark:text-red-200">
              <ShieldAlert size={12} /> Has {allergyInfo.has.join(" & ")}
            </span>
          )}
          {allergyInfo.free.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
              <ShieldCheck size={12} /> {allergyInfo.free.map((f) => `${f}-free`).join(", ")}
            </span>
          )}
        </div>
      )}

      <div className="mt-4 px-1">
        <Button onClick={onAte} size="lg" className="w-full gap-2 rounded-full">
          <Utensils size={16} /> Ate it
        </Button>
      </div>

      <CookView meal={meal} recipe={recipe} recipeLoading={recipeLoading} />
    </>
  );
}

function CookView({
  meal,
  recipe,
  recipeLoading,
}: {
  meal: MealWithRecipe;
  recipe: RecipeData;
  recipeLoading: boolean;
}) {
  const ingredients = recipe.ingredients ?? [];
  const culinary = getCulinaryLevel(
    recipe.total_minutes ?? recipe.prep_minutes ?? meal.prep_minutes,
    ingredients.length,
  );
  const equipment = getEquipment(meal);
  const sweet = getSweetMessage(meal.id);

  return (
    <div className="mt-5 space-y-5 px-1">
      {/* Sweet message bubble */}
      <div className="relative mx-auto max-w-md rounded-2xl bg-card px-4 py-3 shadow-card">
        <div className="flex items-start gap-2">
          <div
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white"
            style={{ background: "var(--gradient-warm)" }}
          >
            <MessageCircleHeart size={16} />
          </div>
          <p className="text-sm italic text-foreground/85">"{sweet}"</p>
        </div>
        <span
          className="absolute -bottom-2 left-8 h-3 w-3 rotate-45 bg-card"
          aria-hidden
          style={{ boxShadow: "var(--shadow-card)" }}
        />
      </div>

      {recipeLoading && ingredients.length === 0 && recipe.steps.length === 0 && (
        <section className="rounded-2xl bg-card p-6 text-center shadow-card">
          <Loader2 className="mx-auto animate-spin text-romance" />
          <p className="mt-2 text-sm text-muted-foreground">
            Finding the real recipe for you…
          </p>
        </section>
      )}

      {recipe.summary && (
        <section className="rounded-2xl bg-card p-4 shadow-card">
          <p className="text-sm leading-relaxed text-foreground/85">{recipe.summary}</p>
          {recipe.source_url && (
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-romance hover:underline"
            >
              Source: {recipe.source_domain ?? "recipe"} <ExternalLink size={11} />
            </a>
          )}
        </section>
      )}

      {ingredients.length > 0 && (
        <section className="rounded-2xl bg-card p-4 shadow-card">
          {/* Culinary skill level above ingredients */}
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold">
            <ChefHat size={12} /> Culinary level: <span className="text-romance">{culinary}</span>
          </div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Ingredients
            </h2>
            <Badge variant="secondary" className="text-[10px]">
              {ingredients.length} items
            </Badge>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {ingredients.map((ing, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-romance" />
                <span>{ing}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Equipment needed */}
      <section className="rounded-2xl bg-card p-4 shadow-card">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Equipment needed
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {equipment.map((e, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-medium capitalize"
            >
              <Wrench size={12} /> {e}
            </span>
          ))}
        </div>
      </section>

      {recipe.steps.length > 0 && (
        <section className="rounded-2xl bg-card p-4 shadow-card">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Step by step
          </h2>
          <ol className="mt-3 space-y-3">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white" style={{ background: "var(--gradient-warm)" }}>
                  {i + 1}
                </span>
                <p className="pt-0.5 text-sm leading-relaxed text-foreground/90">{step}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {!recipeLoading && recipe.steps.length === 0 && (
        <section className="rounded-2xl bg-card p-4 shadow-card">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Instructions
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {meal.instructions?.trim() || "Recipe details coming soon."}
          </p>
        </section>
      )}

      <GroceryFinder />

      <Link to="/app/matches" className="block text-center text-sm text-muted-foreground underline">
        ← Back to matches
      </Link>
    </div>
  );
}

function GroceryFinder() {
  const search = useServerFn(searchGroceryStores);
  const [zip, setZip] = useState("");
  const [results, setResults] = useState<{ title: string; url: string; snippet: string }[]>([]);
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sb_grocery_zip");
    if (saved) setZip(saved);
  }, []);

  async function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = zip.trim();
    if (!trimmed) {
      toast.error("Enter your zip code");
      return;
    }
    if (!/^[A-Za-z0-9\s-]{3,12}$/.test(trimmed)) {
      toast.error("That zip code looks invalid");
      return;
    }
    localStorage.setItem("sb_grocery_zip", trimmed);
    setLoading(true);
    setSearched(true);
    setAnswer(null);
    setResults([]);
    try {
      const res = await search({ data: { zipCode: trimmed } });
      setResults(res.results ?? []);
      setAnswer(res.answer ?? null);
      if (res.error) toast.error(res.error);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't search grocery stores");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl bg-card p-4 shadow-card">
      <div className="flex items-center gap-2">
        <div
          className="grid h-9 w-9 place-items-center rounded-2xl text-white gradient-romance"
        >
          <Store size={18} />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold leading-tight">
            Grocery stores <span className="italic text-romance">near you</span>
          </h2>
          <p className="text-xs text-muted-foreground">Enter your zip to shop the ingredients.</p>
        </div>
      </div>

      <form onSubmit={runSearch} className="mt-4 flex gap-2">
        <input
          type="text"
          inputMode="text"
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          placeholder="Zip code (e.g. 94110)"
          aria-label="Zip code"
          maxLength={12}
          className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <Button
          type="submit"
          disabled={loading}
          className="rounded-full gap-1.5"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              <Search size={16} /> Search
            </>
          )}
        </Button>
      </form>

      {answer && (
        <p className="mt-3 rounded-xl bg-muted/50 p-3 text-sm leading-relaxed">{answer}</p>
      )}

      {!loading && searched && results.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          No grocery stores found for that zip code. Try a nearby one.
        </p>
      )}

      {results.length > 0 && (
        <ul className="mt-3 space-y-2">
          {results.map((r, i) => (
            <li key={i}>
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl border bg-background p-3 transition-colors hover:bg-accent"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{r.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {r.snippet}
                    </p>
                    {r.url && (
                      <p className="mt-1 truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                        {safeHost(r.url)}
                      </p>
                    )}
                  </div>
                  <ExternalLink size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function safeHost(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}
