-- Migration: add house_tasks table

CREATE TABLE IF NOT EXISTS house_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  house_id INTEGER NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  -- rental_period_id links the task back to the rental that triggered it (nullable — manual tasks have no rental)
  rental_period_id UUID REFERENCES rental_periods(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('cleaning', 'purchase', 'repair', 'replacement')),
  description TEXT NOT NULL,
  is_urgent BOOLEAN NOT NULL DEFAULT FALSE,
  is_done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast per-house queries (the most common access pattern)
CREATE INDEX idx_house_tasks_house_id ON house_tasks(house_id);

-- Index for the auto-task dedup check (cleaningTaskExistsForRental)
CREATE INDEX idx_house_tasks_rental_period_id ON house_tasks(rental_period_id);

-- Reuse the existing update_updated_at trigger function
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON house_tasks
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- RLS: same open policy as the rest of the app (tighten when auth is added)
ALTER TABLE house_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON house_tasks
  FOR ALL
  USING (true)
  WITH CHECK (true);
