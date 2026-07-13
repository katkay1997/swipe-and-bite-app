-- Enforce exactly one recipe per meal (mandatory 1:1).
-- recipes.meal_id PK → meals.id already caps at one recipe per meal (zero allowed).
-- Adding the reverse deferred FK makes a recipe mandatory for every meal.

-- 1) Remove meals that have no matching recipes row
DELETE FROM public.meals m
WHERE NOT EXISTS (
  SELECT 1
  FROM public.recipes r
  WHERE r.meal_id = m.id
);

-- 2) Every meal.id must reference its recipes.meal_id.
-- DEFERRABLE so meal + recipe can be inserted in the same transaction:
--   BEGIN;
--   INSERT INTO meals (...) RETURNING id;
--   INSERT INTO recipes (meal_id, ...) VALUES (...);
--   COMMIT;
ALTER TABLE public.meals
  DROP CONSTRAINT IF EXISTS meals_require_recipe_fkey;

ALTER TABLE public.meals
  ADD CONSTRAINT meals_require_recipe_fkey
  FOREIGN KEY (id) REFERENCES public.recipes (meal_id)
  DEFERRABLE INITIALLY DEFERRED;

COMMENT ON CONSTRAINT meals_require_recipe_fkey ON public.meals IS
  'Mandatory 1:1 with recipes: every meal must have exactly one recipes row. Insert both in the same transaction.';

-- 3) Helper for atomic meal + recipe creation (service_role / admins).
CREATE OR REPLACE FUNCTION public.create_meal_with_recipe(
  p_meal jsonb,
  p_recipe jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO public.meals (
    id,
    name,
    source,
    source_id,
    cuisine,
    description,
    image_url,
    ingredients,
    instructions,
    tools,
    prep_minutes,
    calories,
    tags,
    health_flags,
    meal_time,
    is_alcohol,
    affordability,
    macros,
    nutrition
  ) VALUES (
    COALESCE((p_meal->>'id')::uuid, gen_random_uuid()),
    COALESCE(p_meal->>'name', 'Untitled meal'),
    COALESCE(p_meal->>'source', 'manual'),
    p_meal->>'source_id',
    p_meal->>'cuisine',
    p_meal->>'description',
    p_meal->>'image_url',
    COALESCE(p_meal->'ingredients', '[]'::jsonb),
    p_meal->>'instructions',
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_meal->'tools', '[]'::jsonb))),
      '{}'::text[]
    ),
    NULLIF(p_meal->>'prep_minutes', '')::integer,
    NULLIF(p_meal->>'calories', '')::integer,
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_meal->'tags', '[]'::jsonb))),
      '{}'::text[]
    ),
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_meal->'health_flags', '[]'::jsonb))),
      '{}'::text[]
    ),
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_meal->'meal_time', '[]'::jsonb))),
      '{}'::text[]
    ),
    COALESCE((p_meal->>'is_alcohol')::boolean, false),
    p_meal->>'affordability',
    COALESCE(p_meal->'macros', '{}'::jsonb),
    COALESCE(p_meal->'nutrition', '{}'::jsonb)
  )
  RETURNING id INTO new_id;

  INSERT INTO public.recipes (
    meal_id,
    source_url,
    source_domain,
    title,
    summary,
    image_url,
    ingredients,
    steps,
    prep_minutes,
    cook_minutes,
    total_minutes,
    servings,
    enrichment_status,
    enrichment_error,
    attempted_at,
    enriched_at
  ) VALUES (
    new_id,
    p_recipe->>'source_url',
    p_recipe->>'source_domain',
    COALESCE(p_recipe->>'title', p_meal->>'name'),
    p_recipe->>'summary',
    COALESCE(p_recipe->>'image_url', p_meal->>'image_url'),
    COALESCE(p_recipe->'ingredients', '[]'::jsonb),
    COALESCE(p_recipe->'steps', '[]'::jsonb),
    NULLIF(p_recipe->>'prep_minutes', '')::integer,
    NULLIF(p_recipe->>'cook_minutes', '')::integer,
    NULLIF(p_recipe->>'total_minutes', '')::integer,
    NULLIF(p_recipe->>'servings', '')::integer,
    COALESCE(p_recipe->>'enrichment_status', 'pending'),
    p_recipe->>'enrichment_error',
    NULLIF(p_recipe->>'attempted_at', '')::timestamptz,
    NULLIF(p_recipe->>'enriched_at', '')::timestamptz
  );

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_meal_with_recipe(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_meal_with_recipe(jsonb, jsonb) TO service_role;
