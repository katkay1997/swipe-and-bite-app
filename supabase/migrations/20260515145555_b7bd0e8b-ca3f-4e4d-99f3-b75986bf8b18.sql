
-- 1. Enforce server-side file type and size limits on the avatars bucket
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif'],
    file_size_limit = 5242880
WHERE id = 'avatars';

-- 2. Restrict recipe-images bucket writes to admins only
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif'],
    file_size_limit = 10485760
WHERE id = 'recipe-images';

CREATE POLICY "Admins insert recipe images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'recipe-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update recipe images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'recipe-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete recipe images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'recipe-images' AND public.has_role(auth.uid(), 'admin'));
