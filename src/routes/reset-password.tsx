import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — SwipeBite" },
      { name: "description", content: "Choose a new password for your SwipeBite account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  // Supabase puts a recovery session in the URL hash; wait for it before allowing updates.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setReady(true);
      }
    });
    // Also check if a session is already established (e.g. after redirect)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. You're signed in.");
      navigate({ to: "/app/mode" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't update password.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen gradient-sunrise relative overflow-hidden hearts-bg">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          aria-hidden
          className="absolute text-2xl pointer-events-none select-none animate-heartbeat"
          style={{
            left: `${10 + i * 15}%`,
            top: `${20 + (i % 3) * 25}%`,
            color: "hsl(350 90% 48% / 0.3)",
            animationDelay: `${i * 0.4}s`,
          }}
        >
          ♥
        </div>
      ))}
      <header className="mx-auto flex max-w-md items-center justify-between px-6 py-5 relative z-10">
        <Logo />
        <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">
          Back to sign in
        </Link>
      </header>
      <main className="mx-auto max-w-md px-6 pb-12 relative z-10">
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl bg-card p-7"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <h1 className="font-display text-3xl font-black tracking-tight">Choose a new password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ready
              ? "Enter a new password for your account."
              : "Open this page from the link in your reset email to continue."}
          </p>

          <div className="mt-5 space-y-3">
            <div>
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={!ready}
              />
            </div>
            <div>
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={!ready}
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading || !ready}
            className="mt-5 w-full rounded-full"
            style={{ background: "var(--gradient-warm)", color: "white" }}
          >
            {loading ? "Updating…" : "Update password"}
          </Button>
        </form>
      </main>
    </div>
  );
}
