/**
 * admin-login — Supabase Edge Function
 *
 * Verifies the admin password and returns a short-lived JWT that the app
 * uses for all write operations. The JWT satisfies the RLS policies that
 * require `request.jwt.claims->>'role' = 'admin'`.
 *
 * Password storage:
 *   The password is stored as a bcrypt hash in app_config under the key
 *   'admin_password_hash'. To set or rotate the password, run:
 *
 *     node -e "const b = require('bcryptjs'); console.log(b.hashSync('your-password', 12));"
 *   or:
 *     npx bcryptjs "your-password"
 *
 *   Then upsert the result into app_config:
 *     INSERT INTO app_config (key, value) VALUES ('admin_password_hash', '<hash>')
 *     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
 *
 * Required environment variables (set in Supabase dashboard → Edge Functions → Secrets):
 *   JWT_SECRET                — MUST be manually set to the exact value of your project's
 *                               JWT secret (Dashboard → Settings → API → JWT Secret). This is
 *                               NOT auto-injected: Supabase reserves the "SUPABASE_" prefix for
 *                               its own auto-injected vars (SUPABASE_URL, SUPABASE_ANON_KEY,
 *                               SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL) and rejects attempts
 *                               to manually set a secret named SUPABASE_JWT_SECRET — hence the
 *                               plain "JWT_SECRET" name here for the manually-copied value.
 *   SUPABASE_URL               — auto-injected by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY  — auto-injected by Supabase
 *
 * NOTE: JWT_SECRET's value must exactly match the project's real JWT secret shown in the
 * dashboard, or PostgREST will reject every token this function issues with a PGRST301 error
 * on the very next request — i.e. login would appear to succeed here, but every subsequent
 * "admin" write (rentals, houses, tasks) would then silently fail. If JWT_SECRET is ever
 * rotated in the dashboard, this Edge Function secret must be updated to match.
 */

import { create } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import bcrypt from 'https://esm.sh/bcryptjs@2.4.3';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { password } = await req.json();

    if (!password || typeof password !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Password required' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role key to read the password hash — bypasses RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'admin_password_hash')
      .single();

    if (error || !data?.value) {
      console.error('[admin-login] Could not fetch password hash:', error);
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // Verify password against stored bcrypt hash
    const isValid = await bcrypt.compare(password, data.value);

    if (!isValid) {
      // Constant-time response to prevent timing attacks
      return new Response(
        JSON.stringify({ error: 'Invalid password' }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // Sign a JWT valid for 7 days using the project's real JWT secret (copied
    // manually into the JWT_SECRET function secret — see header comment for why).
    const jwtSecret = Deno.env.get('JWT_SECRET');
    if (!jwtSecret) {
      console.error('[admin-login] JWT_SECRET not set');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(jwtSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );

    const token = await create(
      { alg: 'HS256', typ: 'JWT' },
      {
        // Use 'app_role' instead of 'role' — PostgREST treats 'role' as a
        // PostgreSQL database role and tries to SET ROLE, which fails if the
        // role doesn't exist. 'app_role' is a custom claim that RLS can read
        // via request.jwt.claims without triggering any role switching.
        app_role: 'admin',
        iat: now,
        exp: now + 7 * 24 * 60 * 60, // 7 days
      },
      key
    );

    return new Response(
      JSON.stringify({ token }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[admin-login] Unhandled error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
});
