/**
 * adminAuthService
 *
 * Handles admin authentication via the admin-login Supabase Edge Function.
 * The Edge Function verifies the password against a bcrypt hash stored in
 * app_config and returns a signed JWT. We then set that JWT on the Supabase
 * client so all subsequent requests carry it — satisfying the RLS policies
 * that require role = 'admin'.
 */

import Constants from 'expo-constants';
import { clearAdminSession, setAdminSession } from '../../lib/supabase';

// Edge Function URL — derived from the Supabase project URL
const supabaseUrl: string =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  Constants.expoConfig?.extra?.supabaseUrl ??
  '';

const supabaseAnonKey: string =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  Constants.expoConfig?.extra?.supabaseAnonKey ??
  '';

const ADMIN_LOGIN_URL = `${supabaseUrl}/functions/v1/admin-login`;

export type LoginResult =
  | { success: true }
  | { success: false; error: 'invalid_password' | 'server_error' | 'network_error' };

export const adminAuthService = {
  /**
   * Verify the password with the Edge Function and set the admin JWT session.
   * Returns a typed result so the caller can show the right error message.
   */
  async login(password: string): Promise<LoginResult> {
    try {
      const response = await fetch(ADMIN_LOGIN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // The anon key is required to invoke the Edge Function
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ password }),
      });

      if (response.status === 401) {
        return { success: false, error: 'invalid_password' };
      }

      if (!response.ok) {
        console.error('[adminAuth] Edge Function error:', response.status, await response.text());
        return { success: false, error: 'server_error' };
      }

      const { token } = await response.json();
      if (!token) {
        console.error('[adminAuth] No token in response');
        return { success: false, error: 'server_error' };
      }

      // Set the JWT on the Supabase client — all subsequent DB calls carry it
      await setAdminSession(token);
      return { success: true };
    } catch (err) {
      console.error('[adminAuth] Network error:', err);
      return { success: false, error: 'network_error' };
    }
  },

  /**
   * Clear the admin JWT session on logout.
   */
  async logout(): Promise<void> {
    await clearAdminSession();
  },
};

export default adminAuthService;
