-- Investment Data Hub - Supabase schema
-- Safe for a public read-only dashboard: anonymous users can read, only service_role writes.

create extension if not exists pgcrypto;

create table if not exists public.companies (
  id text primary key,
  ticker text not null unique,
  name text not null,
  sector text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.raw_company_payloads (
  company_id text primary key references public.companies(id) on delete cascade,
  source text not null default 'google_sheets',
  sheet_name text not null,
  payload jsonb not null default '[]'::jsonb,
  row_count integer not null default 0,
  source_updated_at timestamptz,
  synced_at timestamptz not null default now()
);

-- Future normalized layer. The dashboard can migrate to this without changing the input workflow.
create table if not exists public.metrics (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references public.companies(id) on delete cascade,
  metric_code text not null,
  display_name text not null,
  unit text,
  frequency text check (frequency in ('month','quarter','year')),
  value_mode text check (value_mode in ('period','ytd','point_in_time','ratio')),
  category text,
  aggregation_method text default 'none',
  display_order integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, metric_code)
);

create table if not exists public.observations (
  id bigint generated always as identity primary key,
  company_id text not null references public.companies(id) on delete cascade,
  metric_id uuid not null references public.metrics(id) on delete cascade,
  series text not null default 'Tổng',
  period_key text not null,
  frequency text not null check (frequency in ('month','quarter','year')),
  value numeric,
  data_type text not null default 'actual' check (data_type in ('actual','estimate','guidance')),
  note text,
  source text default 'google_sheets',
  updated_at timestamptz not null default now(),
  unique(metric_id, series, period_key, data_type)
);

create table if not exists public.sync_runs (
  id bigint generated always as identity primary key,
  source text not null default 'google_sheets',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','success','error')),
  message text,
  row_counts jsonb
);

insert into public.companies (id,ticker,name,sector) values
  ('pow','POW','PV Power','Điện'),
  ('fpt','FPT','FPT Corporation','Công nghệ thông tin'),
  ('ree','REE','REE Corporation','Hạ tầng')
on conflict (id) do update set
  ticker=excluded.ticker,
  name=excluded.name,
  sector=excluded.sector,
  updated_at=now();

alter table public.companies enable row level security;
alter table public.raw_company_payloads enable row level security;
alter table public.metrics enable row level security;
alter table public.observations enable row level security;
alter table public.sync_runs enable row level security;

-- Public dashboard read policies.
drop policy if exists "public read companies" on public.companies;
create policy "public read companies" on public.companies for select using (true);

drop policy if exists "public read raw payloads" on public.raw_company_payloads;
create policy "public read raw payloads" on public.raw_company_payloads for select using (true);

drop policy if exists "public read metrics" on public.metrics;
create policy "public read metrics" on public.metrics for select using (true);

drop policy if exists "public read observations" on public.observations;
create policy "public read observations" on public.observations for select using (true);

-- sync_runs intentionally has no anonymous SELECT policy.
-- Apps Script writes with service_role and bypasses RLS.
