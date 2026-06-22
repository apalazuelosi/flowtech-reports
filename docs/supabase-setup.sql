-- Flowtech Reports — Supabase schema.
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
--
-- Tables are locked with Row Level Security and NO public policies, so they are
-- only reachable by the service_role key used server-side in the Netlify
-- functions. The public anon key cannot read or write them. Real per-user auth
-- comes in a later phase.

create extension if not exists "pgcrypto";

-- A client owns its contamination limits plus presentation/metadata.
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  iso jsonb not null default '{"warn":{"p4":18,"p6":16,"p14":13},"crit":{"p4":20,"p6":18,"p14":15}}',
  water jsonb not null default '{"warn":250,"crit":500}',
  logo text,                       -- optional data URL for a per-client logo
  default_generated_by text,       -- pre-fills "Generado por"
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A saved report: the extracted (and possibly edited) samples plus a snapshot
-- of the limits used, so it re-renders identically later.
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  client_name text,
  generated_by text,
  overall_status text,             -- worst status across all samples
  sample_count int,
  samples jsonb not null,
  profile jsonb not null,          -- the limits snapshot used at generation time
  created_at timestamptz not null default now()
);

create index if not exists reports_created_idx on reports (created_at desc);

alter table clients enable row level security;
alter table reports enable row level security;
-- No policies on purpose: only the service_role key (server-side) bypasses RLS.
