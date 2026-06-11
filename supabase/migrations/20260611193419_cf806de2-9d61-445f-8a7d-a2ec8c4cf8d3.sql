
-- Authenticated + service_role for all tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.swipes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pins TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_messages TO authenticated;

GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.user_roles TO service_role;
GRANT ALL ON public.preferences TO service_role;
GRANT ALL ON public.meals TO service_role;
GRANT ALL ON public.swipes TO service_role;
GRANT ALL ON public.pins TO service_role;
GRANT ALL ON public.matches TO service_role;
GRANT ALL ON public.reports TO service_role;
GRANT ALL ON public.contact_messages TO service_role;

-- Public read for the meal catalog (it's a shared library, not user data)
GRANT SELECT ON public.meals TO anon;
