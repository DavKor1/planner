# Supabase Integration — Setup Guide

## 1. Create a Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Note your **Project URL** and **anon public key** (Settings → API)

---

## 2. Environment variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
ANTHROPIC_API_KEY=<your-anthropic-api-key>
```

---

## 3. Run the database migration

In the Supabase dashboard → **SQL Editor**, paste and run the contents of:

```
supabase/migrations/001_initial_schema.sql
```

This creates:
- `profiles` table (auto-populated via trigger on signup)
- `projects` table (one "My Plan" auto-created per user)
- `tasks` table (all planner tasks with scheduling metadata)
- Row Level Security policies on all tables
- `handle_new_user` trigger that creates a profile + default project on signup
- `update_updated_at_column` trigger for `tasks.updated_at`

---

## 4. Enable Google OAuth (optional)

1. Supabase dashboard → **Authentication → Providers → Google**
2. Enable Google, then follow the link to create a Google OAuth 2.0 credential
3. Set **Authorized redirect URI** to:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
4. Copy the **Client ID** and **Client Secret** back into Supabase

---

## 5. Configure email templates (optional)

In **Authentication → Email Templates**, customize the confirmation and password reset emails.

Set **Site URL** in Authentication → URL Configuration to your production domain.

For local dev, add `http://localhost:3000` to **Redirect URLs**.

---

## 6. Run locally

```bash
npm run dev
```

Visit `http://localhost:3000` — you'll be redirected to `/login`.

---

## Architecture decisions

| Decision | Rationale |
|---|---|
| `@supabase/ssr` | Official Next.js 15 integration; handles cookie-based session refresh across Server and Client Components |
| Middleware route protection | Single place to enforce auth; redirects unauthenticated users server-side before any page renders |
| `AuthContext` + `useAuth()` | Client-side auth state shared across all components without prop-drilling |
| Default project per user | Keeps the existing single-calendar UI unchanged; no project selector needed yet |
| Tasks schema extends required spec | Adds planner-specific columns (cat, start_time, duration, etc.) on top of the required (status, priority, due_date) — fully backwards compatible |
| Priority mapping (med ↔ medium) | DB uses standard `low/medium/high`; client code uses `med` for medium — mapped in `tasks.ts` service layer |
| Insert tasks on `confirmToCalendar` | Saves network round-trips during review; only persist accepted tasks |
| `deleteAllTasks` on reset | Keeps DB and UI in sync when user clears the calendar |
| RLS policies | Users can only SELECT/INSERT/UPDATE/DELETE their own rows — enforced at the database level regardless of API usage |
