#!/usr/bin/env node
// Imports recipes from TheMealDB (https://www.themealdb.com/api.php) into Supabase.
//
// Flow: list.php?c=list -> categories -> filter.php?c={category} -> meal ids
//       -> lookup.php?i={id} -> full meal detail
//
// Each meal is upserted into `meals` (the catalog row, keyed on source+source_id)
// and then into `recipes` (the 1:1 enrichment row, keyed on meal_id) using the
// meal id returned from the meals upsert. Both upserts key on unique/PK columns,
// so reruns update existing rows instead of creating duplicates.
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment
// (RLS on `meals`/`recipes` only allows admin/service-role writes).

import { createClient } from '@supabase/supabase-js';

const API_BASE = 'https://www.themealdb.com/api/json/v1/1';
const SOURCE = 'themealdb';
const LOOKUP_CONCURRENCY = 5;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Missing Supabase environment variables. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for ${url}`);
  }
  return res.json();
}

async function getCategories() {
  const data = await fetchJson(`${API_BASE}/list.php?c=list`);
  return (data.meals ?? []).map((m) => m.strCategory).filter(Boolean);
}

async function getMealIdsForCategory(category) {
  const data = await fetchJson(`${API_BASE}/filter.php?c=${encodeURIComponent(category)}`);
  return (data.meals ?? []).map((m) => m.idMeal);
}

async function getMealDetail(id) {
  const data = await fetchJson(`${API_BASE}/lookup.php?i=${encodeURIComponent(id)}`);
  return data.meals?.[0] ?? null;
}

function extractIngredients(meal) {
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}`]?.trim();
    const measure = meal[`strMeasure${i}`]?.trim();
    if (name) {
      ingredients.push({ ingredient: name, measure: measure || null });
    }
  }
  return ingredients;
}

function extractSteps(instructions) {
  if (!instructions) return [];
  const normalized = instructions.replace(/\r\n/g, '\n').trim();
  const stepMarker = /(?:^|\n|\s)(?:STEP\s*\d+[:.)]?|\d+[.)])\s+/gi;

  let lines = normalized.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (lines.length <= 1 && stepMarker.test(normalized)) {
    lines = normalized.split(stepMarker).map((s) => s.trim()).filter(Boolean);
  }

  return lines
    .map((line) => line.replace(/^(?:STEP\s*\d+[:.)]?|\d+[.)])\s*/i, '').trim())
    .filter(Boolean);
}

function extractTags(meal) {
  const tags = new Set();
  if (meal.strCategory) tags.add(meal.strCategory);
  if (meal.strTags) {
    for (const t of meal.strTags.split(',')) {
      const trimmed = t.trim();
      if (trimmed) tags.add(trimmed);
    }
  }
  return [...tags];
}

function getSourceDomain(url) {
  if (!url) return 'themealdb.com';
  try {
    return new URL(url).hostname;
  } catch {
    return 'themealdb.com';
  }
}

async function mapWithConcurrency(items, limit, fn) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current], current);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function importMeal(id, stats) {
  let detail;
  try {
    detail = await getMealDetail(id);
  } catch (err) {
    stats.errors++;
    console.error(`  ! failed to fetch meal ${id}: ${err.message}`);
    return;
  }
  if (!detail) {
    stats.errors++;
    console.error(`  ! no detail returned for meal ${id}`);
    return;
  }

  const ingredients = extractIngredients(detail);
  const sourceUrl = detail.strSource || `https://www.themealdb.com/meal/${detail.idMeal}`;

  const mealRow = {
    source: SOURCE,
    source_id: detail.idMeal,
    name: detail.strMeal,
    cuisine: detail.strArea || null,
    image_url: detail.strMealThumb || null,
    description: null,
    ingredients,
    instructions: detail.strInstructions || null,
    tags: extractTags(detail),
    is_alcohol: false,
  };

  const { data: upsertedMeal, error: mealError } = await supabase
    .from('meals')
    .upsert(mealRow, { onConflict: 'source,source_id' })
    .select('id')
    .single();

  if (mealError || !upsertedMeal) {
    stats.errors++;
    console.error(`  ! failed to upsert meal ${detail.strMeal} (${id}): ${mealError?.message}`);
    return;
  }

  const recipeRow = {
    meal_id: upsertedMeal.id,
    source_url: sourceUrl,
    source_domain: getSourceDomain(sourceUrl),
    title: detail.strMeal,
    image_url: detail.strMealThumb || null,
    ingredients,
    steps: extractSteps(detail.strInstructions),
    enrichment_status: 'ready',
    enrichment_error: null,
    attempted_at: new Date().toISOString(),
    enriched_at: new Date().toISOString(),
  };

  const { error: recipeError } = await supabase
    .from('recipes')
    .upsert(recipeRow, { onConflict: 'meal_id' });

  if (recipeError) {
    stats.errors++;
    console.error(`  ! failed to upsert recipe for ${detail.strMeal} (${id}): ${recipeError.message}`);
    return;
  }

  stats.imported++;
}

async function main() {
  const stats = { imported: 0, errors: 0 };

  console.log('Fetching categories from TheMealDB...');
  const categories = await getCategories();
  console.log(`Found ${categories.length} categories.`);

  const mealIds = new Set();
  for (const category of categories) {
    const ids = await getMealIdsForCategory(category);
    for (const id of ids) mealIds.add(id);
    console.log(`  ${category}: ${ids.length} meals`);
  }

  const uniqueIds = [...mealIds];
  console.log(`\nImporting ${uniqueIds.length} unique meals (concurrency: ${LOOKUP_CONCURRENCY})...`);

  let done = 0;
  await mapWithConcurrency(uniqueIds, LOOKUP_CONCURRENCY, async (id) => {
    await importMeal(id, stats);
    done++;
    if (done % 25 === 0 || done === uniqueIds.length) {
      console.log(`  progress: ${done}/${uniqueIds.length}`);
    }
  });

  console.log(`\nDone. Imported/updated ${stats.imported} meals+recipes, ${stats.errors} errors.`);
  if (stats.errors > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
