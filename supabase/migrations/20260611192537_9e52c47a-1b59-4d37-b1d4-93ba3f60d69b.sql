
ALTER TABLE public.meals ADD COLUMN IF NOT EXISTS nutrition jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'cook';
CREATE INDEX IF NOT EXISTS idx_matches_user_mode_matched_at ON public.matches (user_id, mode, matched_at DESC);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] NOT NULL DEFAULT '{}'::text[];

CREATE TABLE IF NOT EXISTS public.recipes (
  meal_id uuid PRIMARY KEY REFERENCES public.meals(id) ON DELETE CASCADE,
  source_url text,
  source_domain text,
  title text,
  summary text,
  image_url text,
  ingredients jsonb NOT NULL DEFAULT '[]'::jsonb,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  prep_minutes integer,
  cook_minutes integer,
  total_minutes integer,
  servings integer,
  enrichment_status text NOT NULL DEFAULT 'pending',
  enrichment_error text,
  attempted_at timestamptz,
  enriched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.recipes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.recipes TO authenticated;
GRANT ALL ON public.recipes TO service_role;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view recipes" ON public.recipes;
CREATE POLICY "Anyone can view recipes" ON public.recipes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated can write recipes" ON public.recipes;
CREATE POLICY "Authenticated can write recipes" ON public.recipes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS recipes_status_idx ON public.recipes(enrichment_status);

CREATE TABLE IF NOT EXISTS public.ate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  meal_id uuid REFERENCES public.meals(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ate TO authenticated;
GRANT ALL ON public.ate TO service_role;
ALTER TABLE public.ate ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own ate" ON public.ate;
CREATE POLICY "Users manage own ate" ON public.ate FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS ate_user_created_idx ON public.ate(user_id, created_at DESC);
