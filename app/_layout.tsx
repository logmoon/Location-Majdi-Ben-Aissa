import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { AppState, View } from 'react-native';
import 'react-native-url-polyfill/auto';
import { restoreAdminSession, validateAdminSession } from '../lib/supabase';
import ForceUpdateGate from './components/ForceUpdateGate';
import OfflineIndicator from './components/OfflineIndicator';
import SettingsButton from './components/SettingsButton';
import { Translations } from './constants/Translations';
import { NetworkProvider } from './context/NetworkContext';
import { RentalProvider, useRental } from './context/RentalContext';
import { TaskProvider } from './context/TaskContext';
import { pushTokenService } from './services/pushTokenService';

/**
 * On app launch, restores the admin JWT from AsyncStorage so the admin
 * doesn't have to log in again after a restart.
 * Also validates the session against the remote password_version — if the
 * password was changed, the session is cleared and the admin is logged out.
 * Re-validates every time the app comes back to the foreground.
 */
function PushTokenRehydrator() {
  const { isAdmin, setIsAdmin } = useRental();

  // Restore admin JWT on first mount, validate password version
  useEffect(() => {
    restoreAdminSession().then((restored) => {
      if (restored && !isAdmin) {
        setIsAdmin(true);
      } else if (!restored && isAdmin) {
        // Session was invalidated (password changed)
        setIsAdmin(false);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-validate when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isAdmin) {
        validateAdminSession().then((valid) => {
          if (!valid) setIsAdmin(false);
        });
      }
    });
    return () => sub.remove();
  }, [isAdmin, setIsAdmin]);

  // Re-register push token whenever admin status becomes true
  useEffect(() => {
    if (isAdmin) {
      pushTokenService.register();
    }
  }, [isAdmin]);

  return null;
}

export default function Layout() {
  return (
    <NetworkProvider>
      <ForceUpdateGate>
      <RentalProvider>
        <TaskProvider>
        <View style={{ flex: 1 }}>
          <PushTokenRehydrator />
          <OfflineIndicator />
          <Stack
            screenOptions={{
              headerStyle: {
                backgroundColor: '#3498db'
              },
              headerTintColor: 'white',
              headerTitleStyle: {
                fontSize: 24,
                fontWeight: 'bold',
              },
            }}
          >
            <Stack.Screen 
              name="index" 
              options={{
                title: Translations.appName,
                headerLeft: () => <SettingsButton />
              }}
            />
            <Stack.Screen 
              name="calendar" 
              options={{
                title: Translations.calendar
              }}
            />
            <Stack.Screen
              name="house"
              options={{
                title: Translations.houseDetails,
              }}
            />
            <Stack.Screen 
              name="settings" 
              options={{
                title: Translations.settings,
              }}
            />
          </Stack>
        </View>
        </TaskProvider>
      </RentalProvider>
      </ForceUpdateGate>
    </NetworkProvider>
  );
}
