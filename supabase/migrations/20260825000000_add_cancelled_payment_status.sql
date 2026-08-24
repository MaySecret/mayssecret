-- Add 'cancelled' to the payment_status enum so a cancelled/abandoned payment
-- is recorded explicitly (not left as 'pending'), preventing orders from being
-- treated as placed without verified payment.
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'cancelled';
