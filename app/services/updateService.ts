import { Linking } from 'react-native';
import { parseMinimumBuildVersion } from '../../lib/dataMappers';
import { supabase } from '../../lib/supabase';

// GitHub Releases — always points to the latest APK, no auth required
const DOWNLOAD_URL = 'https://github.com/logmoon/Location-Majdi-Ben-Aissa/releases/latest/download/app-release.apk';

export const updateService = {
  /**
   * Fetch the minimum required build version from Supabase.
   * Returns null if the check fails (network error, etc.) — we fail open,
   * meaning we never block the user if we can't reach the server.
   */
  async fetchMinimumBuildVersion(): Promise<number | null> {
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'minimum_build_version')
        .single();

      if (error || !data) return null;
      return parseMinimumBuildVersion(data.value);
    } catch {
      return null;
    }
  },

  /**
   * Open the Drive download link so the user can get the new APK.
   */
  openDownloadLink() {
    Linking.openURL(DOWNLOAD_URL).catch(err =>
      console.error('Could not open download URL:', err)
    );
  },
};

export default updateService;
