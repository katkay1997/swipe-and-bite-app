
-- 1. Restrict profile SELECT to self only
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

CREATE POLICY "Users view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 2. Tighten contact_messages: require auth + matching email + length limits
DROP POLICY IF EXISTS "Public insert contact" ON public.contact_messages;

ALTER TABLE public.contact_messages
  ADD CONSTRAINT contact_messages_message_length CHECK (char_length(message) > 0 AND char_length(message) <= 5000),
  ADD CONSTRAINT contact_messages_email_length CHECK (char_length(email) > 0 AND char_length(email) <= 255);

CREATE POLICY "Authenticated users insert own contact"
ON public.contact_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND lower(email) = lower((auth.jwt() ->> 'email'))
);
