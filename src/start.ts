import { createStart, createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

// Attach the user's Supabase access token to every server function call from the client.
const attachAuthToken = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return next({
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth, attachAuthToken],
}));
