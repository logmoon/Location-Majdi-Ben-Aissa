-- Migration: push_tokens table for server-side push notifications
-- Only admin devices register a token, so every row here is an admin device.

CREATE TABLE IF NOT EXISTS push_tokens (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  token       TEXT        NOT NULL UNIQUE,          -- Expo push token
  device_id   TEXT        NOT NULL UNIQUE,          -- stable per-device identifier
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON push_tokens
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- RLS: same open anon policy as the rest of the app
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON push_tokens
  FOR ALL
  USING (true)
  WITH CHECK (true);
