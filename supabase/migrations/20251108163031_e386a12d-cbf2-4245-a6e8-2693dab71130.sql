-- Add credits column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS purchased_credits INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS has_showcase_access BOOLEAN DEFAULT FALSE;

-- Create table to track credit purchases
CREATE TABLE IF NOT EXISTS public.credit_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pack_size INTEGER NOT NULL,
  pack_price INTEGER NOT NULL,
  credits_added INTEGER NOT NULL,
  payment_id UUID REFERENCES public.payments(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own credit purchases"
ON public.credit_purchases
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service can insert credit purchases"
ON public.credit_purchases
FOR INSERT
WITH CHECK (true);

-- Create index
CREATE INDEX idx_credit_purchases_user ON public.credit_purchases(user_id);