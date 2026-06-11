-- Replace broad public SELECT on storage.objects (which allows anon `list`)
-- with authenticated-only SELECT. Public file URLs (object/public/...) still
-- work because the storage CDN serves public buckets without RLS checks.

DROP POLICY IF EXISTS "Avatars: public read" ON storage.objects;
DROP POLICY IF EXISTS "Recipe images: public read" ON storage.objects;

CREATE POLICY "Avatars: authenticated read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Recipe images: authenticated read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'recipe-images');
