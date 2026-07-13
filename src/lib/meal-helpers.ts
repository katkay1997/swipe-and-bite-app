import type { Tables } from "@/integrations/supabase/types";

type Meal = Tables<"meals">;
export type Recipe = Tables<"recipes">;

/** Meal row that is guaranteed to have its matching recipes row (DB 1:1). */
export type MealWithRecipe = Meal & { recipes: Recipe };

/**
 * PostgREST select that enforces meal↔recipe pairing in queries.
 * `recipes!inner` drops any meal that somehow lacks a recipes row.
 */
export const MEALS_WITH_RECIPE_SELECT = "*, recipes!inner(*)" as const;

export function unwrapMealRecipe(
  row: Meal & { recipes: Recipe | Recipe[] | null },
): MealWithRecipe | null {
  const recipes = Array.isArray(row.recipes) ? row.recipes[0] : row.recipes;
  if (!recipes) return null;
  return { ...row, recipes };
}

export type SpiceLevel = "Not spicy" | "Med" | "Very spicy";

export function getSpiceLevel(meal: Pick<Meal, "tags" | "health_flags" | "name" | "cuisine">): SpiceLevel {
  const haystack = [
    ...(Array.isArray(meal.tags) ? meal.tags : []),
    ...(Array.isArray(meal.health_flags) ? meal.health_flags : []),
    meal.name ?? "",
    meal.cuisine ?? "",
  ]
    .join(" ")
    .toLowerCase();
  if (/(very spicy|extra hot|fiery|ghost pepper|habanero|extra spicy)/.test(haystack)) return "Very spicy";
  if (/(spicy|hot|chili|jalapeno|jalapeño|sriracha|cayenne|chipotle|curry)/.test(haystack)) return "Med";
  return "Not spicy";
}

export type SkillLevel = "Easy" | "Medium" | "Advanced";

export function getCulinaryLevel(prepMinutes: number | null | undefined, ingredientCount: number): SkillLevel {
  const t = prepMinutes ?? 0;
  if (ingredientCount <= 6 && t > 0 && t <= 20) return "Easy";
  if (ingredientCount >= 12 || t >= 60) return "Advanced";
  return "Medium";
}

const EQUIPMENT_KEYWORDS = [
  "oven",
  "stove",
  "stovetop",
  "microwave",
  "air fryer",
  "blender",
  "food processor",
  "grill",
  "skillet",
  "frying pan",
  "saucepan",
  "pot",
  "baking sheet",
  "baking dish",
  "mixing bowl",
  "measuring cups",
  "measuring spoons",
  "whisk",
  "spatula",
  "knife",
  "cutting board",
  "slow cooker",
  "pressure cooker",
  "instant pot",
  "wok",
];

export function getEquipment(meal: Pick<Meal, "tools" | "instructions">): string[] {
  const fromTools = Array.isArray(meal.tools) ? meal.tools.filter((t): t is string => !!t && typeof t === "string") : [];
  const text = (meal.instructions ?? "").toLowerCase();
  const detected = EQUIPMENT_KEYWORDS.filter((kw) => text.includes(kw));
  const merged = Array.from(new Set([...fromTools, ...detected].map((s) => s.trim()).filter(Boolean)));
  if (merged.length === 0) return ["Stove", "Mixing bowl", "Measuring cups"];
  return merged.slice(0, 10);
}

const SWEET_MESSAGES = [
  "You're sweet picking me. Let's have some fun together.",
  "Lucky me — you've got great taste. Let's cook!",
  "I knew you'd swipe right. Let's make magic.",
  "Mmm, we're going to be so good together.",
  "You + me + a kitchen. Iconic.",
  "Ready when you are, chef. Let's do this.",
];

export function getSweetMessage(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return SWEET_MESSAGES[h % SWEET_MESSAGES.length];
}

const ALLERGY_TO_KEYWORDS: Record<string, string[]> = {
  Peanuts: ["peanut"],
  "Tree nuts": ["almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut", "macadamia"],
  Shellfish: ["shrimp", "prawn", "crab", "lobster", "scallop", "shellfish"],
  Fish: ["fish", "salmon", "tuna", "cod", "tilapia", "anchovy", "sardine"],
  Eggs: ["egg"],
  Dairy: ["milk", "cheese", "butter", "cream", "yogurt", "yoghurt"],
  Soy: ["soy", "tofu", "edamame", "soybean"],
  Wheat: ["wheat", "flour", "bread", "pasta", "noodle"],
  Sesame: ["sesame", "tahini"],
};

export function summarizeAllergies(
  userAllergies: string[],
  ingredients: string[],
  mealText: string,
): { has: string[]; free: string[] } {
  const text = (ingredients.join(" ") + " " + mealText).toLowerCase();
  const has: string[] = [];
  const free: string[] = [];
  for (const a of userAllergies) {
    const key = a.replace(/^Other:\s*/i, "").trim();
    const kws = ALLERGY_TO_KEYWORDS[key] ?? [key.toLowerCase()];
    const found = kws.some((kw) => text.includes(kw));
    if (found) has.push(key.toLowerCase());
    else free.push(key.toLowerCase());
  }
  return { has, free };
}
