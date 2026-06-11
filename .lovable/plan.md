# Swipe & Bite — Updates Plan

## Part 1: Bug Fixes

### 1. Heart-shaped backgrounds on `/app/mode`
In `src/routes/app.mode.tsx`, replace the rounded-full pill containers and circular icon backgrounds with heart-shaped elements:
- Use SVG heart masks (CSS `mask-image` with an inline SVG heart) or a `<Heart>` Lucide icon as the backdrop with the meal-time icon centered on top.
- Apply to: the meal-time toggle option backgrounds (currently `rounded-full`) and the ChefHat icon container on the "Cook Your Match" card.

### 2. Image preloading on `/app/swipe`
In `src/routes/app.swipe.tsx`, after `setDeck(fresh.slice(0, 30))`:
- Preload all deck images via `new Image(); img.src = url` for every meal's `image_url`.
- Wait for the first ~5 images to actually finish loading (`Promise.all` of `img.onload`/`onerror`) BEFORE setting `loading=false` so the first card never flashes white.
- In `SwipeCard`, render an `<img>` with `loading="eager"` for the top card instead of (or in addition to) the CSS `background-image`, so the browser surfaces real load state.

### 3. Meal image integrity
- Add a fallback in `SwipeCard` and `MatchOverlay`: if `image_url` is missing/broken (`onError`), swap to a default placeholder asset.
- Validate `recipe.image_url` (must be `https://`) before using it; otherwise keep `meal.image_url`.

### 4. Ingredients deduplication on `/app/match/$id`
In `src/routes/app.match.$id.tsx`, the Ingredients section currently renders TWICE — once inside `NutritionPanel` (lines ~426–453) and once as its own `<section>` (lines ~260–279). **Remove the duplicate inside `NutritionPanel`** and keep only the standalone Ingredients section. Also drop the now-unused `ingredients` and `recipeLoading` props from `NutritionPanel`.

### 5. Meal-time slider always has cards
In the deck loader of `app.swipe.tsx`, when a user picks a meal-time slot but `slotMatched.length === 0`, fall back to `all` instead of returning an empty deck — so every slot (including dessert) always shows cards. (Currently `userChanged` returns an empty list when no meals match.)

---

## Part 2: Feature Improvements

### 6. Swipe limit 9 → 20
In `app.swipe.tsx`, change `setDeck(fresh.slice(0, 30))` is fine, but the visible "9" cap noted by the user appears to come from `slice(0, 30)` not displaying — confirm by changing to `fresh.slice(0, 20)` if the user means 20 total cards per session. (We'll set the deck cap to 20.)

### 7. "Equipment Needed" section in `/app/match/$id`
Add a new `<section>` in `CookView` between Ingredients and Steps:
- Header: "Equipment needed"
- Render `meal.tools` array (already in schema). If empty, derive from instructions text by simple keyword scan (oven, stove, microwave, air fryer, blender, measuring cups, mixing bowl, etc.).
- Display each as a chip badge with a small icon.

### 8. Spice rating on every meal card
- Add to swipe card and match detail: a small chip with one of `Not spicy`, `Med`, `Very spicy`.
- Source: derive from `meal.tags` (look for `spicy`, `mild`, `hot`) or from `meal.health_flags`. If no tag, default to `Not spicy`.
- Helper function `getSpiceLevel(meal)` placed in a shared util.

### 9. Culinary Skill Level label
Above the Ingredients list in `app.match.$id.tsx`, add a small labeled badge: `Culinary Level: Beginner | Intermediate | Novice`. Derive from `meal.prep_minutes` + ingredient count (e.g., <6 ingr & <20 min = Beginner, etc.).

### 10. Dietary tags + Gluten-free filter
- The dietary list in `src/components/preferences-form.tsx` already includes Vegan, Vegetarian, and Gluten-free — confirmed present. We will surface them as profile tags on the settings/onboarding view (display chips under the user profile in `/app/settings`).
- Add **Gluten-free** as a quick toggle on the swipe page (next to the meal-time selector or as a small filter chip on `/app/mode`). When ON, filter deck to meals whose `tags`/`health_flags` include `gluten-free` (or do not contain `wheat`/`gluten`).

### 11. Allergy info in match details
In `RecipeHeader` of `app.match.$id.tsx`, add a chip row showing allergy summary based on the user's `preferences.allergies` cross-referenced with `meal.tags`/ingredient list:
- e.g. "Has peanuts & shellfish" (red chip) or "Peanut-free, shellfish-free" (green chip).

### 12. Cleanup
- Delete `src/routes/app.onboarding.tsx` (the questionnaire flow) and remove its route from `routeTree.gen.ts` (auto-regen) and any `navigate({ to: "/app/onboarding" })` calls. Update `handle_new_user` flow / login redirect to skip directly to `/app/mode`.
- Remove the disclaimer text from `app.mode.tsx` (lines 109–112).

### 13. Welcome email on sign-up
- Set up Lovable's email infrastructure (sender domain → infra → transactional templates).
- Create a transactional template `welcome` with subject `"Welcome to Swipe & Bite!"` and body `"Hi {{name}},\n\nThank you for joining us. Let's find your first match!"`.
- Trigger from the signup handler in `src/routes/auth.tsx`: after a successful `supabase.auth.signUp`, call the `sendTransactionalEmail` helper with the new user's email + display name.
- *Requires user action:* configuring an email sender domain (we'll prompt with the email setup dialog when implementing).

### 14. Recommendation algorithm
- Add a server function `getRecommendedDeck` in `src/server/recipe.functions.ts` that:
  1. Reads user's recent right-swipes (`swipes` where `direction='right'`) and left-swipes.
  2. Computes preference vectors over `cuisine`, `tags`, `health_flags`, and `meal_time`.
  3. Scores unswiped meals by overlap and returns the top N sorted by score.
- Replace the current random shuffle in `app.swipe.tsx` with this scored ordering. Keep a small randomness factor to avoid stale results.

### 15. "Sweet Message" bubble in match view
Above `<NutritionPanel>` in `CookView`, add a small chat-bubble styled `<div>` with one of ~6 random kind messages (e.g., "You're sweet picking me. Let's have some fun together."). Pick deterministically from `meal.id` so it doesn't flicker on re-render.

---

## Technical Notes

- **Files modified**: `src/routes/app.mode.tsx`, `src/routes/app.swipe.tsx`, `src/routes/app.match.$id.tsx`, `src/routes/auth.tsx`, `src/server/recipe.functions.ts`, `src/components/preferences-form.tsx` (display only), `src/routes/app.settings.tsx` (dietary tag display).
- **Files deleted**: `src/routes/app.onboarding.tsx`.
- **New files**: `src/lib/meal-helpers.ts` (spice/skill/equipment helpers), `src/lib/email/send.ts` (after email infra), email template + registry entries.
- **Email setup**: requires the user to complete the email-domain setup dialog before the welcome email can send.
- **No DB schema changes** are required — `meal.tools`, `tags`, `health_flags`, `preferences.allergies` already exist.
- **No changes** to authentication, RLS, settings security work, or any unrelated code.
