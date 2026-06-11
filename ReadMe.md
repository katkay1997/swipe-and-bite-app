# Swipe & Bite

Hyper-personalized meal discovery, *swipe right to eat well*.

This app is for **everybody**, but it's especially for people who want to improve their health

Problems we face as students:
- Not knowing enough about nutrition (it might not matter now, but it will later)
- Can't decide what to eat each day
- No way to show a nutritionist or doctor what I've been eating
- Wasting time scrolling through options instead of eating efficiently 


---

## About the Project

Swipe & Bite turns finding your next meal into a swipe experience, like dating apps but for food. You build a profile based on your diet, health conditions, allergies, and goals. Then you swipe through a curated deck of meals — right for "yes," left for "nope." The app figures out whether it's breakfast, lunch, or dinner on its own and serves meals that actually fit your life.

You can choose to **cook at home** or **order takeout**. For cooking, you get full recipes, ingredients, prep time, and nutrition info. For takeout, the app finds nearby restaurants that serve that meal and links you directly to order.

Every match is saved so you can come back to it. The app also tracks what you've actually eaten and shows a daily nutrition summary.

---

## Features

- **Swipe to match**, drag cards left or right (or tap the buttons). Liked meals are saved to your matches. You can rewind if you change your mind.

- **Cook or takeout mode**, choose at the start. Cook mode gives you full recipes; takeout mode finds restaurants nearby.

- **Smart meal timing**, the app automatically loads breakfast, lunch, or dinner meals based on the time of day.

- **Onboarding quiz**, set your dietary restrictions, allergies, health conditions, and eating goals once. The app filters everything from there.

- **Match details**, click any saved meal to see ingredients, step-by-step instructions, prep time, estimated cost, and nutrition facts.

- **AI nutrition estimation**, if nutrition data isn't available, Google Gemini fills it in on the fly.

- **Restaurant search**, for takeout matches, the app searches for nearby places that serve that meal using live web search.

- **Eat log**, mark meals as eaten and track your daily calories, protein, carbs, and fat.

- **Settings & profile**, update your preferences, dietary needs, and profile picture any time.

- **Accessibility options**, color-blind mode and reduced motion toggle built in.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 19, TanStack Router, TanStack Start |
| Styling | Tailwind CSS 4, Radix UI |
| Animations | Framer Motion |
| Forms & validation | React Hook Form, Zod |
| Data fetching | TanStack Query |
| Database & auth | Supabase (PostgreSQL + Auth + Row-Level Security) |
| AI nutrition | Google Gemini 2.5 Flash (via Lovable AI Gateway) |
| Restaurant search | Tavily Search API |
| Deployment | Cloudflare Workers (via Wrangler) |
| Runtime / bundler | Bun, Vite |
| Language | TypeScript (end-to-end) |

---

## How to Run the Project (Localhost)

### Prerequisites

- [Bun](https://bun.sh/) or Node.js 18+ installed
- A Supabase project with credentials (the team's `.env` file covers this)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/your-username/swipe-and-bite.git
cd swipeandbite

# 2. Install dependencies
bun install
# or: npm install

# 3. Set up environment variables
# Create a .env file in the project root with the following:
SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
LOVABLE_API_KEY=your_lovable_api_key
TAVILY_API_KEY=your_tavily_api_key

# 4. Start the development server
bun run dev
# or: npm run dev
```

The app runs at `http://localhost:5173` by default.

### Other Scripts

```bash
bun run build      # Production build
bun run preview    # Preview the production build locally
bun run lint       # Run ESLint
bun run format     # Format code with Prettier
```

---

## Contributing

Pull requests are welcome. For major changes, open an issue first to discuss what you'd like to change.

**Built at Brooklyn Hackathon 2026 by:**

- Sanatjon Burkhanov
- Muhammadali Nosirjonov
- Yuzhen Chen
- Katera McKay
