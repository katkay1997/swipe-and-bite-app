
-- 1) Preferences: restrict policies to authenticated role only
DROP POLICY IF EXISTS "Users insert own prefs" ON public.preferences;
DROP POLICY IF EXISTS "Users update own prefs" ON public.preferences;
DROP POLICY IF EXISTS "Users view own prefs" ON public.preferences;

CREATE POLICY "Users view own prefs"
  ON public.preferences FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own prefs"
  ON public.preferences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own prefs"
  ON public.preferences FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own prefs"
  ON public.preferences FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 2) Remove duplicate / weaker avatar storage policies; keep the hardened "Avatars: *" set
DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users read own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users list own avatar folder" ON storage.objects;
