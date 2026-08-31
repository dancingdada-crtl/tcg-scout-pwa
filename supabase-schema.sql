-- TCG Scout V1.2.1 launch schema
-- Target: new Supabase project
-- Public Viewer = anonymous (anon) access through limited public views.
-- Authenticated roles = member/admin. The sole admin is promoted manually after first login.

begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ---------- ENUMS ----------
do $$ begin
  create type public.app_role as enum ('member','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_status as enum ('stock','empty','unsure');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.time_bucket as enum ('Morning','Noon','Afternoon','Evening');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.product_condition as enum ('sealed','unsealed','damaged');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.source_type as enum ('firsthand','friend','phone_call','social_media','employee','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.feedback_type as enum ('confirm','dispute');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.activity_event_type as enum ('login','session','report','confirm','dispute');
exception when duplicate_object then null; end $$;

-- ---------- TABLES ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext not null unique,
  display_name text,
  avatar_path text,
  role public.app_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_private (
  id uuid primary key references public.profiles(id) on delete cascade,
  email citext,
  is_enabled boolean not null default true,
  login_count integer not null default 0,
  session_count integer not null default 0,
  last_login_at timestamptz,
  last_active_at timestamptz not null default now()
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  chain text,
  address text,
  city text,
  state text,
  postal_code text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  archived_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stores_lat_check check (latitude is null or latitude between -90 and 90),
  constraint stores_lng_check check (longitude is null or longitude between -180 and 180)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tcg text not null,
  set_name text,
  sku text,
  upc text,
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  archived_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  product_id uuid references public.products(id),
  member_id uuid not null references public.profiles(id),
  status public.report_status not null,
  time_bucket public.time_bucket not null,
  people_lining_up boolean not null default false,
  possible_restock boolean not null default false,
  restock_evidence boolean not null default false,
  source_type public.source_type,
  source_detail text,
  notes text,
  line_size text check (line_size is null or line_size in ('Small','Medium','Large')),
  price numeric(10,2) check (price is null or price >= 0),
  condition public.product_condition,
  evidence_url text,
  evidence_image_path text,
  occurred_at timestamptz not null default now(),
  occurred_at_is_approx boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.report_feedback (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.reports(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  feedback public.feedback_type not null,
  created_at timestamptz not null default now(),
  unique (report_id, member_id)
);

create table if not exists public.saved_analytics (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_activity (
  id bigint generated always as identity primary key,
  member_id uuid not null references public.profiles(id) on delete cascade,
  event_type public.activity_event_type not null,
  related_report_id uuid references public.reports(id) on delete set null,
  occurred_at timestamptz not null default now()
);

create table if not exists public.ranking_tiers (
  id bigint generated always as identity primary key,
  min_points integer not null unique check (min_points >= 0),
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.ranking_tiers (min_points, title)
values
  (0, 'Scout'),
  (5, 'Contributor'),
  (20, 'Local Tracker'),
  (50, 'Restock Hunter')
on conflict (min_points) do nothing;

create table if not exists public.app_settings (
  id boolean primary key default true check (id = true),
  app_name text not null default 'TCG Scout',
  app_icon_path text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id, app_name)
values (true, 'TCG Scout')
on conflict (id) do nothing;

-- ---------- INDEXES ----------
create index if not exists reports_store_occurred_idx
  on public.reports (store_id, occurred_at desc);
create index if not exists reports_product_occurred_idx
  on public.reports (product_id, occurred_at desc);
create index if not exists reports_member_created_idx
  on public.reports (member_id, created_at desc);
create index if not exists reports_status_bucket_idx
  on public.reports (status, time_bucket, occurred_at desc);
create index if not exists activity_member_occurred_idx
  on public.member_activity (member_id, occurred_at desc);
create index if not exists feedback_report_idx
  on public.report_feedback (report_id);
create index if not exists stores_active_idx
  on public.stores (active);
create index if not exists products_active_tcg_idx
  on public.products (active, tcg);
create unique index if not exists products_upc_unique_idx
  on public.products (upc) where upc is not null and btrim(upc) <> '';

-- ---------- HELPERS ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists stores_set_updated_at on public.stores;
create trigger stores_set_updated_at
before update on public.stores
for each row execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists reports_set_updated_at on public.reports;
create trigger reports_set_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

drop trigger if exists saved_analytics_set_updated_at on public.saved_analytics;
create trigger saved_analytics_set_updated_at
before update on public.saved_analytics
for each row execute function public.set_updated_at();

drop trigger if exists ranking_tiers_set_updated_at on public.ranking_tiers;
create trigger ranking_tiers_set_updated_at
before update on public.ranking_tiers
for each row execute function public.set_updated_at();

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.is_enabled_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profile_private
    where id = auth.uid()
      and is_enabled = true
  );
$$;

-- Creates profile/private row on first Supabase Auth account creation.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
begin
  base_username := coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    nullif(split_part(coalesce(new.email, 'member'), '@', 1), ''),
    'member'
  );

  base_username := regexp_replace(lower(base_username), '[^a-z0-9._-]+', '_', 'g');
  final_username := left(base_username, 24) || '_' || right(new.id::text, 4);

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    final_username,
    nullif(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (id) do nothing;

  insert into public.profile_private (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------- SAFE RPCs ----------
-- Members edit their own public profile without being able to change their role.
create or replace function public.update_my_profile(
  p_username text,
  p_display_name text default null,
  p_avatar_path text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_enabled_member() then
    raise exception 'Not authorized';
  end if;

  if p_username is null or length(btrim(p_username)) < 2 then
    raise exception 'Username must be at least 2 characters';
  end if;

  update public.profiles
  set username = btrim(p_username),
      display_name = nullif(btrim(p_display_name), ''),
      avatar_path = nullif(btrim(p_avatar_path), '')
  where id = auth.uid();
end;
$$;

-- Any enabled member may archive/restore a store, without gaining broad edit rights.
create or replace function public.set_store_archived(
  p_store_id uuid,
  p_archived boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_enabled_member() then
    raise exception 'Not authorized';
  end if;

  update public.stores
  set active = not p_archived,
      archived_by = case when p_archived then auth.uid() else null end
  where id = p_store_id;
end;
$$;

-- Any enabled member may archive/restore a product, without gaining broad edit rights.
create or replace function public.set_product_archived(
  p_product_id uuid,
  p_archived boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_enabled_member() then
    raise exception 'Not authorized';
  end if;

  update public.products
  set active = not p_archived,
      archived_by = case when p_archived then auth.uid() else null end
  where id = p_product_id;
end;
$$;

-- Call once after a successful auth event in the app.
create or replace function public.record_login()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_enabled_member() then
    raise exception 'Not authorized';
  end if;

  update public.profile_private
  set login_count = login_count + 1,
      last_login_at = now(),
      last_active_at = now()
  where id = auth.uid();

  insert into public.member_activity (member_id, event_type)
  values (auth.uid(), 'login');
end;
$$;

-- Call once per meaningful app session, not on every page render.
create or replace function public.record_session()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_enabled_member() then
    raise exception 'Not authorized';
  end if;

  update public.profile_private
  set session_count = session_count + 1,
      last_active_at = now()
  where id = auth.uid();

  insert into public.member_activity (member_id, event_type)
  values (auth.uid(), 'session');
end;
$$;

-- Automatically log report contribution.
create or replace function public.log_report_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.member_activity (member_id, event_type, related_report_id)
  values (new.member_id, 'report', new.id);

  update public.profile_private
  set last_active_at = now()
  where id = new.member_id;

  return new;
end;
$$;

drop trigger if exists reports_log_activity on public.reports;
create trigger reports_log_activity
after insert on public.reports
for each row execute function public.log_report_activity();

-- Automatically log confirmation/dispute contribution.
create or replace function public.log_feedback_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.member_activity (member_id, event_type, related_report_id)
  values (
    new.member_id,
    case when new.feedback = 'confirm' then 'confirm'::public.activity_event_type
         else 'dispute'::public.activity_event_type end,
    new.report_id
  );

  update public.profile_private
  set last_active_at = now()
  where id = new.member_id;

  return new;
end;
$$;

drop trigger if exists feedback_log_activity on public.report_feedback;
create trigger feedback_log_activity
after insert on public.report_feedback
for each row execute function public.log_feedback_activity();

-- ---------- ROW LEVEL SECURITY ----------
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.reports enable row level security;
alter table public.report_feedback enable row level security;
alter table public.saved_analytics enable row level security;
alter table public.member_activity enable row level security;
alter table public.ranking_tiers enable row level security;
alter table public.app_settings enable row level security;

-- Public profiles: enabled authenticated members can see the member directory.
drop policy if exists "profiles member read" on public.profiles;
create policy "profiles member read"
on public.profiles for select
to authenticated
using (public.is_enabled_member());

-- No direct profile UPDATE policy. Use update_my_profile() RPC.
-- Admin can read private member/account activity data; members can read their own.
drop policy if exists "private self read" on public.profile_private;
create policy "private self read"
on public.profile_private for select
to authenticated
using (id = auth.uid());

drop policy if exists "private admin read" on public.profile_private;
create policy "private admin read"
on public.profile_private for select
to authenticated
using (public.is_admin());

drop policy if exists "private admin update" on public.profile_private;
create policy "private admin update"
on public.profile_private for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Stores.
drop policy if exists "stores member read" on public.stores;
create policy "stores member read"
on public.stores for select
to authenticated
using (public.is_enabled_member());

drop policy if exists "stores member insert" on public.stores;
create policy "stores member insert"
on public.stores for insert
to authenticated
with check (
  public.is_enabled_member()
  and created_by = auth.uid()
);

drop policy if exists "stores creator update" on public.stores;
create policy "stores creator update"
on public.stores for update
to authenticated
using (
  public.is_enabled_member()
  and created_by = auth.uid()
)
with check (
  created_by = auth.uid()
);

drop policy if exists "stores admin update" on public.stores;
create policy "stores admin update"
on public.stores for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "stores admin delete" on public.stores;
create policy "stores admin delete"
on public.stores for delete
to authenticated
using (public.is_admin());

-- Products.
drop policy if exists "products member read" on public.products;
create policy "products member read"
on public.products for select
to authenticated
using (public.is_enabled_member());

drop policy if exists "products member insert" on public.products;
create policy "products member insert"
on public.products for insert
to authenticated
with check (
  public.is_enabled_member()
  and created_by = auth.uid()
);

drop policy if exists "products creator update" on public.products;
create policy "products creator update"
on public.products for update
to authenticated
using (
  public.is_enabled_member()
  and created_by = auth.uid()
)
with check (created_by = auth.uid());

drop policy if exists "products admin update" on public.products;
create policy "products admin update"
on public.products for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "products admin delete" on public.products;
create policy "products admin delete"
on public.products for delete
to authenticated
using (public.is_admin());

-- Reports.
drop policy if exists "reports member read" on public.reports;
create policy "reports member read"
on public.reports for select
to authenticated
using (public.is_enabled_member());

drop policy if exists "reports member insert" on public.reports;
create policy "reports member insert"
on public.reports for insert
to authenticated
with check (
  public.is_enabled_member()
  and member_id = auth.uid()
);

drop policy if exists "reports own update" on public.reports;
create policy "reports own update"
on public.reports for update
to authenticated
using (
  public.is_enabled_member()
  and member_id = auth.uid()
)
with check (member_id = auth.uid());

drop policy if exists "reports admin update" on public.reports;
create policy "reports admin update"
on public.reports for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "reports admin delete" on public.reports;
create policy "reports admin delete"
on public.reports for delete
to authenticated
using (public.is_admin());

-- Confirm/dispute.
drop policy if exists "feedback member read" on public.report_feedback;
create policy "feedback member read"
on public.report_feedback for select
to authenticated
using (public.is_enabled_member());

drop policy if exists "feedback own insert" on public.report_feedback;
create policy "feedback own insert"
on public.report_feedback for insert
to authenticated
with check (
  public.is_enabled_member()
  and member_id = auth.uid()
);

drop policy if exists "feedback own update" on public.report_feedback;
create policy "feedback own update"
on public.report_feedback for update
to authenticated
using (
  public.is_enabled_member()
  and member_id = auth.uid()
)
with check (member_id = auth.uid());

drop policy if exists "feedback own delete" on public.report_feedback;
create policy "feedback own delete"
on public.report_feedback for delete
to authenticated
using (
  public.is_enabled_member()
  and member_id = auth.uid()
);

-- Saved Analytics.
drop policy if exists "analytics own read" on public.saved_analytics;
create policy "analytics own read"
on public.saved_analytics for select
to authenticated
using (
  public.is_enabled_member()
  and owner_id = auth.uid()
);

drop policy if exists "analytics own insert" on public.saved_analytics;
create policy "analytics own insert"
on public.saved_analytics for insert
to authenticated
with check (
  public.is_enabled_member()
  and owner_id = auth.uid()
);

drop policy if exists "analytics own update" on public.saved_analytics;
create policy "analytics own update"
on public.saved_analytics for update
to authenticated
using (
  public.is_enabled_member()
  and owner_id = auth.uid()
)
with check (owner_id = auth.uid());

drop policy if exists "analytics own delete" on public.saved_analytics;
create policy "analytics own delete"
on public.saved_analytics for delete
to authenticated
using (
  public.is_enabled_member()
  and owner_id = auth.uid()
);

-- Activity: users can see their own; admin sees all.
-- INSERT is only through trusted triggers/RPCs; no direct member insert policy.
drop policy if exists "activity self read" on public.member_activity;
create policy "activity self read"
on public.member_activity for select
to authenticated
using (member_id = auth.uid());

drop policy if exists "activity admin read" on public.member_activity;
create policy "activity admin read"
on public.member_activity for select
to authenticated
using (public.is_admin());

-- Ranking tiers are visible to members; only admin may change them.
drop policy if exists "tiers member read" on public.ranking_tiers;
create policy "tiers member read"
on public.ranking_tiers for select
to authenticated
using (public.is_enabled_member());

drop policy if exists "tiers admin insert" on public.ranking_tiers;
create policy "tiers admin insert"
on public.ranking_tiers for insert
to authenticated
with check (public.is_admin());

drop policy if exists "tiers admin update" on public.ranking_tiers;
create policy "tiers admin update"
on public.ranking_tiers for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "tiers admin delete" on public.ranking_tiers;
create policy "tiers admin delete"
on public.ranking_tiers for delete
to authenticated
using (public.is_admin());

-- App branding is readable by everyone; only admin changes it.
drop policy if exists "settings public read" on public.app_settings;
create policy "settings public read"
on public.app_settings for select
to anon, authenticated
using (true);

drop policy if exists "settings admin update" on public.app_settings;
create policy "settings admin update"
on public.app_settings for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ---------- PUBLIC VIEWER VIEWS ----------
-- Anonymous users do not get direct table access.
-- These views intentionally omit member IDs, usernames, source detail, private notes,
-- evidence URLs/images, and account data.

create or replace view public.public_stores as
select
  id, name, chain, address, city, state, postal_code,
  latitude, longitude, updated_at
from public.stores
where active = true;

create or replace view public.public_products as
select
  id, name, tcg, set_name, sku, upc, updated_at
from public.products
where active = true;

create or replace view public.public_activity as
select
  r.id,
  r.store_id,
  r.product_id,
  r.status,
  r.time_bucket,
  r.people_lining_up,
  r.possible_restock,
  r.restock_evidence,
  r.price,
  r.condition,
  r.occurred_at,
  r.occurred_at_is_approx,
  r.created_at
from public.reports r
join public.stores s on s.id = r.store_id and s.active = true
left join public.products p on p.id = r.product_id
where r.product_id is null or p.active = true;

revoke all on public.public_stores from public;
revoke all on public.public_products from public;
revoke all on public.public_activity from public;

grant select on public.public_stores to anon, authenticated;
grant select on public.public_products to anon, authenticated;
grant select on public.public_activity to anon, authenticated;

-- ---------- MEMBER RANKING VIEW ----------
-- Member-facing leaderboard intentionally excludes account/activity telemetry such as
-- sessions, active days, last active, login counts, and email addresses.
create or replace view public.member_contribution_rankings as
with stats as (
  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_path,
    count(*) filter (where a.event_type = 'report')::int as reports,
    count(*) filter (where a.event_type = 'confirm')::int as confirmations,
    (
      count(*) filter (where a.event_type = 'report')
      + count(*) filter (where a.event_type = 'confirm')
    )::int as contribution_points
  from public.profiles p
  join public.profile_private pp on pp.id = p.id and pp.is_enabled = true
  left join public.member_activity a on a.member_id = p.id
  group by p.id, p.username, p.display_name, p.avatar_path
)
select
  s.id,
  s.username,
  s.display_name,
  s.avatar_path,
  s.reports,
  s.confirmations,
  s.contribution_points,
  coalesce(
    (
      select rt.title
      from public.ranking_tiers rt
      where rt.min_points <= s.contribution_points
      order by rt.min_points desc
      limit 1
    ),
    'Scout'
  ) as ranking_title,
  dense_rank() over (order by s.contribution_points desc, s.username asc) as contribution_rank
from stats s;

revoke all on public.member_contribution_rankings from public;
grant select on public.member_contribution_rankings to authenticated;

-- Admin-only activity summary. Returns no rows for non-admins.
create or replace view public.admin_member_activity as
select
  p.id,
  p.username,
  p.display_name,
  p.avatar_path,
  pp.email,
  pp.is_enabled,
  pp.login_count,
  pp.session_count,
  pp.last_login_at,
  pp.last_active_at,
  count(*) filter (where a.event_type = 'report')::int as reports,
  count(*) filter (where a.event_type = 'confirm')::int as confirmations,
  count(*) filter (where a.event_type = 'dispute')::int as disputes,
  count(distinct (a.occurred_at at time zone 'UTC')::date)::int as active_days
from public.profiles p
join public.profile_private pp on pp.id = p.id
left join public.member_activity a on a.member_id = p.id
where public.is_admin()
group by
  p.id, p.username, p.display_name, p.avatar_path,
  pp.email, pp.is_enabled, pp.login_count, pp.session_count,
  pp.last_login_at, pp.last_active_at;

revoke all on public.admin_member_activity from public;
grant select on public.admin_member_activity to authenticated;

-- ---------- STORAGE BUCKETS ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('profile-images', 'profile-images', true, 524288, array['image/jpeg','image/png','image/webp']),
  ('app-branding', 'app-branding', true, 524288, array['image/jpeg','image/png','image/webp']),
  ('report-evidence', 'report-evidence', false, 1048576, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Profile images: path must start with the current user's UUID, e.g. <uid>/avatar.webp
drop policy if exists "profile image own insert" on storage.objects;
create policy "profile image own insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-images'
  and public.is_enabled_member()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "profile image own update" on storage.objects;
create policy "profile image own update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "profile image own delete" on storage.objects;
create policy "profile image own delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Admin-only app branding uploads.
drop policy if exists "branding admin insert" on storage.objects;
create policy "branding admin insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'app-branding'
  and public.is_admin()
);

drop policy if exists "branding admin update" on storage.objects;
create policy "branding admin update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'app-branding'
  and public.is_admin()
)
with check (
  bucket_id = 'app-branding'
  and public.is_admin()
);

drop policy if exists "branding admin delete" on storage.objects;
create policy "branding admin delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'app-branding'
  and public.is_admin()
);

-- Private report evidence: members can upload into their own UUID folder.
drop policy if exists "evidence own insert" on storage.objects;
create policy "evidence own insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'report-evidence'
  and public.is_enabled_member()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "evidence member read" on storage.objects;
create policy "evidence member read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'report-evidence'
  and public.is_enabled_member()
);

drop policy if exists "evidence own update" on storage.objects;
create policy "evidence own update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'report-evidence'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'report-evidence'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "evidence own delete" on storage.objects;
create policy "evidence own delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'report-evidence'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

-- ---------- FUNCTION PERMISSIONS ----------
revoke all on function public.update_my_profile(text,text,text) from public;
revoke all on function public.set_store_archived(uuid,boolean) from public;
revoke all on function public.set_product_archived(uuid,boolean) from public;
revoke all on function public.record_login() from public;
revoke all on function public.record_session() from public;

grant execute on function public.update_my_profile(text,text,text) to authenticated;
grant execute on function public.set_store_archived(uuid,boolean) to authenticated;
grant execute on function public.set_product_archived(uuid,boolean) to authenticated;
grant execute on function public.record_login() to authenticated;
grant execute on function public.record_session() to authenticated;

-- ---------- REALTIME ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'stores'
  ) then
    alter publication supabase_realtime add table public.stores;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'products'
  ) then
    alter publication supabase_realtime add table public.products;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reports'
  ) then
    alter publication supabase_realtime add table public.reports;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'report_feedback'
  ) then
    alter publication supabase_realtime add table public.report_feedback;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ranking_tiers'
  ) then
    alter publication supabase_realtime add table public.ranking_tiers;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_settings'
  ) then
    alter publication supabase_realtime add table public.app_settings;
  end if;
end $$;

commit;

-- IMPORTANT AFTER RUNNING:
-- 1) Sign into TCG Scout once with YOUR email so auth.users/profile rows exist.
-- 2) Then, in SQL Editor, promote only your account:
--
-- update public.profiles
-- set role = 'admin'
-- where id = (
--   select id from auth.users
--   where lower(email) = lower('YOUR_EMAIL_HERE')
-- );
--
-- Do not put the Supabase service_role key in the PWA.
