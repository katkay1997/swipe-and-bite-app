-- 1) recipes table (1:1 with meals)
CREATE TABLE public.recipes (
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
  enrichment_status text NOT NULL DEFAULT 'pending', -- pending | ready | failed
  enrichment_error text,
  attempted_at timestamptz,
  enriched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX recipes_status_idx ON public.recipes(enrichment_status);

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view recipes"
  ON public.recipes FOR SELECT
  USING (true);

CREATE POLICY "Admins manage recipes"
  ON public.recipes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER recipes_set_updated_at
BEFORE UPDATE ON public.recipes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2) public storage bucket for re-hosted recipe photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('recipe-images', 'recipe-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Recipe images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'recipe-images');
