
-- Scope matches policies to authenticated (currently public)
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='matches' LOOP
    EXECUTE format('ALTER POLICY %I ON public.matches TO authenticated', p.policyname);
  END LOOP;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='profiles' LOOP
    EXECUTE format('ALTER POLICY %I ON public.profiles TO authenticated', p.policyname);
  END LOOP;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='pins' LOOP
    EXECUTE format('ALTER POLICY %I ON public.pins TO authenticated', p.policyname);
  END LOOP;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='swipes' LOOP
    EXECUTE format('ALTER POLICY %I ON public.swipes TO authenticated', p.policyname);
  END LOOP;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='reports' LOOP
    EXECUTE format('ALTER POLICY %I ON public.reports TO authenticated', p.policyname);
  END LOOP;
END $$;

-- Explicit deny-by-default for recipes writes from any non-service role.
-- (RLS is already enabled and no permissive write policy exists, so writes
--  from authenticated/anon are already blocked; this restrictive policy makes
--  the intent explicit and prevents accidental future bypass.)
DROP POLICY IF EXISTS "Deny client writes on recipes" ON public.recipes;
CREATE POLICY "Deny client writes on recipes"
ON public.recipes
AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);
