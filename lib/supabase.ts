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

const ADMIN_JWT_KEY = 'admin_jwt';
const PASSWORD_VERSION_KEY = 'admin_password_version';

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
 * Also saves the current password_version so we can detect remote invalidation.
 */
export async function setAdminSession(accessToken: string): Promise<void> {
  _adminToken = accessToken;
  await AsyncStorage.setItem(ADMIN_JWT_KEY, accessToken);
  // Snapshot the current password_version at login time
  try {
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'password_version')
      .single();
    if (data?.value) {
      await AsyncStorage.setItem(PASSWORD_VERSION_KEY, data.value);
    } else {
      // No version in DB yet — store a sentinel so restoreAdminSession can
      // correctly compare on next launch.
      await AsyncStorage.setItem(PASSWORD_VERSION_KEY, '0');
    }
  } catch (_) {
    // Fetch failed (network error during login).
    // Store a marker so restoreAdminSession doesn't incorrectly think the
    // version changed on next app start. Using a timestamp ensures any real
    // value fetched later will differ, forcing a re-check.
    await AsyncStorage.setItem(PASSWORD_VERSION_KEY, new Date().toISOString());
  }
}

/**
 * Restore the admin JWT from AsyncStorage on app start.
 * Validates the stored password_version against Supabase — if the password
 * was changed since last login, clears the session and returns false.
 */
export async function restoreAdminSession(): Promise<boolean> {
  try {
    const token = await AsyncStorage.getItem(ADMIN_JWT_KEY);
    if (!token) return false;

    // Check if the password has been changed since this session was created
    const storedVersion = await AsyncStorage.getItem(PASSWORD_VERSION_KEY);
    try {
      const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'password_version')
        .single();
      const remoteVersion = data?.value ?? '0';
      const localVersion = storedVersion ?? '0';
      if (remoteVersion !== localVersion) {
        // Password was changed — invalidate this session
        await clearAdminSession();
        return false;
      }
    } catch (_) {
      // Network error — fail open (don't log out when offline)
    }

    _adminToken = token;
    return true;
  } catch (_) {}
  return false;
}

/**
 * Check if the current session is still valid against the remote password_version.
 * Call this periodically while the admin is logged in.
 * Returns false and clears the session if the password was changed remotely.
 */
export async function validateAdminSession(): Promise<boolean> {
  if (!_adminToken) return false;
  try {
    const storedVersion = await AsyncStorage.getItem(PASSWORD_VERSION_KEY);
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'password_version')
      .single();
    const remoteVersion = data?.value ?? '0';
    const localVersion = storedVersion ?? '0';
    if (remoteVersion !== localVersion) {
      await clearAdminSession();
      return false;
    }
    return true;
  } catch (_) {
    return true; // fail open on network error
  }
}

/**
 * Clear the admin JWT — called on logout.
 */
export async function clearAdminSession(): Promise<void> {
  _adminToken = null;
  await AsyncStorage.removeItem(ADMIN_JWT_KEY);
  await AsyncStorage.removeItem(PASSWORD_VERSION_KEY);
}

export function hasAdminSession(): boolean {
  return _adminToken !== null;
}

const supabaseExport = { supabase, getAdminClient, setAdminSession, restoreAdminSession, clearAdminSession, hasAdminSession };
export default supabaseExport;
