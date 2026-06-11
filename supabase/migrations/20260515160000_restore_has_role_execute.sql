-- Restore EXECUTE on has_role for authenticated and anon roles.
-- RLS policies on meals/recipes/user_roles/contact_messages/reports call this
-- function during query evaluation, so revoking EXECUTE broke all reads with
-- "permission denied for function has_role" (42501).
-- has_role is SECURITY DEFINER and only reads user_roles, so granting EXECUTE
-- is the intended, safe pattern.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
