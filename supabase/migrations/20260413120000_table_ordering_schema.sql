-- Hungry Tiger — initial Postgres schema for table ordering (run in Supabase SQL Editor or via CLI).
-- Requires: Phone (or any) auth so auth.users exists.

-- ─── Profiles (mirror auth user) ───────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text,
  full_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- ─── Restaurants & floor ────────────────────────────────
create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  code text not null,
  label text,
  unique (restaurant_id, code)
);

create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  sort_order int not null default 0
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  category_id uuid references public.menu_categories (id) on delete set null,
  name text not null,
  description text,
  price_cents int not null,
  image_url text,
  is_available boolean not null default true
);

alter table public.restaurants enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;

-- Logged-in customers can read catalog (tighten per restaurant later).
create policy "restaurants_read_auth" on public.restaurants for select to authenticated using (true);
create policy "tables_read_auth" on public.restaurant_tables for select to authenticated using (true);
create policy "menu_categories_read_auth" on public.menu_categories for select to authenticated using (true);
create policy "menu_items_read_auth" on public.menu_items for select to authenticated using (true);

-- ─── Orders ────────────────────────────────────────────────────────────────
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_id uuid references public.restaurant_tables (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending',
  subtotal_cents int not null default 0,
  tax_cents int not null default 0,
  service_fee_cents int not null default 0,
  total_cents int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  menu_item_id uuid references public.menu_items (id) on delete set null,
  name_snapshot text not null,
  unit_price_cents int not null,
  quantity int not null default 1,
  line_total_cents int not null
);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "orders_select_own" on public.orders
  for select to authenticated using (auth.uid() = user_id);

create policy "orders_insert_own" on public.orders
  for insert to authenticated with check (auth.uid() = user_id);

create policy "orders_update_own" on public.orders
  for update to authenticated using (auth.uid() = user_id);

create policy "order_items_select_own" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );

create policy "order_items_insert_own" on public.order_items
  for insert to authenticated with check (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );

create policy "order_items_update_own" on public.order_items
  for update to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );

-- ─── New auth user → profile row ────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, new.phone);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
