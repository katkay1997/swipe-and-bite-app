# Swipe & Bite

**Swipe right on your next meal.** A dating app style experience for deciding what to eat, personalized to your diet, your goals, and the time of day.

## About

Swipe & Bite turns "what should I eat" into a quick, visual swipe. Users build a profile with their dietary needs, allergies, health conditions, and goals, then swipe through a curated deck of meals. Right for yes, left for no. The app automatically detects breakfast, lunch, or dinner and serves meals that fit.

Every match is saved. Users can cook the recipe at home with full ingredients and instructions, or order it from a nearby restaurant with one tap. A built in eat log tracks daily calories, protein, carbs, and fat over time.

Built as a full stack, production ready web app with authentication, a real database, and a live AI integration for nutrition data.

## Features

* **Swipe to match**: drag or tap through a meal deck, with the option to rewind a swipe
* **Smart meal timing**: automatically loads breakfast, lunch, or dinner based on the current time
* **Match details**: ingredients, step by step instructions, prep time, estimated cost, and nutrition facts for every saved meal
* **AI powered nutrition**: Google Gemini fills in nutrition estimates when they are not already available
* **Restaurant search**: live search finds nearby places that serve a matched meal
* **Eat log**: mark meals as eaten and see a running daily nutrition summary
* **Rewards system**: earn badges for cooking milestones and exploring new meals
* **Profile & settings**: update diet, goals, and profile photo at any time
* **Accessibility built in**: color blind mode and a reduced motion toggle

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TanStack Router, TanStack Start |
| Styling | Tailwind CSS 4, Radix UI, Framer Motion |
| Forms & validation | React Hook Form, Zod |
| Data fetching | TanStack Query |
| Database & auth | Supabase (PostgreSQL, Auth, Row Level Security) |
| AI nutrition | Google Gemini 2.5 Flash |
| Restaurant search | Tavily Search API |
| Deployment | Cloudflare Workers |
| Runtime & bundler | Bun, Vite |
| Language | TypeScript end to end |

## Getting Started

### Prerequisites

* [Bun](https://bun.sh/) or Node.js 18+
* A Supabase project with credentials

### Installation

```bash
git clone https://github.com/your-username/swipe-and-bite-app.git
cd swipe-and-bite-app
bun install
```

Create a `.env` file in the project root:

```
SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
LOVABLE_API_KEY=your_lovable_api_key
TAVILY_API_KEY=your_tavily_api_key
```

Start the dev server:

```bash
bun run dev
```

The app runs at `http://localhost:5173` by default.

### Other Scripts

```bash
bun run build      # production build
bun run preview    # preview the production build locally
bun run lint        # run ESLint
bun run format      # format code with Prettier
```
