-- Allow authenticated users to upsert recipe enrichment rows so the
-- per-user recipe agent can save results without needing the service role.
DROP POLICY IF EXISTS "Authenticated can insert recipes" ON public.recipes;
DROP POLICY IF EXISTS "Authenticated can update recipes" ON public.recipes;

CREATE POLICY "Authenticated can insert recipes"
  ON public.recipes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update recipes"
  ON public.recipes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
