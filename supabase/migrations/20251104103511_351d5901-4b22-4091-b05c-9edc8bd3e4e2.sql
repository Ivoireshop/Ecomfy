-- Create table for storing different image formats
CREATE TABLE public.image_formats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_id UUID NOT NULL REFERENCES public.generated_images(id) ON DELETE CASCADE,
  format_name TEXT NOT NULL,
  format_size TEXT NOT NULL,
  platform TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.image_formats ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own image formats"
ON public.image_formats
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.generated_images
    WHERE generated_images.id = image_formats.image_id
    AND generated_images.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own image formats"
ON public.image_formats
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.generated_images
    WHERE generated_images.id = image_formats.image_id
    AND generated_images.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own image formats"
ON public.image_formats
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.generated_images
    WHERE generated_images.id = image_formats.image_id
    AND generated_images.user_id = auth.uid()
  )
);

-- Create index for faster queries
CREATE INDEX idx_image_formats_image_id ON public.image_formats(image_id);