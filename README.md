# Brothers Sports Zone

A football turf booking web app for Brothers Sports Zone, a single turf in Faridpur, Dhaka, Bangladesh. The site lives at [brotherssportszone.com](https://brotherssportszone.com).

Players pick from sixteen 90-minute slots a day on a calendar that shows live availability. Selecting a slot holds it for five minutes while payment is completed. The player sends an advance by bKash or Nagad, the turf verifies the transaction and confirms the booking, and the player pays the rest in cash on arrival. Admins verify payments, create walk-in bookings, set slot prices and blackout dates, manage coupons and user accounts, and read revenue reports in a panel under `/management`.

## Stack

- React + Vite + TypeScript + Tailwind CSS v4
- Supabase (PostgreSQL, Auth, Realtime)
- pnpm workspaces
- Vercel

## Repo layout

```
brothers-sports-zone/
├── apps/
│   └── web/          # Main web app (user booking + /management admin panel)
├── packages/
│   ├── shared-types/ # TypeScript types shared across the app
│   ├── supabase-schema/ # DB migrations and seed
│   └── config/       # Shared ESLint, TSConfig, Tailwind base config
├── supabase/
│   └── functions/    # Supabase Edge Functions
└── docs/             # Turf images (WebP) + image-prompts.md
```

## Getting started

You need Node 20 or newer and pnpm 9 or newer.

```bash
pnpm install

# Copy the example env file, then fill in VITE_SUPABASE_URL and
# VITE_SUPABASE_ANON_KEY from your Supabase project settings.
# The other keys in the file are for database access and server-side
# scripts; the web app itself only reads the two VITE_ values.
cp .env.example apps/web/.env.local

pnpm dev
```

The dev server runs at http://localhost:5173. Scripts available from the repo root:

```bash
pnpm typecheck  # TypeScript across all workspaces
pnpm build      # Production build, then prerenders the public pages
pnpm preview    # Serves the built app locally
pnpm lint       # ESLint across workspaces
```

## Database

Schema changes live in `packages/supabase-schema/migrations/` as plain SQL files, applied in filename order. The `settings` table is a singleton row that holds the payment numbers, the advance amount, the public contact info, and the footer social links. Admins edit all of it at `/management/settings`.

## Deployment

The app is hosted on Vercel. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as project environment variables. The build prerenders the five public pages (`/`, `/gallery`, `/contact`, `/terms`, `/privacy`) so crawlers get static HTML, and `vercel.json` holds the SPA rewrites so protected routes survive a hard refresh.

## License

This project uses a custom license. Personal and learning use is free. Commercial use requires a 30% revenue share. See [LICENSE](LICENSE) for the terms.
