-- Per-state delivery rates. Default price is 10000 (NGN).
create table if not exists public.state_delivery_rates (
  id uuid primary key default gen_random_uuid(),
  state text unique not null,
  price numeric not null default 10000,
  updated_at timestamptz not null default now()
);

alter table public.state_delivery_rates enable row level security;

-- Anyone (including anonymous checkout) may read rates.
drop policy if exists "Public can read delivery rates" on public.state_delivery_rates;
create policy "Public can read delivery rates"
  on public.state_delivery_rates for select
  using (true);

-- Only signed-in admins may manage rates.
drop policy if exists "Admins can manage delivery rates" on public.state_delivery_rates;
create policy "Admins can manage delivery rates"
  on public.state_delivery_rates for all
  to authenticated
  using (true)
  with check (true);
