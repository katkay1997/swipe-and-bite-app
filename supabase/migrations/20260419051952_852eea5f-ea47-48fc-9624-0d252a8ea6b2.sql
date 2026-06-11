
-- 1. Restrict profile reads to authenticated users
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 2. Explicit deny for self-inserting roles (only admins can insert)
CREATE POLICY "Only admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. Remove broad public listing policy on storage.objects for avatars
-- Public bucket files remain accessible via direct CDN URLs without needing a SELECT policy
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
