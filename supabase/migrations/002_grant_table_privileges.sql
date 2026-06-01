-- ============================================================
-- 002_grant_table_privileges.sql
-- Fix for: "42501 permission denied for table projects"
--
-- RLS policies only decide WHICH ROWS a role may touch — they do not
-- grant the base table privilege. Tables created via raw SQL migration
-- (rather than the Supabase dashboard) start with no grants to the
-- anon / authenticated roles, so every query is rejected outright.
--
-- These grants are safe: row-level access stays restricted by the RLS
-- policies in 001_initial_schema.sql (each user still only sees their own rows).
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks    TO anon, authenticated;
