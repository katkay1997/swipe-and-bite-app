import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ContactSchema = z.object({
  email: z.string().trim().email().max(255),
  message: z.string().trim().min(1).max(5000),
});

export const submitContactMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; message: string }) => ContactSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;

    // Email must match authenticated user's email (defense-in-depth alongside RLS)
    const userEmail = (claims as { email?: string })?.email?.toLowerCase();
    if (!userEmail || userEmail !== data.email.toLowerCase()) {
      return { ok: false, error: "Email must match your signed-in account." };
    }

    // Rate limit: max 5 messages per user per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", oneHourAgo);

    if (countError) {
      console.error("contact rate-limit check failed", countError);
      return { ok: false, error: "Couldn't send message. Please try again." };
    }
    if ((count ?? 0) >= 5) {
      return { ok: false, error: "Too many messages. Please try again later." };
    }

    const { error } = await supabase.from("contact_messages").insert({
      user_id: userId,
      email: data.email,
      message: data.message,
    });

    if (error) {
      console.error("contact insert failed", error);
      return { ok: false, error: "Couldn't send message. Please try again." };
    }

    return { ok: true, error: null };
  });
