DROP POLICY IF EXISTS "Avatars publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Avatars: public read" ON storage.objects;

CREATE POLICY "Recipes server-side insert with meal FK"
ON public.recipes
FOR INSERT
TO service_role
WITH CHECK (EXISTS (SELECT 1 FROM public.meals m WHERE m.id = recipes.meal_id));

CREATE POLICY "Recipes server-side update"
ON public.recipes
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (EXISTS (SELECT 1 FROM public.meals m WHERE m.id = recipes.meal_id));