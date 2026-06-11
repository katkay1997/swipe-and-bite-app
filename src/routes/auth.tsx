import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — SwipeBite" },
      { name: "description", content: "Sign in or create an account to start matching meals on SwipeBite." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  // If already signed in, bounce to app
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app/mode" });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/app/mode`,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Welcome to Swipe & Bite! Let's find your first match.");
        navigate({ to: "/app/mode" });
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Check your email for a reset link.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
        navigate({ to: "/app/mode" });
      }
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : "Something went wrong";
      const lower = rawMsg.toLowerCase();
      const isInvalidCreds =
        mode === "signin" &&
        (lower.includes("invalid login credentials") ||
          lower.includes("invalid credentials") ||
          lower.includes("invalid email or password"));
      const msg = isInvalidCreds ? "Invalid credentials" : rawMsg;
      toast.error(msg, {
        description: isInvalidCreds
          ? "The email or password you entered is incorrect. Please try again."
          : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen gradient-sunrise relative overflow-hidden hearts-bg">
      {/* Floating background hearts to match landing page */}
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
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          Home
        </Link>
      </header>
      <main className="mx-auto max-w-md px-6 pb-12 relative z-10">
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl bg-card p-7"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <h1 className="font-display text-3xl font-black tracking-tight">
            {mode === "signup"
              ? "Create your account"
              : mode === "forgot"
                ? "Reset your password"
                : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Sign up to save your matches and preferences."
              : mode === "forgot"
                ? "Enter your email and we'll send you a reset link."
                : "Sign in to pick up where you left off."}
          </p>

          <div className="mt-5 space-y-3">
            {mode === "signup" && (
              <div>
                <Label htmlFor="dn">Display name</Label>
                <Input
                  id="dn"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="What should we call you?"
                />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {mode !== "forgot" && (
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="mt-5 w-full rounded-full"
            style={{ background: "var(--gradient-warm)", color: "white" }}
          >
            {loading
              ? "Please wait…"
              : mode === "signup"
                ? "Sign up"
                : mode === "forgot"
                  ? "Send reset link"
                  : "Sign in"}
          </Button>

          <button
            type="button"
            onClick={() =>
              setMode(mode === "signin" ? "signup" : "signin")
            }
            className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "signup"
              ? "Already have an account? Sign in"
              : mode === "forgot"
                ? "Back to sign in"
                : "New here? Create an account"}
          </button>
        </form>
      </main>
    </div>
  );
}
