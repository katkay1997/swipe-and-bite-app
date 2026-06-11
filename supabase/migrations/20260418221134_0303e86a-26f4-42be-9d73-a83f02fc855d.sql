ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.preferences DROP CONSTRAINT IF EXISTS preferences_user_id_fkey;
ALTER TABLE public.swipes DROP CONSTRAINT IF EXISTS swipes_user_id_fkey;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_user_id_fkey;
ALTER TABLE public.pins DROP CONSTRAINT IF EXISTS pins_user_id_fkey;
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_user_id_fkey;