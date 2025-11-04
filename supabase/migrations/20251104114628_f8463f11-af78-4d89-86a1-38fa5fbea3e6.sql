-- Add fields to feedback table for user information
ALTER TABLE feedback 
ADD COLUMN full_name TEXT,
ADD COLUMN country TEXT,
ADD COLUMN photo_url TEXT;

-- Add index for published feedback queries
CREATE INDEX IF NOT EXISTS idx_feedback_published ON feedback(status, created_at DESC) WHERE status = 'published';