-- Restrict contact_messages insert to authenticated users only
DROP POLICY IF EXISTS "Anyone can send contact" ON public.contact_messages;
CREATE POLICY "Authenticated users can send contact"
  ON public.contact_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Replace permissive avatar SELECT with: public read for direct file access by URL is via the public bucket flag,
-- but we restrict the listing policy to a user's own folder.
DROP POLICY IF EXISTS "Avatars publicly viewable" ON storage.objects;
CREATE POLICY "Users list own avatar folder"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );