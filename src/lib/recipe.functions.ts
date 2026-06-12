import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


/**
 * Real-recipe enrichment agent.
 *
 * Flow when the user opens a swipe card:
 *  1. Look up the meal in our DB.
 *  2. If we already have a `ready` recipe row -> return cached.
 *  3. Otherwise: Tavily search high-quality recipe sites for the dish name,
 *     try the top 3 candidates one by one. For each candidate:
 *       a. Tavily Extract pulls the cleaned page content.
 *       b. Lovable AI (Gemini) parses ingredients / numbered steps / image / times
 *          via tool calling so we always get structured data.
 *       c. We download the chosen image and re-host it in the public
 *          `recipe-images` bucket so links never break.
 *       d. We upsert the recipe row and return it.
 *  4. If everything fails, mark `failed` and return null.
 *
 * Cached forever after first success; safe to call on every card view.
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
  image_url: z.string().url(),
  ingredients: z
    .array(z.string().min(1).max(200))
    .min(2)
    .max(60),
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
  } catch {
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
  console.log("[tavily.search] request", JSON.stringify(body));
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  console.log("[tavily.search] response status", res.status, "body", raw.slice(0, 2000));
  if (!res.ok) {
    throw new Error(`tavily search ${res.status} ${raw.slice(0, 200)}`);
  }
  const json = JSON.parse(raw) as {
    results?: { title?: string; url?: string; content?: string }[];
    images?: string[];
  };
  console.log("[tavily.search] result count", json.results?.length ?? 0, "urls", (json.results ?? []).map((r) => r.url));
  return json;
}

async function tavilyExtract(apiKey: string, url: string) {
  console.log("[tavily.extract] request url", url);
  const res = await fetch("https://api.tavily.com/extract", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      urls: [url],
      extract_depth: "advanced",
      include_images: true,
    }),
  });
  const raw = await res.text();
  console.log("[tavily.extract] response status", res.status, "len", raw.length);
  if (!res.ok) {
    throw new Error(`tavily extract ${res.status} ${raw.slice(0, 200)}`);
  }
  const json = JSON.parse(raw) as {
    results?: { url?: string; raw_content?: string; images?: string[] }[];
  };
  const first = json.results?.[0];
  console.log("[tavily.extract] first result raw_content len", first?.raw_content?.length ?? 0, "images", first?.images?.length ?? 0);
  return first;
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

  const prompt = `You are extracting a real recipe from a webpage so we can show it to a user.\n\nUser is looking for: "${dishName}"\nPage URL: ${pageUrl}\n\n--- PAGE TEXT START ---\n${trimmed}\n--- PAGE TEXT END ---\n\nCandidate image URLs found ON THIS EXACT PAGE (pick the BEST appetizing photo of the FINISHED dish from this list — never logos/ads/author headshots/site banners/unrelated thumbnails):\n${imagesHint}\n\nReturn the recipe by calling the report_recipe tool. Rules:\n- ingredients: clean strings with quantity + item ("2 tbsp olive oil", "1 lb salmon fillet"). Drop section headers like "For the sauce".\n- steps: numbered cooking steps in order, each a short paragraph. No "Step 1:" prefixes.\n- image_url: MUST be copied verbatim from the candidate image URLs listed above (these were scraped from this exact recipe page). Do NOT invent URLs, do NOT use images from other pages, do NOT guess. Prefer the large hero photo of the finished "${dishName}". If no candidate image clearly shows the finished dish, pick the first candidate that is a food photo.\n- summary: 1-2 enticing sentences describing the dish.\n- If the page is clearly NOT a recipe for "${dishName}" (e.g. listicle, ad, or different dish), do not invent — call the tool with an empty ingredients array so we know to skip.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "You extract structured recipes from messy webpage text. Always reply by calling the provided tool.",
        },
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
                image_url: { type: "string" },
                ingredients: { type: "array", items: { type: "string" } },
                steps: { type: "array", items: { type: "string" } },
                prep_minutes: { type: ["integer", "null"] },
                cook_minutes: { type: ["integer", "null"] },
                total_minutes: { type: ["integer", "null"] },
                servings: { type: ["integer", "null"] },
              },
              required: ["title", "summary", "image_url", "ingredients", "steps"],
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
  try {
    parsed = JSON.parse(args);
  } catch {
    return null;
  }
  const result = RecipeSchema.safeParse(parsed);
  if (!result.success) return null;
  // Skip if obviously empty
  if (result.data.ingredients.length < 2 || result.data.steps.length < 2) return null;
  return result.data;
}

async function rehostImage(
  imageUrl: string,
  mealId: string,
): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const res = await fetch(imageUrl, {
      headers: {
        // Some sites 403 without a UA
        "User-Agent":
          "Mozilla/5.0 (compatible; LovingBitesBot/1.0; +https://lovable.app)",
      },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength < 2000 || buf.byteLength > 8 * 1024 * 1024) return null;
    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : "jpg";
    const path = `${mealId}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("recipe-images")
      .upload(path, buf, { contentType, upsert: true, cacheControl: "31536000" });
    if (upErr) return null;
    const { data: pub } = supabaseAdmin.storage.from("recipe-images").getPublicUrl(path);
    return pub.publicUrl;
  } catch {
    return null;
  }
}


export const enrichMealRecipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { mealId: string; glutenFree?: boolean }) =>
    z.object({ mealId: z.string().uuid(), glutenFree: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ recipe: DbRecipe | null; error: string | null }> => {
    // Reads can use the user-authenticated client; writes to the shared
    // recipes cache go through the service-role admin client because RLS
    // restricts INSERT/UPDATE on `recipes` to trusted server code only.
    const db = context.supabase;
    const { supabaseAdmin: dbAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    try {
      const glutenFree = data.glutenFree === true;


      // 1. Cached? Skip cache when gluten-free is requested so we re-search
      // Tavily with the "gluten-free" keyword prioritized.
      const { data: existing } = await db
        .from("recipes")
        .select("*")
        .eq("meal_id", data.mealId)
        .maybeSingle();

      if (!glutenFree && existing && existing.enrichment_status === "ready") {
        return { recipe: existing as unknown as DbRecipe, error: null };
      }

      // 2. Look up the meal name
      const { data: meal, error: mealErr } = await db
        .from("meals")
        .select("id,name,cuisine")
        .eq("id", data.mealId)
        .single();
      if (mealErr || !meal) return { recipe: null, error: "Meal not found" };

      const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
      const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
      if (!TAVILY_API_KEY || !LOVABLE_API_KEY) {
        return { recipe: null, error: "Recipe agent not configured" };
      }

      // 3. Search
      // When the user has the "Gluten-free only" filter on, prioritize the
      // "gluten-free" keyword in the Tavily search query so results are
      // gluten-free recipes (not regular recipes that happen to omit wheat).
      const query = glutenFree
        ? `gluten-free ${meal.name} recipe gluten-free ingredients no wheat no flour`
        : `${meal.name} recipe with photo and ingredients`;
      let search;
      try {
        search = await tavilySearch(TAVILY_API_KEY, query);
      } catch (e) {
        console.error("tavily search failed", e);
        await dbAdmin
          .from("recipes")

          .upsert({
            meal_id: meal.id,
            enrichment_status: "failed",
            enrichment_error: "search_failed",
            attempted_at: new Date().toISOString(),
          });
        return { recipe: null, error: "Recipe search failed" };
      }
      const candidates = (search.results ?? [])
        .filter((r) => r.url && ALLOWED_DOMAINS.some((d) => safeHost(r.url!).endsWith(d)))
        .slice(0, 4);
      // 4. Try each candidate
      let extracted: Recipe | null = null;
      let chosenUrl: string | null = null;
      for (const cand of candidates) {
        if (!cand.url) continue;
        try {
          const ex = await tavilyExtract(TAVILY_API_KEY, cand.url);
          const content = ex?.raw_content ?? cand.content ?? "";
          if (!content || content.length < 400) continue;
          // Only images scraped from THIS exact recipe page. Do not mix in
          // images from the broader Tavily search — those come from other
          // pages and cause unrelated hero photos.
          const pageImages = (ex?.images ?? []).filter(
            (u): u is string => typeof u === "string" && /^https?:\/\//.test(u),
          );
          if (pageImages.length === 0) {
            console.warn("no page images for", cand.url, "— skipping");
            continue;
          }
          const recipe = await parseRecipeWithAI({
            lovableKey: LOVABLE_API_KEY,
            dishName: meal.name,
            pageUrl: cand.url,
            pageContent: content,
            candidateImages: pageImages,
          });
          if (recipe) {
            // Enforce the chosen image actually came from this page.
            if (!pageImages.includes(recipe.image_url)) {
              recipe.image_url = pageImages[0];
            }
            extracted = recipe;
            chosenUrl = cand.url;
            break;
          }
        } catch (e) {
          console.error("candidate failed", cand.url, e);
          continue;
        }
      }

      if (!extracted || !chosenUrl) {
        await dbAdmin.from("recipes").upsert({
          meal_id: meal.id,
          enrichment_status: "failed",
          enrichment_error: "no_good_candidate",
          attempted_at: new Date().toISOString(),
        });
        return { recipe: null, error: "Couldn't find a good recipe page" };
      }

      // 5. Re-host image (fallback to original if rehost fails)
      const hostedImage =
        (await rehostImage(extracted.image_url, meal.id)) ?? extracted.image_url;

      // 6. Save
      const row = {
        meal_id: meal.id,
        source_url: chosenUrl,
        source_domain: safeHost(chosenUrl),
        title: extracted.title,
        summary: extracted.summary,
        image_url: hostedImage,
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
      const { error: upErr } = await dbAdmin.from("recipes").upsert(row);
      if (upErr) {
        console.error("recipes upsert failed", upErr);
        return { recipe: null, error: "Couldn't save recipe" };
      }

      return { recipe: row as unknown as DbRecipe, error: null };
    } catch (e) {
      console.error("enrichMealRecipe outer error", e);
      return { recipe: null, error: "Recipe agent failed" };
    }
  });
