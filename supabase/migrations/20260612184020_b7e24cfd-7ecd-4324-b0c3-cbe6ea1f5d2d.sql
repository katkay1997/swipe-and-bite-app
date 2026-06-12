
-- 1. Allow users to read their own contact messages (rate limit fix)
CREATE POLICY "Users view own contact messages"
  ON public.contact_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. Drop overly broad avatar read policy (a stricter owner-only one already exists)
DROP POLICY IF EXISTS "Avatars: authenticated read" ON storage.objects;

-- 3. Remove duplicate recipe-images admin policies (keep the "Recipe images: admins ..." set)
DROP POLICY IF EXISTS "Admins delete recipe images" ON storage.objects;
DROP POLICY IF EXISTS "Admins insert recipe images" ON storage.objects;
DROP POLICY IF EXISTS "Admins update recipe images" ON storage.objects;
