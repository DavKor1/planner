# Contributing

## Getting started

```bash
git clone https://github.com/<your-org>/planner.git
cd planner
npm install
cp .env.example .env.local   # fill in Supabase + Anthropic keys
```

### Database setup

1. Create a project at [supabase.com](https://supabase.com)
2. Open the **SQL Editor** and run `supabase/schema.sql`
3. Enable **Google** under Authentication → Providers (optional)

```bash
npm run dev   # http://localhost:3000
```

## Project layout

```
planner/
├── src/
│   ├── app/
│   │   ├── api/extract/route.ts   # AI extraction endpoint
│   │   ├── auth/callback/route.ts # Supabase OAuth callback
│   │   ├── layout.tsx
│   │   ├── page.tsx               # Calendar home
│   │   └── globals.css
│   ├── components/
│   │   ├── calendar/              # Day / Week / Month views
│   │   └── ui/                    # Shared UI primitives
│   ├── lib/supabase/              # Browser + server Supabase clients
│   ├── middleware.ts              # Auth route protection
│   └── types/index.ts            # Shared TypeScript types
├── supabase/
│   └── schema.sql                 # DB schema + RLS + storage policies
├── docs/design-reference/        # Visual prototype (read-only reference)
├── examples/                      # Sample upload files for testing
└── public/
```

## What's left to build

The foundation (types, API route, auth middleware, Supabase clients, design tokens) is in place.
The following screens need to be implemented following `docs/design-reference/`:

- [ ] `/login` and `/signup` auth screens (Obsidian aesthetic)
- [ ] Calendar home (`src/app/page.tsx`) — Day / Week / Month views
- [ ] Upload flow (`src/components/`) — dropzone + staging
- [ ] Extraction progress screen — live item list
- [ ] Plan management — create / switch / delete plans

See `docs/design-reference/README.md` for how to use the prototype as reference.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| Auth + DB + Storage | Supabase |
| AI extraction | Anthropic API (server-side) |
| Styling | CSS custom properties (no CSS framework) |

## Code style

- TypeScript strict mode — no `any`
- Server components by default; add `"use client"` only when needed
- Keep API routes lean — extraction logic lives in the route handler
- Match the Obsidian design direction exactly (tokens in `globals.css`)

## Deployment

Push to GitHub → import into [Vercel](https://vercel.com/new) → add env vars → deploy.

Add your production domain to Supabase → Authentication → URL Configuration.
