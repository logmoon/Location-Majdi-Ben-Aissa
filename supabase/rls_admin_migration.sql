-- Migration: tighten RLS so only authenticated admin JWTs can write
--
-- Run this in the Supabase SQL editor after:
--   1. Deploying the admin-login Edge Function
--   2. Setting JWT_SECRET in Edge Function secrets (must match the project's
--      real JWT secret exactly — see admin-login/index.ts header comment)
--   3. Inserting the admin_password_hash into app_config (see below)
--
-- To generate a bcrypt hash for your password, run locally:
--   node -e "const b = require('bcryptjs'); console.log(b.hashSync('your-password', 12));"
-- Then insert it:
--   INSERT INTO app_config (key, value)
--   VALUES ('admin_password_hash', '$2a$12$...')
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

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
DROP POLICY IF EXISTS "anon_read" ON rental_periods;
DROP POLICY IF EXISTS "admin_insert" ON rental_periods;
DROP POLICY IF EXISTS "admin_update" ON rental_periods;
DROP POLICY IF EXISTS "admin_delete" ON rental_periods;

CREATE POLICY "anon_read" ON rental_periods FOR SELECT USING (true);
CREATE POLICY "admin_insert" ON rental_periods FOR INSERT WITH CHECK (is_admin_request());
CREATE POLICY "admin_update" ON rental_periods FOR UPDATE USING (is_admin_request()) WITH CHECK (is_admin_request());
CREATE POLICY "admin_delete" ON rental_periods FOR DELETE USING (is_admin_request());

-- ─── houses ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "anon_all" ON houses;
DROP POLICY IF EXISTS "anon_read" ON houses;
DROP POLICY IF EXISTS "admin_insert" ON houses;
DROP POLICY IF EXISTS "admin_update" ON houses;
DROP POLICY IF EXISTS "admin_delete" ON houses;

CREATE POLICY "anon_read" ON houses FOR SELECT USING (true);
CREATE POLICY "admin_insert" ON houses FOR INSERT WITH CHECK (is_admin_request());
CREATE POLICY "admin_update" ON houses FOR UPDATE USING (is_admin_request()) WITH CHECK (is_admin_request());
CREATE POLICY "admin_delete" ON houses FOR DELETE USING (is_admin_request());

-- ─── house_images ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "anon_all" ON house_images;
DROP POLICY IF EXISTS "anon_read" ON house_images;
DROP POLICY IF EXISTS "admin_insert" ON house_images;
DROP POLICY IF EXISTS "admin_update" ON house_images;
DROP POLICY IF EXISTS "admin_delete" ON house_images;

CREATE POLICY "anon_read" ON house_images FOR SELECT USING (true);
CREATE POLICY "admin_insert" ON house_images FOR INSERT WITH CHECK (is_admin_request());
CREATE POLICY "admin_update" ON house_images FOR UPDATE USING (is_admin_request()) WITH CHECK (is_admin_request());
CREATE POLICY "admin_delete" ON house_images FOR DELETE USING (is_admin_request());

-- ─── push_tokens ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "anon_all" ON push_tokens;
DROP POLICY IF EXISTS "admin_all" ON push_tokens;

CREATE POLICY "admin_all" ON push_tokens FOR ALL USING (is_admin_request()) WITH CHECK (is_admin_request());

-- ─── app_config — THE ACTUAL SECURITY FIX ─────────────────────────────────────
-- app_config also holds admin_password_hash. It previously had a blanket
-- anon-write policy, so anyone with the app's public anon key could've
-- overwritten the password hash and logged in as admin. Now the anon key
-- can only touch minimum_build_version.

DROP POLICY IF EXISTS "anon_all" ON app_config;
DROP POLICY IF EXISTS "anon_write" ON app_config;
DROP POLICY IF EXISTS "anon_read" ON app_config;
DROP POLICY IF EXISTS "anon_write_build_version_only" ON app_config;
DROP POLICY IF EXISTS "admin_write" ON app_config;

CREATE POLICY "anon_read" ON app_config FOR SELECT USING (true);

CREATE POLICY "anon_write_build_version_only" ON app_config
  FOR ALL
  USING (key = 'minimum_build_version')
  WITH CHECK (key = 'minimum_build_version');

CREATE POLICY "admin_write" ON app_config
  FOR ALL USING (is_admin_request()) WITH CHECK (is_admin_request());

-- ─── Storage: house-images ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "anon_all" ON storage.objects;
DROP POLICY IF EXISTS "anon_read" ON storage.objects;
DROP POLICY IF EXISTS "admin_write" ON storage.objects;
DROP POLICY IF EXISTS "admin_delete" ON storage.objects;

CREATE POLICY "anon_read" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'house-images');
CREATE POLICY "admin_write" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'house-images' AND is_admin_request());
CREATE POLICY "admin_delete" ON storage.objects FOR DELETE USING (bucket_id = 'house-images' AND is_admin_request());
