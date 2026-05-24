import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import 'react-native-url-polyfill/auto';
import { restoreAdminSession } from '../lib/supabase';
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
 * Also re-registers the push token once the admin session is confirmed active.
 */
function PushTokenRehydrator() {
  const { isAdmin, setIsAdmin } = useRental();

  // Restore admin JWT from AsyncStorage on first mount
  useEffect(() => {
    restoreAdminSession().then((restored) => {
      if (restored && !isAdmin) {
        setIsAdmin(true);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
