-- Update subscription amount to 1000 XOF
ALTER TABLE public.subscriptions 
ALTER COLUMN amount SET DEFAULT 1000;

-- Update existing subscriptions to new price
UPDATE public.subscriptions 
SET amount = 1000;