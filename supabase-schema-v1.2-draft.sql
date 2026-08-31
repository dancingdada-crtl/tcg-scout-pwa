-- TCG Scout V1.1 Supabase/Postgres draft.
-- NOT connected by the prototype yet. Review before running in Supabase.
create extension if not exists pgcrypto;

create type public.app_role as enum ('member','admin');
create type public.report_status as enum ('stock','empty','unsure');
create type public.product_condition as enum ('sealed','unsealed','damaged');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role public.app_role not null default 'member',
  last_active_at timestamptz default now(),
  session_count integer not null default 0,
  login_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  chain text,
  area text,
  address text,
  latitude double precision,
  longitude double precision,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  archived_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tcg text not null,
  sku text,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  archived_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  product_id uuid references public.products(id),
  member_id uuid not null references public.profiles(id),
  status public.report_status not null,
  people_lining_up boolean not null default false,
  possible_restock boolean not null default false,
  restock_evidence boolean not null default false,
  period text not null check (period in ('Morning','Noon','Afternoon','Evening')),
  source_type text,
  source_detail text,
  notes text,
  price numeric(10,2) check (price is null or price >= 0),
  condition public.product_condition,
  evidence_url text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.saved_filters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  filter_json jsonb not null default '{}'::jsonb,
  shared boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.member_activity (
  id bigint generated always as identity primary key,
  member_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('login','session','report','confirm','dispute')),
  occurred_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.reports enable row level security;
alter table public.saved_filters enable row level security;
alter table public.member_activity enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;

create policy "profiles self or admin read" on public.profiles for select to authenticated using (id=auth.uid() or public.is_admin());
create policy "stores member read" on public.stores for select to authenticated using (true);
create policy "products member read" on public.products for select to authenticated using (true);
create policy "reports member read" on public.reports for select to authenticated using (true);
create policy "filters owner read" on public.saved_filters for select to authenticated using (owner_id=auth.uid() or shared=true);
create policy "stores member insert" on public.stores for insert to authenticated with check (created_by=auth.uid());
create policy "stores member update" on public.stores for update to authenticated using (true) with check (true);
create policy "products member insert" on public.products for insert to authenticated with check (created_by=auth.uid());
create policy "products member update" on public.products for update to authenticated using (true) with check (true);
create policy "reports member insert" on public.reports for insert to authenticated with check (member_id=auth.uid());
create policy "reports own update" on public.reports for update to authenticated using (member_id=auth.uid() or public.is_admin());
create policy "filters own write" on public.saved_filters for all to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy "activity self insert" on public.member_activity for insert to authenticated with check (member_id=auth.uid());
create policy "activity admin read" on public.member_activity for select to authenticated using (public.is_admin());

-- Public Viewer remains intentionally unconnected in V1.1. Add explicit public read views/policies before enabling it.
-- Permanent deletion remains admin/backend-only; members archive instead.
