-- Create table for storing generated images
CREATE TABLE public.generated_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  prompt TEXT NOT NULL,
  product_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;

-- Users can view their own images
CREATE POLICY "Users can view their own images"
ON public.generated_images
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own images
CREATE POLICY "Users can insert their own images"
ON public.generated_images
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own images
CREATE POLICY "Users can delete their own images"
ON public.generated_images
FOR DELETE
USING (auth.uid() = user_id);

-- Create table for storing generated videos
CREATE TABLE public.generated_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  video_url TEXT NOT NULL,
  prompt TEXT NOT NULL,
  product_details JSONB,
  status TEXT NOT NULL DEFAULT 'processing',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.generated_videos ENABLE ROW LEVEL SECURITY;

-- Users can view their own videos
CREATE POLICY "Users can view their own videos"
ON public.generated_videos
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own videos
CREATE POLICY "Users can insert their own videos"
ON public.generated_videos
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own videos
CREATE POLICY "Users can delete their own videos"
ON public.generated_videos
FOR DELETE
USING (auth.uid() = user_id);

-- Add video generations counter to subscriptions table
ALTER TABLE public.subscriptions
ADD COLUMN video_generations_remaining INTEGER NOT NULL DEFAULT 5;

-- Add trigger to update video_generations_remaining when subscription becomes active
CREATE OR REPLACE FUNCTION public.reset_video_generations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' AND OLD.status = 'inactive' THEN
    NEW.video_generations_remaining = 5;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER reset_video_generations_on_activation
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.reset_video_generations();