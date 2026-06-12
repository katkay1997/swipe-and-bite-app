
-- Recipes: remove permissive authenticated INSERT/UPDATE policies.
-- Writes now go exclusively through server functions using the service role,
-- which bypasses RLS. Public SELECT remains.
DROP POLICY IF EXISTS "Authenticated can insert recipes for real meals" ON public.recipes;
DROP POLICY IF EXISTS "Authenticated can update recipes for real meals" ON public.recipes;

-- Matches: require meal_id to reference a real meal on insert.
DROP POLICY IF EXISTS "Users insert own matches" ON public.matches;
CREATE POLICY "Users insert own matches"
ON public.matches
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND meal_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.meals m WHERE m.id = matches.meal_id)
);
