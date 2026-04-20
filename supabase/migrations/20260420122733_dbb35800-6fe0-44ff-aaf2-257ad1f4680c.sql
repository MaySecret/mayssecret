
-- 1. site_settings (single row)
CREATE TABLE public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_fee numeric NOT NULL DEFAULT 2500,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view site settings"
  ON public.site_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins manage site settings"
  ON public.site_settings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.site_settings (shipping_fee) VALUES (2500);

CREATE TRIGGER site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Orders: add columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS subtotal numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS guest_id text,
  ADD COLUMN IF NOT EXISTS kora_reference text;

CREATE INDEX IF NOT EXISTS idx_orders_order_code ON public.orders(order_code);
CREATE INDEX IF NOT EXISTS idx_orders_kora_reference ON public.orders(kora_reference);
CREATE INDEX IF NOT EXISTS idx_orders_guest_id ON public.orders(guest_id);

-- Allow public lookup by order code (success page, guests)
DROP POLICY IF EXISTS "Users view own orders" ON public.orders;
CREATE POLICY "Anyone can view orders"
  ON public.orders FOR SELECT
  USING (true);

-- Same for order_items so success page can list them
DROP POLICY IF EXISTS "Users view own order items" ON public.order_items;
CREATE POLICY "Anyone can view order items"
  ON public.order_items FOR SELECT
  USING (true);

-- 3. Drop customer-only tables (admin login + user_roles untouched)
DROP TABLE IF EXISTS public.cart_items CASCADE;
DROP TABLE IF EXISTS public.carts CASCADE;
DROP TABLE IF EXISTS public.order_status_history CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 4. Drop the auto-profile trigger/function (no customer signups anymore)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
