-- Enable realtime for subscriptions table
ALTER TABLE public.subscriptions REPLICA IDENTITY FULL;

-- Enable realtime for payments table
ALTER TABLE public.payments REPLICA IDENTITY FULL;

-- Note: Les tables sont déjà dans la publication supabase_realtime par défaut
-- Si besoin, on peut vérifier avec:
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';