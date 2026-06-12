import { createServerFn } from "@tanstack/react-start";

export const debugEnv = createServerFn({ method: "GET" }).handler(async () => {
  return {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: !!process.env.SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    TAVILY_API_KEY: !!process.env.TAVILY_API_KEY,
    LOVABLE_API_KEY: !!process.env.LOVABLE_API_KEY,
    keys: Object.keys(process.env).filter(k => k.includes("SUPABASE") || k.includes("TAVILY") || k.includes("LOVABLE")),
  };
});
