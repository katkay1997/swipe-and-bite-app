// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// NEW FILE — this entire file is new. It did not exist in the original zip.
// It creates the Rewards / "Your Journey" page with the sparse badge system.
//
// WHAT THIS FILE DOES:
//   - Defines COOKING_BADGES (milestones: 1 → 3 → 10 → 20 → 50 meals)
//   - Defines EXPLORER_BADGES (behaviors: full deck, spicy swipe, GF, etc.)
//   - Reads earned badge IDs from profiles.badges in Supabase
//   - Renders a vertical timeline layout with progress bars
//   - Share button on earned badges copies text to clipboard
//   - Note at bottom explains how to swap emoji for your own PNG icons
//
// TO ACTIVATE:
//   1. Run the SQL migration first (supabase/migrations/20260609000000_rewards_and_fixes.sql)
//   2. Add a "Rewards" tab to the bottom nav in src/routes/app.tsx
//   3. Re-generate Supabase types after migration
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/app/rewards")({
  component: RewardsPage,
});

// ── BADGE DEFINITIONS ─────────────────────────────────────────────────────────
// Sparse milestone spacing: 1 → 3 → 10 → 20 → 50
// Each badge has a unique id that is stored in profiles.badges[]

export const COOKING_BADGES = [
  { id: "first_cook",   label: "First Flame",      desc: "Cook your very first meal",          threshold: 1,  emoji: "🍳" },
  { id: "beginner",     label: "Beginner Cook",    desc: "Cook 3 meals",                       threshold: 3,  emoji: "🌱" },
  { id: "home_chef",    label: "Home Chef",        desc: "Cook 10 meals",                      threshold: 10, emoji: "👨‍🍳" },
  { id: "kitchen_pro",  label: "Kitchen Pro",      desc: "Cook 20 meals",                      threshold: 20, emoji: "⭐" },
  { id: "legend",       label: "Legend",           desc: "Cook 50 meals",                      threshold: 50, emoji: "🏆" },
  { id: "clean_plate",  label: "Clean Plate Club", desc: "Log 7 meals in a single week",       threshold: 7,  emoji: "🍽" },
  { id: "date_night",   label: "Date Night Chef",  desc: "Cook a dinner recipe",               threshold: 1,  emoji: "🕯" },
] as const;

export const EXPLORER_BADGES = [
  { id: "full_deck",   label: "Full Deck",    desc: "Swipe all 20 recipes in one day",      emoji: "🃏" },
  { id: "no_fear",     label: "No Fear",      desc: "Swipe right on a Very Spicy recipe",   emoji: "🔥" },
  { id: "gf_curious",  label: "GF Curious",   desc: "Cook 3 gluten-free recipes",           emoji: "🌾" },
  { id: "world_tour",  label: "World Tour",   desc: "Match 5 different cuisines",           emoji: "🌍" },
  { id: "seasonal",    label: "Summer Chef",  desc: "Available June – August only",         emoji: "☀️" },
] as const;

export type CookingBadgeId = typeof COOKING_BADGES[number]["id"];
export type ExplorerBadgeId = typeof EXPLORER_BADGES[number]["id"];
export type BadgeId = CookingBadgeId | ExplorerBadgeId;

// ── COMPONENT ────────────────────────────────────────────────────────────────

function RewardsPage() {
  const { userId } = useAuth();
  const [earned, setEarned] = useState<BadgeId[]>([]);
  const [cookedCount, setCookedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const uid = userId;
    void load();
    async function load() {
      setLoading(true);
      // Load earned badges from profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("badges")
        .eq("id", uid)
        .maybeSingle();
      if (profile?.badges) {
        setEarned((profile.badges as BadgeId[]) ?? []);
      }
      // Count total meals logged via ate table
      const { count } = await supabase
        .from("ate")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid);
      setCookedCount(count ?? 0);
      setLoading(false);
    }
  }, [userId]);

  function isEarned(id: BadgeId) {
    return earned.includes(id);
  }

  function handleShare(label: string, desc: string) {
    // In a real mobile app this would open the native share sheet.
    // For web, copy a share text to clipboard.
    const text = `I just earned the "${label}" badge on Swipe & Bite! ${desc} 🍳♥`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => toast.success("Copied share text!"));
    } else {
      toast.info(text);
    }
  }

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading…</div>;

  const totalBadges = COOKING_BADGES.length + EXPLORER_BADGES.length;
  const earnedCount = earned.length;

  return (
    <div className="py-6">
      {/* Hero */}
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-romance to-romance/70 p-5 text-white relative overflow-hidden">
        <div className="absolute right-4 top-2 text-6xl opacity-10 pointer-events-none">★</div>
        <h1 className="font-display text-2xl font-black mb-1">Your Journey</h1>
        <p className="text-sm opacity-90 leading-relaxed mb-4">
          Each badge is a real moment in the kitchen. Earn them, then make them yours.
        </p>
        <div className="flex gap-5 text-sm">
          <div>
            <div className="font-display text-xl font-black">{cookedCount}</div>
            <div className="opacity-80 text-xs">meals cooked</div>
          </div>
          <div>
            <div className="font-display text-xl font-black">{earnedCount}</div>
            <div className="opacity-80 text-xs">badges earned</div>
          </div>
          <div>
            <div className="font-display text-xl font-black">{totalBadges - earnedCount}</div>
            <div className="opacity-80 text-xs">still to unlock</div>
          </div>
        </div>
      </div>

      {/* Cooking milestones */}
      <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3">
        Cooking milestones
      </h2>
      <div className="flex flex-col gap-0 mb-6">
        {COOKING_BADGES.map((b, idx) => {
          const earned_ = isEarned(b.id);
          const progress = Math.min(cookedCount, b.threshold);
          const pct = Math.round((progress / b.threshold) * 100);
          const isLast = idx === COOKING_BADGES.length - 1;
          return (
            <div key={b.id} className="flex gap-3 items-start relative pb-4">
              {/* Connector line */}
              {!isLast && (
                <div className="absolute left-6 top-12 bottom-0 w-px bg-border" />
              )}
              {/* Badge circle */}
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl border-2 flex-shrink-0 ${
                  earned_
                    ? "border-romance bg-romance/10"
                    : "border-border bg-muted/30 grayscale opacity-40"
                }`}
              >
                {b.emoji}
                {earned_ && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-romance text-white text-[9px] font-bold flex items-center justify-center border border-background">
                    ✓
                  </span>
                )}
              </div>
              {/* Info */}
              <div className="flex-1 pt-1">
                <div className="font-bold text-sm">{b.label}</div>
                <div className="text-xs text-muted-foreground leading-relaxed mb-1">{b.desc}</div>
                {earned_ ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-romance">Earned ✓</span>
                    <button
                      onClick={() => handleShare(b.label, b.desc)}
                      className="text-xs font-bold text-primary border border-primary/30 rounded-full px-2 py-0.5 hover:bg-primary/5 transition-colors"
                    >
                      Share →
                    </button>
                  </div>
                ) : (
                  <>
                    {"threshold" in b && (
                      <div className="max-w-[160px]">
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-romance rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {progress} of {b.threshold} meals
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Explorer badges */}
      <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3">
        Explorer badges
      </h2>
      <div className="flex flex-col gap-0 mb-6">
        {EXPLORER_BADGES.map((b, idx) => {
          const earned_ = isEarned(b.id);
          const isLast = idx === EXPLORER_BADGES.length - 1;
          return (
            <div key={b.id} className="flex gap-3 items-start relative pb-4">
              {!isLast && (
                <div className="absolute left-6 top-12 bottom-0 w-px bg-border" />
              )}
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl border-2 flex-shrink-0 relative ${
                  earned_
                    ? "border-romance bg-romance/10"
                    : "border-border bg-muted/30 grayscale opacity-40"
                }`}
              >
                {b.emoji}
                {earned_ && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-romance text-white text-[9px] font-bold flex items-center justify-center border border-background">
                    ✓
                  </span>
                )}
              </div>
              <div className="flex-1 pt-1">
                <div className="font-bold text-sm">{b.label}</div>
                <div className="text-xs text-muted-foreground leading-relaxed mb-1">{b.desc}</div>
                {earned_ ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-romance">Earned ✓</span>
                    <button
                      onClick={() => handleShare(b.label, b.desc)}
                      className="text-xs font-bold text-primary border border-primary/30 rounded-full px-2 py-0.5 hover:bg-primary/5 transition-colors"
                    >
                      Share →
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Not yet unlocked</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Icon swap note */}
      <div className="rounded-xl border border-border bg-accent/40 p-4 mb-6">
        <div className="text-xs font-bold text-primary mb-1">💡 Your icons, your badges</div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Each badge circle will show your own custom icon once you're ready. Drop your PNG files
          into <code className="bg-muted px-1 rounded">src/assets/badges/</code> and swap the emoji
          for an <code className="bg-muted px-1 rounded">&lt;img&gt;</code> tag in this file.
        </p>
      </div>

      <div className="pb-4">
        <Link to="/app/settings" className="text-sm font-bold text-primary hover:underline">
          ← Back to Settings
        </Link>
      </div>
    </div>
  );
}
