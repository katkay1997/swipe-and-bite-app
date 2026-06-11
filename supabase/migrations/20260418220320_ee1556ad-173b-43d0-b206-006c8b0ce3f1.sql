
-- Drop auth-based policies and replace with public policies for the no-auth app
-- profiles
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Public insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update profiles" ON public.profiles FOR UPDATE USING (true);
CREATE POLICY "Public view profiles" ON public.profiles FOR SELECT USING (true);

-- preferences
DROP POLICY IF EXISTS "Users insert own prefs" ON public.preferences;
DROP POLICY IF EXISTS "Users update own prefs" ON public.preferences;
DROP POLICY IF EXISTS "Users view own prefs" ON public.preferences;
CREATE POLICY "Public insert prefs" ON public.preferences FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update prefs" ON public.preferences FOR UPDATE USING (true);
CREATE POLICY "Public view prefs" ON public.preferences FOR SELECT USING (true);

-- swipes
DROP POLICY IF EXISTS "Users view own swipes" ON public.swipes;
DROP POLICY IF EXISTS "Users insert own swipes" ON public.swipes;
DROP POLICY IF EXISTS "Users delete own swipes" ON public.swipes;
CREATE POLICY "Public view swipes" ON public.swipes FOR SELECT USING (true);
CREATE POLICY "Public insert swipes" ON public.swipes FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete swipes" ON public.swipes FOR DELETE USING (true);

-- matches
DROP POLICY IF EXISTS "Users view own matches" ON public.matches;
DROP POLICY IF EXISTS "Users insert own matches" ON public.matches;
DROP POLICY IF EXISTS "Users update own matches" ON public.matches;
DROP POLICY IF EXISTS "Users delete own matches" ON public.matches;
CREATE POLICY "Public view matches" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Public insert matches" ON public.matches FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update matches" ON public.matches FOR UPDATE USING (true);
CREATE POLICY "Public delete matches" ON public.matches FOR DELETE USING (true);

-- pins
DROP POLICY IF EXISTS "Users view own pins" ON public.pins;
DROP POLICY IF EXISTS "Users insert own pins" ON public.pins;
DROP POLICY IF EXISTS "Users delete own pins" ON public.pins;
CREATE POLICY "Public view pins" ON public.pins FOR SELECT USING (true);
CREATE POLICY "Public insert pins" ON public.pins FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete pins" ON public.pins FOR DELETE USING (true);

-- contact_messages
DROP POLICY IF EXISTS "Authenticated users can send contact" ON public.contact_messages;
CREATE POLICY "Public insert contact" ON public.contact_messages FOR INSERT WITH CHECK (true);

-- Drop the trigger that creates profile/role/prefs on auth.users insert (no longer used)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Allow auth-less server functions to update meals.nutrition cache via anon key
-- (The server function will use service role anyway, but keep meals policy simple)
