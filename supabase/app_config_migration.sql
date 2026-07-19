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

-- RLS: initial policy — SUPERSEDED by rls_admin_migration.sql, which scopes
-- writes to only the minimum_build_version key. Do NOT leave this open
-- "USING (true)" policy as the final state: this table also ends up holding
-- admin_password_hash (see admin-login Edge Function), and a blanket write
-- policy would let anyone with the app's public anon key overwrite it and
-- log in as admin. Always run rls_admin_migration.sql after this one.
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
