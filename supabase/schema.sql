-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create a table for rental periods
CREATE TABLE rental_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  house_id INTEGER NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  renter_name TEXT,
  notes TEXT,
  start_half_day BOOLEAN DEFAULT FALSE,
  end_half_day BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on house_id for faster queries
CREATE INDEX idx_rental_periods_house_id ON rental_periods(house_id);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update the updated_at field
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON rental_periods
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Enable Row Level Security and allow anon access
-- (RLS is a framework — update policies when auth is added)
ALTER TABLE rental_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON rental_periods
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create houses table
CREATE TABLE IF NOT EXISTS houses (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  code TEXT UNIQUE,
  price DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON houses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

ALTER TABLE houses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON houses
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create house_images table for multiple images per house
CREATE TABLE IF NOT EXISTS house_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  house_id INTEGER NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_house_images_house_id ON house_images(house_id);

ALTER TABLE house_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON house_images
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Seed house data (only if empty)
INSERT INTO houses (name, description, code)
SELECT * FROM (VALUES
  ('Maison 1', 'S+2 - Première étage - Maison 1', '1-1'),
  ('Maison 2', 'S+2 - Première étage - Maison 2', '1-2'),
  ('Maison 3', 'S+2 - Deuxième étage - Maison 1', '2-1'),
  ('Maison 4', 'S+2 - Deuxième étage - Maison 2', '2-2'),
  ('Maison 5', 'S+2 - Troisième étage - Maison 1', '3-1')
) AS v(name, description, code)
WHERE NOT EXISTS (SELECT 1 FROM houses);

-- Storage: allow anon access to house-images bucket
-- Note: the bucket must also be set to Public in the Supabase dashboard
--       (Storage → house-images → Settings → Public bucket)
INSERT INTO storage.buckets (id, name, public)
VALUES ('house-images', 'house-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "anon_all" ON storage.objects
  FOR ALL TO anon
  USING (bucket_id = 'house-images')
  WITH CHECK (bucket_id = 'house-images');
