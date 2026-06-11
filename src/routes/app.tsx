import { createFileRoute, Outlet, useNavigate, Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, ChefHat, MapPin, Utensils, Settings as SettingsIcon, LogOut } from "lucide-react";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId, loading } = useAuth();
  const [checkingProfile, setCheckingProfile] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      navigate({ to: "/auth" });
      return;
    }
    setCheckingProfile(false);
  }, [userId, loading, navigate, location.pathname]);

  if (loading || (userId && checkingProfile)) {
    return (
      <div className="grid min-h-screen place-items-center gradient-sunrise">
        <div style={{ color: "var(--romance-muted-fg)" }}>Loading…</div>
      </div>
    );
  }

  if (!userId) return null;

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen pb-20 gradient-sunrise hearts-bg relative">
      <header className="relative z-10 mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
        <Logo size="sm" />
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          aria-label="Sign out"
          className="rounded-full"
        >
          <LogOut size={16} />
        </Button>
      </header>
      <main className="relative z-10 mx-auto max-w-2xl px-5">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

function BottomNav() {
  const items = [
    { to: "/app/mode", icon: <Heart size={20} />, label: "Match" },
    { to: "/app/matches", icon: <ChefHat size={20} />, label: "Matches" },
    { to: "/app/ate", icon: <Utensils size={20} />, label: "Ate" },
    { to: "/app/settings", icon: <SettingsIcon size={20} />, label: "Settings" },
  ] as const;
  return (
    <nav className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2">
      <div className="flex items-center gap-1 rounded-full bg-card px-2 py-1.5 shadow-card">
        {items.map((it) => (
          <Link
            key={it.to}
            to={it.to}
            className="flex w-16 flex-col items-center justify-center gap-0.5 rounded-full px-3 py-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            activeProps={{
              className: "text-white",
              style: { background: "var(--gradient-romance)" },
            }}
          >
            {it.icon}
            {it.label}
          </Link>
        ))}
        <span className="hidden">{MapPin.name}</span>
      </div>
    </nav>
  );
}
