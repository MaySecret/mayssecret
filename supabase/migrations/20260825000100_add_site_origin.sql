-- Store the site origin used at checkout so the order-redirect edge function can
-- send the browser back to the correct frontend route after verifying payment.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS site_origin text not null default '';
