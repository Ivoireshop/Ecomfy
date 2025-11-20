-- Create bookings table for managing reservations
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  showcase_site_id UUID NOT NULL REFERENCES showcase_sites(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  service_type TEXT NOT NULL,
  service_name TEXT NOT NULL,
  number_of_participants INTEGER DEFAULT 1,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed'))
);

-- Enable RLS
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Anyone can create a booking
CREATE POLICY "Anyone can create bookings"
ON public.bookings
FOR INSERT
WITH CHECK (true);

-- Users can view bookings for their showcase sites
CREATE POLICY "Users can view their site bookings"
ON public.bookings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM showcase_sites
    WHERE showcase_sites.id = bookings.showcase_site_id
    AND showcase_sites.user_id = auth.uid()
  )
);

-- Users can update bookings for their showcase sites
CREATE POLICY "Users can update their site bookings"
ON public.bookings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM showcase_sites
    WHERE showcase_sites.id = bookings.showcase_site_id
    AND showcase_sites.user_id = auth.uid()
  )
);

-- Create index for better query performance
CREATE INDEX idx_bookings_showcase_site_id ON public.bookings(showcase_site_id);
CREATE INDEX idx_bookings_date ON public.bookings(booking_date);
CREATE INDEX idx_bookings_status ON public.bookings(status);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_bookings_updated_at
BEFORE UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION update_bookings_updated_at();