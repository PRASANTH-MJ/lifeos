-- LifeOS Auth — Supabase schema for the users table
-- Run this in the Supabase SQL editor (Dashboard -> SQL Editor -> New query),
-- in the SAME project already used for the Finance tables (finance_schema.sql).
--
-- Why: the auth backend used to keep users in a local SQLite file
-- (server/data.sqlite) on the Render web service. Render's free tier has no
-- persistent disk, so that file resets on every redeploy/restart, silently
-- deleting every registered account. Moving users into this same Supabase
-- project fixes that permanently, and also gives a single shared database
-- that both the web app and the mobile app talk to through the same backend.
--
-- Access model: identical to finance_schema.sql — this table is reached ONLY
-- through the LifeOS Express backend (server/src/auth.js), using the
-- service-role key. RLS is enabled with NO policies (default-deny for the
-- anon/authenticated roles); every real access path is application code,
-- scoped by the verified JWT.

create table if not exists users (
  id serial primary key,
  email text not null unique,
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

alter table users enable row level security;
