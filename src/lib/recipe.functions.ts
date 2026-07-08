import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// TEMPORARY KILL SWITCH — set to false to hard-disable all Tavily + Firecrawl
// network calls in this file. Flip back to true to re-enable enrichment.
// While false: tavilySearch() and firecrawlScrape() throw before fetch,
// and the enrichMealRecipe handler short-circuits after the cache check
// without writing a pending row.
const ENRICHMENT_ENABLED = false;


/**
 * Real-recipe enrichment pipeline — Tavily + Firecrawl edition.
 *
 * Flow:
 *  1. Check recipes table — if enrichment_status = 'ready' return cached.
 *  2. Tavily Search finds the best matching recipe URL from allowed food sites.
 *  3. Firecrawl scrapes the page and returns clean markdown + structured extract.
 *  4. If Firecrawl extract has ingredients + steps, use them directly.
 *  5. Otherwise AI (Gemini) parses the Firecrawl markdown.
 *  6. Final fallback: AI parses Tavily search snippet.
 *  7. Recipe is saved to recipes table and returned.
 *
 * Cached forever after first success — Tavily and Firecrawl only run ONCE
 * per unique meal across ALL users.
 */

const ALLOWED_DOMAINS = [
  "allrecipes.com",
  "foodnetwork.com",
  "seriouseats.com",
  "bbcgoodfood.com",
  "bonappetit.com",
  "epicurious.com",
  "simplyrecipes.com",
  "cookingclassy.com",
  "delish.com",
  "thekitchn.com",
  "loveandlemons.com",
  "minimalistbaker.com",
];

const RecipeSchema = z.object({
  title: z.string().min(2).max(200),
  summary: z.string().min(10).max(400),
  image_url: z.string().url().optional().nullable(),
  ingredients: z.array(z.string().min(1).max(200)).min(2).max(60),
  steps: z.array(z.string().min(4).max(1500)).min(2).max(40),
  prep_minutes: z.number().int().min(0).max(600).nullable().optional(),
  cook_minutes: z.number().int().min(0).max(600).nullable().optional(),
  total_minutes: z.number().int().min(0).max(1200).nullable().optional(),
  servings: z.number().int().min(1).max(40).nullable().optional(),
});

export type Recipe = z.infer<typeof RecipeSchema>;

type DbRecipe = {
  meal_id: string;
  source_url: string | null;
  source_domain: string | null;
  title: string | null;
  summary: string | null;
  image_url: string | null;
  ingredients: string[];
  steps: string[];
  prep_minutes: number | null;
  cook_minutes: number | null;
  total_minutes: number | null;
  servings: number | null;
  enrichment_status: "pending" | "ready" | "failed";
  enrichment_error: string | null;
};

function safeHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch (e) {
    console.error("[enrich] catch-1:", e instanceof Error ? e.message : String(e));
    return "";
  }
}

async function tavilySearch(apiKey: string, query: string) {
  const body = {
    query,
    search_depth: "advanced",
    max_results: 8,
    include_images: true,
    include_answer: false,
    include_domains: ALLOWED_DOMAINS,
  };
  console.log("[tavily.search] query:", query);
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  console.log("[tavily.search] status:", res.status);
  if (!res.ok) throw new Error(`tavily search ${res.status} ${raw.slice(0, 200)}`);
  const json = JSON.parse(raw) as {
    results?: { title?: string; url?: string; content?: string }[];
    images?: string[];
  };
  console.log("[tavily.search] found", json.results?.length ?? 0, "results");
  return json;
}

async function firecrawlScrape(apiKey: string, url: string) {
  console.log("[firecrawl.scrape] scraping:", url);
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ["markdown", "extract"],
      extract: {
        schema: {
          type: "object",
          properties: {
            recipe_name: { type: "string" },
            description: { type: "string" },
            ingredients: { type: "array", items: { type: "string" } },
            instructions: { type: "array", items: { type: "string" } },
            prep_time_minutes: { type: "number" },
            cook_time_minutes: { type: "number" },
            total_time_minutes: { type: "number" },
            servings: { type: "number" },
            image_url: { type: "string" },
          },
        },
        prompt: "Extract the complete recipe including all ingredients with quantities, all cooking steps in order, prep time, cook time, total time, number of servings, and the main dish photo URL.",
      },
      waitFor: 2000,
    }),
  });
  const raw = await res.text();
  console.log("[firecrawl.scrape] status:", res.status, "len:", raw.length);
  if (!res.ok) throw new Error(`firecrawl ${res.status} ${raw.slice(0, 200)}`);
  const json = JSON.parse(raw) as {
    success: boolean;
    data?: {
      markdown?: string;
      extract?: {
        recipe_name?: string;
        description?: string;
        ingredients?: string[];
        instructions?: string[];
        prep_time_minutes?: number;
        cook_time_minutes?: number;
        total_time_minutes?: number;
        servings?: number;
        image_url?: string;
      };
      metadata?: {
        title?: string;
        description?: string;
        ogImage?: string;
      };
    };
  };
  console.log(
    "[firecrawl.scrape] success:", json.success,
    "ingredients:", json.data?.extract?.ingredients?.length ?? 0,
    "steps:", json.data?.extract?.instructions?.length ?? 0,
  );
  return json.data;
}

async function parseRecipeWithAI(opts: {
  lovableKey: string;
  dishName: string;
  pageUrl: string;
  pageContent: string;
  candidateImages: string[];
}): Promise<Recipe | null> {
  const { lovableKey, dishName, pageUrl, pageContent, candidateImages } = opts;
  const trimmed = pageContent.slice(0, 18000);
  const imagesHint = candidateImages.slice(0, 8).join("\n");

  const prompt = `Extract a real recipe from this webpage content.\n\nDish: "${dishName}"\nPage URL: ${pageUrl}\n\n--- CONTENT ---\n${trimmed}\n--- END ---\n\nCandidate images:\n${imagesHint || "(none)"}\n\nCall report_recipe. Rules:\n- ingredients: quantities + item ("2 tbsp olive oil")\n- steps: cooking steps in order, no "Step 1:" prefixes\n- image_url: use from candidates if available, else omit\n- If not a recipe for "${dishName}", return empty ingredients array`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Extract structured recipes from webpage text. Always reply by calling the provided tool." },
        { role: "user", content: prompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "report_recipe",
            description: "Return the cleanly extracted recipe.",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                summary: { type: "string" },
                image_url: { type: ["string", "null"] },
                ingredients: { type: "array", items: { type: "string" } },
                steps: { type: "array", items: { type: "string" } },
                prep_minutes: { type: ["integer", "null"] },
                cook_minutes: { type: ["integer", "null"] },
                total_minutes: { type: ["integer", "null"] },
                servings: { type: ["integer", "null"] },
              },
              required: ["title", "summary", "ingredients", "steps"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "report_recipe" } },
    }),
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error("AI rate limited");
    if (res.status === 402) throw new Error("AI credits exhausted");
    throw new Error(`AI ${res.status}`);
  }
  const json = await res.json();
  const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(args); } catch (e) {
    console.error("[enrich] catch-2:", e instanceof Error ? e.message : String(e));
    return null;
  }
  const result = RecipeSchema.safeParse(parsed);
  if (!result.success) {
    console.warn("[ai.parse] schema failed:", result.error.issues);
    return null;
  }
  if (result.data.ingredients.length < 2 || result.data.steps.length < 2) return null;
  return result.data;
}

async function rehostImage(imageUrl: string, mealId: string): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const res = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SwipeBiteBot/1.0)" },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength < 2000 || buf.byteLength > 8 * 1024 * 1024) return null;
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const path = `${mealId}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("recipe-images")
      .upload(path, buf, { contentType, upsert: true, cacheControl: "31536000" });
    if (upErr) return null;
    const { data: pub } = supabaseAdmin.storage.from("recipe-images").getPublicUrl(path);
    return pub.publicUrl;
  } catch (e) {
    console.error("[enrich] catch-3:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

export const enrichMealRecipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { mealId: string; glutenFree?: boolean }) =>
    z.object({ mealId: z.string().uuid(), glutenFree: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ recipe: DbRecipe | null; error: string | null }> => {
    const { createClient } = await import("@supabase/supabase-js");
    const db = context?.supabase ?? createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!
    );

    async function getAdmin() {
      try {
        const mod = await import("@/integrations/supabase/client.server");
        return mod.supabaseAdmin;
      } catch (e) {
        console.error("[enrich] catch-4:", e instanceof Error ? e.message : String(e));
        console.warn("[enrich] admin client unavailable", e);
        return null;
      }
    }

    try {
      const glutenFree = data.glutenFree === true;

      // 1. Return cached recipe
      const { data: existing } = await db
        .from("recipes")
        .select("*")
        .eq("meal_id", data.mealId)
        .maybeSingle();

      if (!glutenFree && existing && existing.enrichment_status === "ready") {
        console.log("[enrich] cache hit for", data.mealId);
        return { recipe: existing as unknown as DbRecipe, error: null };
      }

      // 2. Look up meal
      const { data: meal, error: mealErr } = await db
        .from("meals")
        .select("id,name,cuisine,image_url")
        .eq("id", data.mealId)
        .single();
      if (mealErr || !meal) return { recipe: null, error: "Meal not found" };

      const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
      const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
      const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;

      console.log("[enrich] meal:", meal.name, "| tavily:", !!TAVILY_API_KEY, "| firecrawl:", !!FIRECRAWL_API_KEY, "| lovable:", !!LOVABLE_API_KEY);

      if (!TAVILY_API_KEY) {
        return { recipe: null, error: "Recipe agent not configured" };
      }

      // 3. Tavily Search
      const query = glutenFree
        ? `gluten-free ${meal.name} recipe ingredients steps`
        : `${meal.name} recipe ingredients steps`;

      let search;
      try {
        search = await tavilySearch(TAVILY_API_KEY, query);
      } catch (e) {
        console.error("[enrich] catch-5:", e instanceof Error ? e.message : String(e));
        console.error("[enrich] tavily search failed:", e);
        const admin = await getAdmin();
        if (admin) {
          try {
            await admin.from("recipes").upsert({
              meal_id: meal.id,
              enrichment_status: "failed",
              enrichment_error: "tavily_search_failed",
              attempted_at: new Date().toISOString(),
            });
          } catch (e) {
            console.error("[enrich] catch-6:", e instanceof Error ? e.message : String(e));
          }
        }
        return { recipe: null, error: "Recipe search failed" };
      }

      const candidates = (search.results ?? [])
        .filter((r) => r.url && ALLOWED_DOMAINS.some((d) => safeHost(r.url!).endsWith(d)))
        .slice(0, 4);

      console.log("[enrich] candidates:", candidates.length, candidates.map((c) => c.url));

      if (candidates.length === 0) {
        const admin = await getAdmin();
        if (admin) {
          try {
            await admin.from("recipes").upsert({
              meal_id: meal.id,
              enrichment_status: "failed",
              enrichment_error: "no_candidates",
              attempted_at: new Date().toISOString(),
            });
          } catch (e) {
            console.error("[enrich] catch-7:", e instanceof Error ? e.message : String(e));
          }
        }
        return { recipe: null, error: "No recipe found" };
      }

      const searchImages = (search.images ?? []).filter(
        (u): u is string => typeof u === "string" && /^https?:\/\//.test(u),
      );

      // 4. Try each candidate
      let extracted: Recipe | null = null;
      let chosenUrl: string | null = null;

      for (const cand of candidates) {
        if (!cand.url) continue;
        console.log("[enrich] trying:", cand.url);

        try {
          // 4a. Firecrawl structured extract (best quality)
          if (FIRECRAWL_API_KEY) {
            try {
              const fc = await firecrawlScrape(FIRECRAWL_API_KEY, cand.url);
              const ext = fc?.extract;

              if (ext && (ext.ingredients?.length ?? 0) >= 2 && (ext.instructions?.length ?? 0) >= 2) {
                console.log("[firecrawl] structured extract success!");
                const imageUrl =
                  ext.image_url ||
                  fc?.metadata?.ogImage ||
                  searchImages[0] ||
                  (meal.image_url as string | null) ||
                  null;

                const recipe: Recipe = {
                  title: ext.recipe_name || fc?.metadata?.title || meal.name,
                  summary: ext.description || fc?.metadata?.description || `A delicious ${meal.name} recipe.`,
                  image_url: imageUrl,
                  ingredients: ext.ingredients ?? [],
                  steps: ext.instructions ?? [],
                  prep_minutes: ext.prep_time_minutes ?? null,
                  cook_minutes: ext.cook_time_minutes ?? null,
                  total_minutes: ext.total_time_minutes ?? null,
                  servings: ext.servings ?? null,
                };

                const valid = RecipeSchema.safeParse(recipe);
                if (valid.success) {
                  extracted = valid.data;
                  chosenUrl = cand.url;
                  break;
                }
              }

              // 4b. Firecrawl markdown + AI parse
              const markdown = fc?.markdown ?? "";
              if (markdown.length >= 400 && LOVABLE_API_KEY) {
                const pageImages = [
                  ext?.image_url,
                  fc?.metadata?.ogImage,
                  ...searchImages,
                ].filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u));

                const recipe = await parseRecipeWithAI({
                  lovableKey: LOVABLE_API_KEY,
                  dishName: meal.name,
                  pageUrl: cand.url,
                  pageContent: markdown,
                  candidateImages: pageImages,
                });

                if (recipe) {
                  if (!recipe.image_url) {
                    recipe.image_url = pageImages[0] ?? (meal.image_url as string | null) ?? null;
                  }
                  extracted = recipe;
                  chosenUrl = cand.url;
                  break;
                }
              }
            } catch (e) {
              console.error("[enrich] catch-8:", e instanceof Error ? e.message : String(e));
              console.warn("[firecrawl] failed for", cand.url, ":", e);
            }
          }

          // 4c. Fallback: Tavily snippet + AI
          if (!extracted && LOVABLE_API_KEY) {
            const content = cand.content ?? "";
            if (content.length >= 100) {
              console.log("[enrich] AI fallback on Tavily snippet for", cand.url);
              const recipe = await parseRecipeWithAI({
                lovableKey: LOVABLE_API_KEY,
                dishName: meal.name,
                pageUrl: cand.url,
                pageContent: content,
                candidateImages: searchImages,
              });
              if (recipe) {
                if (!recipe.image_url) {
                  recipe.image_url = searchImages[0] ?? (meal.image_url as string | null) ?? null;
                }
                extracted = recipe;
                chosenUrl = cand.url;
                break;
              }
            }
          }
        } catch (e) {
          console.error("[enrich] catch-9:", e instanceof Error ? e.message : String(e));
          console.error("[enrich] candidate error:", cand.url, e);
          continue;
        }
      }

      // 5. All candidates exhausted
      if (!extracted || !chosenUrl) {
        console.warn("[enrich] no recipe extracted from any candidate");
        const admin = await getAdmin();
        if (admin) {
          try {
            await admin.from("recipes").upsert({
              meal_id: meal.id,
              enrichment_status: "failed",
              enrichment_error: "no_good_candidate",
              attempted_at: new Date().toISOString(),
            });
          } catch (e) {
            console.error("[enrich] catch-10:", e instanceof Error ? e.message : String(e));
          }
        }
        return { recipe: null, error: "Couldn't find a good recipe page" };
      }

      // 6. Re-host image (soft fail)
      const finalImage = extracted.image_url
        ? (await rehostImage(extracted.image_url, meal.id)) ?? extracted.image_url
        : (meal.image_url as string | null) ?? null;

      // 7. Save to cache
      const row = {
        meal_id: meal.id,
        source_url: chosenUrl,
        source_domain: safeHost(chosenUrl),
        title: extracted.title,
        summary: extracted.summary,
        image_url: finalImage,
        ingredients: extracted.ingredients,
        steps: extracted.steps,
        prep_minutes: extracted.prep_minutes ?? null,
        cook_minutes: extracted.cook_minutes ?? null,
        total_minutes: extracted.total_minutes ?? null,
        servings: extracted.servings ?? null,
        enrichment_status: "ready" as const,
        enrichment_error: null,
        attempted_at: new Date().toISOString(),
        enriched_at: new Date().toISOString(),
      };

      const admin = await getAdmin();
      if (admin) {
        const { error: upErr } = await admin.from("recipes").upsert(row);
        if (upErr) console.warn("[enrich] upsert failed (returning anyway):", upErr);
      }

      console.log("[enrich] success for", meal.name, "from", chosenUrl);
      return { recipe: row as unknown as DbRecipe, error: null };

    } catch (e) {
      console.error("[enrich] catch-11:", e instanceof Error ? e.message : String(e));
      return { recipe: null, error: "Recipe agent failed" };
    }
  });
