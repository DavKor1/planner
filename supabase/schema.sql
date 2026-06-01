-- ════════════════════════════════════════════════════════════════════
-- Planner — Supabase schema
-- Run in the Supabase SQL Editor, or save under supabase/migrations/
-- and apply with the Supabase CLI:  supabase db push
--
-- Tables:  profiles · plans · documents
-- Security: Row Level Security on every table — users only ever touch
--           their own rows. Storage bucket for uploaded files included.
-- ════════════════════════════════════════════════════════════════════

-- ── Extensions ──────────────────────────────────────────────────────
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ════════════════════════════════════════════════════════════════════
-- 1. PROFILES
-- Mirrors auth.users (Supabase manages the real auth table). One profile
-- row per authenticated user, created automatically on sign-up via trigger.
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: select own"
  on public.profiles for select
  using ( auth.uid() = id );

create policy "profiles: update own"
  on public.profiles for update
  using ( auth.uid() = id )
  with check ( auth.uid() = id );

-- Auto-create a profile whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ════════════════════════════════════════════════════════════════════
-- 2. PLANS
-- A user's planning workspace. Holds the high-level record; extracted
-- calendar items can hang off this (add a `tasks` table later if needed).
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  title       text not null,
  description text,
  status      text not null default 'active'
              check (status in ('active', 'archived', 'completed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists plans_user_id_idx       on public.plans (user_id);
create index if not exists plans_user_status_idx    on public.plans (user_id, status);
create index if not exists plans_updated_at_idx      on public.plans (updated_at desc);

alter table public.plans enable row level security;

create policy "plans: select own"
  on public.plans for select using ( auth.uid() = user_id );
create policy "plans: insert own"
  on public.plans for insert with check ( auth.uid() = user_id );
create policy "plans: update own"
  on public.plans for update using ( auth.uid() = user_id ) with check ( auth.uid() = user_id );
create policy "plans: delete own"
  on public.plans for delete using ( auth.uid() = user_id );

-- ════════════════════════════════════════════════════════════════════
-- 3. DOCUMENTS
-- Files a user uploaded into a plan. `file_url` points at an object in
-- the `documents` storage bucket (below).
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  plan_id     uuid not null references public.plans (id)    on delete cascade,
  file_name   text not null,
  file_url    text not null,
  file_type   text,
  file_size   bigint,
  created_at  timestamptz not null default now()
);

create index if not exists documents_user_id_idx on public.documents (user_id);
create index if not exists documents_plan_id_idx  on public.documents (plan_id);

alter table public.documents enable row level security;

create policy "documents: select own"
  on public.documents for select using ( auth.uid() = user_id );
create policy "documents: insert own"
  on public.documents for insert with check ( auth.uid() = user_id );
create policy "documents: update own"
  on public.documents for update using ( auth.uid() = user_id ) with check ( auth.uid() = user_id );
create policy "documents: delete own"
  on public.documents for delete using ( auth.uid() = user_id );

-- ════════════════════════════════════════════════════════════════════
-- 4. updated_at trigger — keeps plans.updated_at fresh on every change.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists plans_touch_updated_at on public.plans;
create trigger plans_touch_updated_at
  before update on public.plans
  for each row execute function public.touch_updated_at();

-- ════════════════════════════════════════════════════════════════════
-- 5. STORAGE — private bucket for uploaded documents.
-- Files are stored under a path prefixed with the user's id:
--     {user_id}/{plan_id}/{filename}
-- The policies below ensure a user can only touch objects under their
-- own id prefix.
-- ════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "documents bucket: read own"
  on storage.objects for select
  using ( bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1] );

create policy "documents bucket: upload own"
  on storage.objects for insert
  with check ( bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1] );

create policy "documents bucket: delete own"
  on storage.objects for delete
  using ( bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1] );

-- ════════════════════════════════════════════════════════════════════
-- Done. Verify in Supabase → Table Editor and → Authentication → Policies.
-- ════════════════════════════════════════════════════════════════════
