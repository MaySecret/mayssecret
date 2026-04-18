
-- Roles
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Users can view own roles" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);
create policy "Admins manage roles" on public.user_roles
  for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Timestamp helper
create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- Products
create type public.product_category as enum ('men', 'women', 'unisex');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  images text[] not null default '{}',
  category product_category not null default 'unisex',
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.products enable row level security;
create policy "Anyone can view products" on public.products for select using (true);
create policy "Admins manage products" on public.products for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create trigger products_updated before update on public.products
  for each row execute function public.update_updated_at_column();

-- Variants
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null,
  price numeric(12,2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.product_variants enable row level security;
create policy "Anyone can view variants" on public.product_variants for select using (true);
create policy "Admins manage variants" on public.product_variants for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create index on public.product_variants(product_id);
create trigger variants_updated before update on public.product_variants
  for each row execute function public.update_updated_at_column();

-- Orders
create type public.payment_status as enum ('pending', 'paid', 'failed');
create type public.delivery_status as enum ('processing', 'shipped', 'delivered');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique default ('MS-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  customer_name text not null,
  phone text not null,
  address text not null,
  total_price numeric(12,2) not null check (total_price >= 0),
  payment_status payment_status not null default 'pending',
  delivery_status delivery_status not null default 'processing',
  flutterwave_tx_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.orders enable row level security;
-- Public can create an order (checkout) and view by id (used right after creation on success page)
create policy "Anyone can create orders" on public.orders for insert with check (true);
create policy "Anyone can view orders" on public.orders for select using (true);
create policy "Admins update orders" on public.orders for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete orders" on public.orders for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create trigger orders_updated before update on public.orders
  for each row execute function public.update_updated_at_column();

-- Order items
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  variant_id uuid not null references public.product_variants(id),
  product_name text not null,
  variant_size text not null,
  quantity integer not null check (quantity > 0),
  price numeric(12,2) not null check (price >= 0),
  created_at timestamptz not null default now()
);
alter table public.order_items enable row level security;
create policy "Anyone can view order items" on public.order_items for select using (true);
create policy "Anyone can create order items" on public.order_items for insert with check (true);
create policy "Admins manage order items" on public.order_items for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create index on public.order_items(order_id);
