-- Create table to track email reminders sent
CREATE TABLE IF NOT EXISTS public.email_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('after_2_generations', 'after_3_generations')),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_reminders ENABLE ROW LEVEL SECURITY;

-- Create policy for service role only (edge functions)
CREATE POLICY "Service role can manage email reminders"
ON public.email_reminders
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_email_reminders_user_type ON public.email_reminders(user_id, reminder_type);