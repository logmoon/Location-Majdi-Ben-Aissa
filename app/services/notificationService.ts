import * as Notifications from 'expo-notifications';

/**
 * notificationService
 *
 * Handles how incoming push notifications are displayed when the app is
 * in the foreground. All notification *sending* is now done server-side
 * via Supabase Edge Functions — this file is purely the client-side
 * presentation layer.
 *
 * Push token registration/unregistration lives in pushTokenService.ts.
 */

// Show alerts, play sound, and set badge even when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const notificationService = {
  /**
   * Cancel a previously scheduled local notification by ID.
   * Kept for any legacy scheduled notifications that may still be
   * sitting in the OS queue from before the push migration.
   * Safe to call with null — does nothing.
   */
  async cancelNotification(notificationId: string | null): Promise<void> {
    if (!notificationId) return;
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.error('[notification] Error cancelling notification:', error);
    }
  },

  /**
   * Cancel all locally scheduled notifications.
   * Useful as a one-time cleanup after migrating to push notifications.
   */
  async cancelAllLocalNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('[notification] Error cancelling all notifications:', error);
    }
  },
};

export default notificationService;
