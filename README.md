# Brothers Sports Zone

Football turf booking web application for Brothers Sports Zone, Faridpur, Dhaka, Bangladesh.

**Website:** [brotherssportszone.com](https://brotherssportszone.com)

## Stack

- React + Vite + TypeScript + Tailwind CSS v4
- Supabase Cloud (PostgreSQL + Auth + Storage + Realtime)
- pnpm workspaces (monorepo)
- Vercel (hosting)

## Monorepo Structure

```
brothers-sports-zone/
├── apps/
│   └── web/          # Main web app (user booking + /management admin panel)
├── packages/
│   ├── shared-types/ # Supabase-generated TypeScript types
│   ├── supabase-schema/ # DB migrations and seed
│   └── config/       # Shared ESLint, TSConfig, Tailwind base config
├── supabase/
│   └── functions/    # Supabase Edge Functions
└── docs/             # Turf images (WebP) + image-prompts.md
```

## Getting Started

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example apps/web/.env.local
# Fill in Supabase credentials in apps/web/.env.local

# Start development
pnpm --filter web dev
```

## License

Private — All rights reserved.
