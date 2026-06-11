-- Add mode column to matches so we can split Cook vs Takeout in the UI
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS mode public.swipe_mode NOT NULL DEFAULT 'cook';

-- Cache AI-estimated nutrition + cost on meals so we only call the AI once per meal
ALTER TABLE public.meals
  ADD COLUMN IF NOT EXISTS nutrition jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Helpful index for the matches list
CREATE INDEX IF NOT EXISTS idx_matches_user_mode_matched_at
  ON public.matches (user_id, mode, matched_at DESC);
