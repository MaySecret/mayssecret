-- Track how an order is fulfilled and, for delivery, which state it ships to.
alter table public.orders add column if not exists fulfillment text not null default 'delivery';
alter table public.orders add column if not exists state text;
