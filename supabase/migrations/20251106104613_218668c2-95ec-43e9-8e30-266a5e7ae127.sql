-- Add founder and co_founder roles to the app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'founder';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'co_founder';