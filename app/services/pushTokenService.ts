import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getAdminClient } from '../../lib/supabase';

/**
 * Derives a stable device identifier.
 * expo-device provides modelId on iOS and modelName on Android — combined with
 * the install-time unique ID from Notifications.getExpoPushTokenAsync we get
 * something stable enough for a family app without needing expo-application.
 *
 * We use a simple hash of the token itself as the device_id since the token
 * is already unique per device+app installation.
 */
const deriveDeviceId = (token: string): string => {
  // Use last 32 chars of the token as a stable device key.
  // Expo push tokens look like: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
  // The bracketed part is already unique per device.
  const match = token.match(/\[(.+)\]/);
  return match ? match[1] : token.slice(-32);
};

export const pushTokenService = {
  /**
   * Register this device's Expo push token in Supabase.
   * Called when an admin logs in. Safe to call multiple times — upserts on device_id.
   */
  async register(): Promise<void> {
    try {
      // Physical device required — simulators can't receive push notifications
      if (!Device.isDevice) {
        console.log('[pushToken] Skipping registration on simulator');
        return;
      }

      // Set up Android notification channel before requesting permissions
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Notifications',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#3498db',
          sound: 'default',
        });
        // Keep the existing house-tasks channel for any legacy local notifications
        await Notifications.setNotificationChannelAsync('house-tasks', {
          name: 'Tâches maisons',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#3498db',
        });
      }

      // Request permission
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.warn('[pushToken] Permission not granted — skipping registration');
        return;
      }

      // Get the Expo push token
      const { data: tokenData } = await Notifications.getExpoPushTokenAsync({
        projectId: 'cf1a7873-de68-4b76-9602-7958bb489c6d', // from app.json extra.eas.projectId
      });

      const token = tokenData;
      const deviceId = deriveDeviceId(token);

      // Upsert into Supabase — if this device already has a token, update it
      const { error } = await getAdminClient()
        .from('push_tokens')
        .upsert({ token, device_id: deviceId }, { onConflict: 'device_id' });

      if (error) {
        console.error('[pushToken] Failed to register token:', error);
      } else {
        console.log('[pushToken] Registered successfully');
      }
    } catch (error) {
      // Never crash the app over a failed token registration
      console.error('[pushToken] Registration error:', error);
    }
  },

  /**
   * Remove this device's push token from Supabase.
   * Called when an admin logs out so they stop receiving notifications.
   */
  async unregister(): Promise<void> {
    try {
      if (!Device.isDevice) return;

      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return;

      const { data: tokenData } = await Notifications.getExpoPushTokenAsync({
        projectId: 'cf1a7873-de68-4b76-9602-7958bb489c6d',
      });

      const deviceId = deriveDeviceId(tokenData);

      const { error } = await getAdminClient()
        .from('push_tokens')
        .delete()
        .eq('device_id', deviceId);

      if (error) {
        console.error('[pushToken] Failed to unregister token:', error);
      } else {
        console.log('[pushToken] Unregistered successfully');
      }
    } catch (error) {
      console.error('[pushToken] Unregistration error:', error);
    }
  },
};

export default pushTokenService;
