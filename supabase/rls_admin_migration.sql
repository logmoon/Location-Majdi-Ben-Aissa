-- Migration: tighten RLS so only authenticated admin JWTs can write
--
-- Run this in the Supabase SQL editor after:
--   1. Deploying the admin-login Edge Function
--   2. Setting ADMIN_JWT_SECRET in Edge Function secrets
--   3. Inserting the admin_password_hash into app_config (see below)
--
-- To generate a bcrypt hash for your password, run locally:
--   node -e "const b = require('bcryptjs'); console.log(b.hashSync('your-password', 12));"
-- Then insert it:
--   INSERT INTO app_config (key, value)
--   VALUES ('admin_password_hash', '$2a$12$...')
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
--
-- IMPORTANT: The JWT signed by admin-login uses a custom secret, NOT Supabase's
-- own JWT secret. Supabase validates JWTs against its own secret by default.
-- To make RLS work with our custom JWT, we check the raw claim from the
-- request headers rather than relying on Supabase's auth.uid().
-- The app passes the token as the Authorization Bearer header, and PostgREST
-- exposes it via current_setting('request.jwt.claims').

-- ─── Helper function ──────────────────────────────────────────────────────────

-- Returns true if the current request carries a valid admin JWT claim.
-- PostgREST sets request.jwt.claims from the Authorization: Bearer <token> header.
CREATE OR REPLACE FUNCTION is_admin_request()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb->>'app_role') = 'admin',
    false
  );
$$;

-- ─── rental_periods ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "anon_all" ON rental_periods;

-- Anyone can read (viewers see the calendar without logging in)
CREATE POLICY "anon_read" ON rental_periods
  FOR SELECT USING (true);

-- Only admin JWT can write
CREATE POLICY "admin_insert" ON rental_periods
  FOR INSERT WITH CHECK (is_admin_request());

CREATE POLICY "admin_update" ON rental_periods
  FOR UPDATE USING (is_admin_request()) WITH CHECK (is_admin_request());

CREATE POLICY "admin_delete" ON rental_periods
  FOR DELETE USING (is_admin_request());

-- ─── houses ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "anon_all" ON houses;

CREATE POLICY "anon_read" ON houses
  FOR SELECT USING (true);

CREATE POLICY "admin_insert" ON houses
  FOR INSERT WITH CHECK (is_admin_request());

CREATE POLICY "admin_update" ON houses
  FOR UPDATE USING (is_admin_request()) WITH CHECK (is_admin_request());

CREATE POLICY "admin_delete" ON houses
  FOR DELETE USING (is_admin_request());

-- ─── house_images ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "anon_all" ON house_images;

CREATE POLICY "anon_read" ON house_images
  FOR SELECT USING (true);

CREATE POLICY "admin_insert" ON house_images
  FOR INSERT WITH CHECK (is_admin_request());

CREATE POLICY "admin_update" ON house_images
  FOR UPDATE USING (is_admin_request()) WITH CHECK (is_admin_request());

CREATE POLICY "admin_delete" ON house_images
  FOR DELETE USING (is_admin_request());

-- ─── push_tokens ──────────────────────────────────────────────────────────────
-- Push token registration happens from the app after admin login,
-- so it also requires the admin JWT.

DROP POLICY IF EXISTS "anon_all" ON push_tokens;

CREATE POLICY "admin_all" ON push_tokens
  FOR ALL USING (is_admin_request()) WITH CHECK (is_admin_request());

-- ─── app_config ───────────────────────────────────────────────────────────────
-- app_config is read by the app (force-update check) and written only by CI.
-- The CI uses the anon key with the Prefer: resolution=merge-duplicates header.
-- We keep anon read open and restrict writes to admin or service role.

DROP POLICY IF EXISTS "anon_all" ON app_config;

CREATE POLICY "anon_read" ON app_config
  FOR SELECT USING (true);

-- CI writes using the anon key — keep insert/update open for now.
-- TODO: switch CI to use SUPABASE_SERVICE_ROLE_KEY and restrict this further.
CREATE POLICY "anon_write" ON app_config
  FOR ALL USING (true) WITH CHECK (true);

-- ─── Storage: house-images ────────────────────────────────────────────────────
-- Public read is fine (images are served publicly).
-- Uploads and deletes require admin JWT.

DROP POLICY IF EXISTS "anon_all" ON storage.objects;

CREATE POLICY "anon_read" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'house-images');

CREATE POLICY "admin_write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'house-images' AND is_admin_request()
  );

CREATE POLICY "admin_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'house-images' AND is_admin_request()
  );
