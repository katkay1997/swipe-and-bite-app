
-- 1. Recipes: drop overly permissive policies, add scoped ones
DROP POLICY IF EXISTS "Authenticated can write recipes" ON public.recipes;
DROP POLICY IF EXISTS "Authenticated can insert recipes" ON public.recipes;
DROP POLICY IF EXISTS "Authenticated can update recipes" ON public.recipes;

CREATE POLICY "Authenticated can insert recipes for real meals"
  ON public.recipes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    meal_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.meals m WHERE m.id = meal_id)
  );

CREATE POLICY "Authenticated can update recipes for real meals"
  ON public.recipes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.meals m WHERE m.id = meal_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.meals m WHERE m.id = meal_id)
  );

-- 2. Contact messages: scope insert check
DROP POLICY IF EXISTS "Anyone can send contact" ON public.contact_messages;
CREATE POLICY "Anyone can send contact"
  ON public.contact_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    user_id IS NULL OR user_id = auth.uid()
  );

-- 3. Revoke execute on internal SECURITY DEFINER trigger helpers
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 4. has_role: keep callable by authenticated (used by RLS policies) but
-- revoke from anon since no anon policies reference it.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
