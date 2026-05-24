-- Migration: app_config table for force-update gating

CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to keep updated_at fresh
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON app_config
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- RLS: same open policy as the rest of the app
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON app_config
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Seed: minimum_build_version starts at 1
-- Bump this number whenever you do a native rebuild that users must install
INSERT INTO app_config (key, value)
VALUES ('minimum_build_version', '1')
ON CONFLICT (key) DO NOTHING;
