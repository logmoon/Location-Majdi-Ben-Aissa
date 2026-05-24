import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import 'react-native-url-polyfill/auto';

// Read from environment variables (set in .env / CI secrets).
// Falls back to the values in app.config.js extra for builds that don't
// have a .env file (e.g. EAS cloud builds using CI secrets).
const supabaseUrl: string =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  Constants.expoConfig?.extra?.supabaseUrl ??
  '';

const supabaseAnonKey: string =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  Constants.expoConfig?.extra?.supabaseAnonKey ??
  '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Create a .env file at the project root with these values.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// In-memory store for the admin JWT (custom-signed, not a Supabase auth token).
// We can't use supabase.auth.setSession() because that validates against
// Supabase's own JWT secret — our token is signed with ADMIN_JWT_SECRET instead.
let _adminToken: string | null = null;

/**
 * Returns a Supabase client that sends the admin JWT as the Authorization header.
 * Use this for any write operation that requires the admin RLS policy.
 * Falls back to the anon client if no admin session is active.
 */
export function getAdminClient() {
  if (!_adminToken) return supabase;
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${_adminToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Persist the admin JWT so getAdminClient() picks it up.
 * Also saves it to AsyncStorage so it survives app restarts.
 */
export async function setAdminSession(accessToken: string): Promise<void> {
  _adminToken = accessToken;
  await AsyncStorage.setItem('admin_jwt', accessToken);
}

/**
 * Restore the admin JWT from AsyncStorage on app start.
 * Call this once during app initialisation (e.g. in _layout.tsx).
 */
export async function restoreAdminSession(): Promise<boolean> {
  try {
    const token = await AsyncStorage.getItem('admin_jwt');
    if (token) {
      _adminToken = token;
      return true;
    }
  } catch (_) {}
  return false;
}

/**
 * Clear the admin JWT — called on logout.
 */
export async function clearAdminSession(): Promise<void> {
  _adminToken = null;
  await AsyncStorage.removeItem('admin_jwt');
}

const supabaseExport = { supabase, getAdminClient, setAdminSession, restoreAdminSession, clearAdminSession };
export default supabaseExport;
