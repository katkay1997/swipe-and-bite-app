
-- 1. Wipe existing anonymous data
DELETE FROM public.pins;
DELETE FROM public.matches;
DELETE FROM public.swipes;
DELETE FROM public.preferences;
DELETE FROM public.user_roles;
DELETE FROM public.profiles;

-- 2. Drop all overly permissive policies

-- profiles
DROP POLICY IF EXISTS "Public insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public view profiles" ON public.profiles;

-- preferences
DROP POLICY IF EXISTS "Public insert prefs" ON public.preferences;
DROP POLICY IF EXISTS "Public update prefs" ON public.preferences;
DROP POLICY IF EXISTS "Public view prefs" ON public.preferences;

-- swipes
DROP POLICY IF EXISTS "Public view swipes" ON public.swipes;
DROP POLICY IF EXISTS "Public insert swipes" ON public.swipes;
DROP POLICY IF EXISTS "Public delete swipes" ON public.swipes;

-- matches
DROP POLICY IF EXISTS "Public view matches" ON public.matches;
DROP POLICY IF EXISTS "Public insert matches" ON public.matches;
DROP POLICY IF EXISTS "Public update matches" ON public.matches;
DROP POLICY IF EXISTS "Public delete matches" ON public.matches;

-- pins
DROP POLICY IF EXISTS "Public view pins" ON public.pins;
DROP POLICY IF EXISTS "Public insert pins" ON public.pins;
DROP POLICY IF EXISTS "Public delete pins" ON public.pins;

-- 3. Recreate secure policies

-- profiles: public read (for display names), owner-only write
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- preferences: owner-only for everything (sensitive health data)
CREATE POLICY "Users view own prefs"
  ON public.preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own prefs"
  ON public.preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own prefs"
  ON public.preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- swipes: owner-only
CREATE POLICY "Users view own swipes"
  ON public.swipes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own swipes"
  ON public.swipes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own swipes"
  ON public.swipes FOR DELETE
  USING (auth.uid() = user_id);

-- matches: owner-only
CREATE POLICY "Users view own matches"
  ON public.matches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own matches"
  ON public.matches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own matches"
  ON public.matches FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own matches"
  ON public.matches FOR DELETE
  USING (auth.uid() = user_id);

-- pins: owner-only
CREATE POLICY "Users view own pins"
  ON public.pins FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own pins"
  ON public.pins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own pins"
  ON public.pins FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Trigger: auto-create profile/preferences/role on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Storage policies for avatars bucket: owner-only writes, public reads
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
