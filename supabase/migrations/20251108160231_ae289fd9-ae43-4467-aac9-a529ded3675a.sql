-- Create generation_queue table for managing concurrent image generation
CREATE TABLE IF NOT EXISTS public.generation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  queue_position INTEGER,
  
  -- Generation parameters
  prompt TEXT NOT NULL,
  product_details JSONB,
  platform TEXT NOT NULL,
  
  -- Results
  image_url TEXT,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Metadata
  processing_time_ms INTEGER,
  retry_count INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.generation_queue ENABLE ROW LEVEL SECURITY;

-- Users can view their own queue items
CREATE POLICY "Users can view their own queue items"
ON public.generation_queue
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own queue items
CREATE POLICY "Users can insert their own queue items"
ON public.generation_queue
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Only backend (service role) can update queue items
CREATE POLICY "Backend can update queue items"
ON public.generation_queue
FOR UPDATE
USING (true);

-- Founders can view all queue items
CREATE POLICY "Founders can view all queue items"
ON public.generation_queue
FOR SELECT
USING (
  has_role(auth.uid(), 'founder'::app_role) OR has_role(auth.uid(), 'co_founder'::app_role)
);

-- Create index for efficient queue processing
CREATE INDEX idx_generation_queue_status ON public.generation_queue(status);
CREATE INDEX idx_generation_queue_user_created ON public.generation_queue(user_id, created_at DESC);
CREATE INDEX idx_generation_queue_pending ON public.generation_queue(created_at) WHERE status = 'pending';

-- Enable realtime for the generation_queue table
ALTER PUBLICATION supabase_realtime ADD TABLE public.generation_queue;

-- Function to get next pending item in queue
CREATE OR REPLACE FUNCTION public.get_next_queue_item()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_id UUID;
BEGIN
  -- Get the oldest pending item
  SELECT id INTO next_id
  FROM public.generation_queue
  WHERE status = 'pending'
  ORDER BY created_at ASC
  LIMIT 1;
  
  RETURN next_id;
END;
$$;

-- Function to count processing items
CREATE OR REPLACE FUNCTION public.count_processing_generations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  count INTEGER;
BEGIN
  SELECT COUNT(*) INTO count
  FROM public.generation_queue
  WHERE status = 'processing';
  
  RETURN count;
END;
$$;