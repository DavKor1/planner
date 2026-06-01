# Planner

> The AI scheduling assistant that reads your documents and builds one calendar you can trust.

Planner turns a pile of source material — spreadsheets, meeting notes, PDFs, calendar exports, even photos of a whiteboard — into a single optimized calendar. Upload your files, the model extracts every real task, event, deadline, and recurring commitment, and places them on the calendar. Add more documents anytime; new items merge into your existing plan instead of replacing it.

---

## ✨ Features

- **Upload anything** — `.xlsx` `.pdf` `.docx` `.csv` `.txt` `.ics` `.png` `.jpg`, up to 20 files at once
- **AI extraction** — reads actual file contents and lifts only what's really there; no invented filler
- **Recurrence-aware** — "twice a week for six weeks" expands into the right set of events
- **Always additive** — new uploads merge into your existing plan; nothing is lost
- **Day / week / month views** — plan at the right altitude
- **Traceable** — every item shows which file it came from and why it was scheduled
- **Private** — your documents are yours; we never train on your data

---

## 🚀 Quick start

```bash
# 1. Clone
git clone https://github.com/<your-org>/planner.git
cd planner

# 2. Install
npm install

# 3. Configure environment
cp .env.example .env.local
# → fill in Supabase + Anthropic keys (see below)

# 4. Set up database
# Open supabase/schema.sql in the Supabase SQL Editor and run it

# 5. Develop
npm run dev
# → http://localhost:3000
```

---

## 🔑 Environment variables

| Variable | Where to get it | Browser? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | ❌ server only |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) | ❌ server only |
| `GOOGLE_OAUTH_CLIENT_ID` | Google Cloud Console (optional) | — |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google Cloud Console (optional) | — |
| `NEXT_PUBLIC_SITE_URL` | Your deploy URL | ✅ |

---

## 🧱 Project structure

```
planner/
├── src/
│   ├── app/
│   │   ├── api/extract/          # POST /api/extract — AI document extraction
│   │   ├── auth/callback/        # Supabase OAuth callback
│   │   ├── layout.tsx            # Root layout + fonts
│   │   ├── page.tsx              # Calendar home (stub)
│   │   └── globals.css           # Design tokens + base styles
│   ├── components/
│   │   ├── calendar/             # Day / Week / Month calendar views
│   │   └── ui/                   # Shared primitives (Button, Input, etc.)
│   ├── lib/supabase/             # Browser + server Supabase clients
│   ├── middleware.ts             # Auth-gated route protection
│   └── types/index.ts           # Shared TypeScript types
├── supabase/
│   └── schema.sql                # DB schema, RLS policies, storage bucket
├── docs/
│   └── design-reference/        # Visual prototype (reference only, not production)
├── examples/                     # Sample files for testing extraction
├── .env.example                  # Environment variable template
└── CONTRIBUTING.md               # Dev setup + what's left to build
```

---

## ☁️ Deployment

### Vercel (recommended)

1. Push to GitHub
2. Import the repo at [vercel.com/new](https://vercel.com/new)
3. Add every variable from `.env.example` in the Vercel dashboard
4. Set `NEXT_PUBLIC_SITE_URL` to your production domain
5. In Supabase → Authentication → URL Configuration, add your production domain to allowed redirect URLs
6. Deploy

### Landing page only

`docs/design-reference/Landing Page.html` is fully self-contained. Drop it on any static host (Vercel, Netlify, GitHub Pages) as a marketing page.

---

## 🗺️ Status

| Area | State |
|---|---|
| Design prototype | ✅ `docs/design-reference/` |
| Database schema + RLS | ✅ `supabase/schema.sql` |
| TypeScript types | ✅ `src/types/index.ts` |
| AI extraction API route | ✅ `src/app/api/extract/` |
| Auth middleware | ✅ `src/middleware.ts` |
| Supabase clients | ✅ `src/lib/supabase/` |
| Design tokens + CSS | ✅ `src/app/globals.css` |
| Auth screens (login / signup) | ⏳ To be implemented |
| Calendar home view | ⏳ To be implemented |
| Upload + extraction flow | ⏳ To be implemented |

See [CONTRIBUTING.md](CONTRIBUTING.md) for implementation guidance.

---

## License

© 2026 Planner. All rights reserved.
