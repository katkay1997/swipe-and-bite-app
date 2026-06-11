-- Restrict listing/inserts/updates/deletes on the public `avatars` bucket
-- so only the owning user can write to their own folder, and arbitrary
-- bucket listing is disallowed. Public SELECT remains so existing public
-- URLs continue to work.

-- Drop any prior versions of these policies (idempotent migration)
DROP POLICY IF EXISTS "Avatars: public read" ON storage.objects;
DROP POLICY IF EXISTS "Avatars: users insert own" ON storage.objects;
DROP POLICY IF EXISTS "Avatars: users update own" ON storage.objects;
DROP POLICY IF EXISTS "Avatars: users delete own" ON storage.objects;

CREATE POLICY "Avatars: public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Avatars: users insert own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND lower(coalesce(metadata->>'mimetype','')) IN ('image/jpeg','image/png','image/webp','image/gif')
);

CREATE POLICY "Avatars: users update own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND lower(coalesce(metadata->>'mimetype','')) IN ('image/jpeg','image/png','image/webp','image/gif')
);

CREATE POLICY "Avatars: users delete own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Lock down the public `recipe-images` bucket — only admins may write.
DROP POLICY IF EXISTS "Recipe images: public read" ON storage.objects;
DROP POLICY IF EXISTS "Recipe images: admins insert" ON storage.objects;
DROP POLICY IF EXISTS "Recipe images: admins update" ON storage.objects;
DROP POLICY IF EXISTS "Recipe images: admins delete" ON storage.objects;

CREATE POLICY "Recipe images: public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'recipe-images');

CREATE POLICY "Recipe images: admins insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'recipe-images'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Recipe images: admins update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'recipe-images'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  bucket_id = 'recipe-images'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Recipe images: admins delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'recipe-images'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);
