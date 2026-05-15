-- Run this in your Supabase SQL Editor
-- Dashboard → SQL Editor → New Query

ALTER TABLE visits 
ADD COLUMN IF NOT EXISTS investigations JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS visits_investigations_idx ON visits USING gin(investigations);

COMMENT ON COLUMN visits.investigations IS 'Array of {id, imageUrl, fileName, uploadedAt} - stored in Cloudflare R2';
