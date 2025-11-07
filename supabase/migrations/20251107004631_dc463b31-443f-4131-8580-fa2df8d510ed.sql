-- Enable realtime for generated_videos table
ALTER TABLE public.generated_videos REPLICA IDENTITY FULL;

-- Add the table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.generated_videos;

-- Add a progress field to track generation steps
ALTER TABLE public.generated_videos 
ADD COLUMN IF NOT EXISTS progress_step TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0;