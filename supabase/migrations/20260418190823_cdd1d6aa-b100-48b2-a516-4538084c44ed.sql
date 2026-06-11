-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('user', 'admin');
CREATE TYPE public.swipe_direction AS ENUM ('left', 'right');
CREATE TYPE public.swipe_mode AS ENUM ('takeout', 'cook');
CREATE TYPE public.report_kind AS ENUM ('bad_match', 'missing_restriction', 'other');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  food_bio TEXT,
  color_blind BOOLEAN NOT NULL DEFAULT false,
  reduce_motion BOOLEAN NOT NULL DEFAULT false,
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ============ USER ROLES (separate for security) ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ============ PREFERENCES ============
CREATE TABLE public.preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  dietary_restrictions TEXT[] NOT NULL DEFAULT '{}',
  allergies TEXT[] NOT NULL DEFAULT '{}',
  religion TEXT,
  health_conditions TEXT[] NOT NULL DEFAULT '{}',
  glp1_user BOOLEAN NOT NULL DEFAULT false,
  budget_range TEXT,
  living_situation TEXT,
  cook_time_minutes INT,
  kitchen_access TEXT,
  eating_goal TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own prefs" ON public.preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own prefs" ON public.preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own prefs" ON public.preferences FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============ MEALS (public catalog) ============
CREATE TABLE public.meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  source_id TEXT,
  name TEXT NOT NULL,
  cuisine TEXT,
  image_url TEXT,
  description TEXT,
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  instructions TEXT,
  tools TEXT[] NOT NULL DEFAULT '{}',
  prep_minutes INT,
  calories INT,
  macros JSONB NOT NULL DEFAULT '{}'::jsonb,
  tags TEXT[] NOT NULL DEFAULT '{}',
  health_flags TEXT[] NOT NULL DEFAULT '{}',
  meal_time TEXT[] NOT NULL DEFAULT '{}',
  is_alcohol BOOLEAN NOT NULL DEFAULT false,
  affordability TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source, source_id)
);
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view meals" ON public.meals FOR SELECT USING (is_alcohol = false);
CREATE POLICY "Admins manage meals" ON public.meals FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_meals_meal_time ON public.meals USING GIN(meal_time);
CREATE INDEX idx_meals_tags ON public.meals USING GIN(tags);
CREATE INDEX idx_meals_health_flags ON public.meals USING GIN(health_flags);

-- ============ SWIPES ============
CREATE TABLE public.swipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  direction swipe_direction NOT NULL,
  mode swipe_mode NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own swipes" ON public.swipes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own swipes" ON public.swipes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own swipes" ON public.swipes FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_swipes_user_created ON public.swipes(user_id, created_at DESC);

-- ============ MATCHES ============
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  matched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(user_id, meal_id)
);
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own matches" ON public.matches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own matches" ON public.matches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own matches" ON public.matches FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own matches" ON public.matches FOR DELETE USING (auth.uid() = user_id);

-- ============ PINS ============
CREATE TABLE public.pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, meal_id)
);
ALTER TABLE public.pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own pins" ON public.pins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own pins" ON public.pins FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own pins" ON public.pins FOR DELETE USING (auth.uid() = user_id);

-- ============ REPORTS ============
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_id UUID REFERENCES public.meals(id) ON DELETE SET NULL,
  kind report_kind NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own reports" ON public.reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own reports" ON public.reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all reports" ON public.reports FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- ============ CONTACT MESSAGES ============
CREATE TABLE public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can send contact" ON public.contact_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins view contact messages" ON public.contact_messages FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- ============ TIMESTAMP TRIGGER ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_preferences_updated_at BEFORE UPDATE ON public.preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ AUTO-CREATE PROFILE + ROLE + PREFS ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  INSERT INTO public.preferences (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ STORAGE: AVATARS ============
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

CREATE POLICY "Avatars publicly viewable" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);