import NetInfo from '@react-native-community/netinfo';
import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

interface NetworkContextType {
  isConnected: boolean | null;
  lastConnectedAt: Date | null;
  checkConnection: () => Promise<boolean>;
  isCheckingConnection: boolean;
}

const NetworkContext = createContext<NetworkContextType>({
  isConnected: null,
  lastConnectedAt: null,
  checkConnection: async () => false,
  isCheckingConnection: false,
});

// How often to re-probe connectivity in the background. NetInfo's event
// listener only fires when the radio-level connection changes (e.g. WiFi
// on/off). It does NOT fire when the phone stays associated to a WiFi/
// cellular network that has silently lost its route to the internet — a
// very common situation on older phones/routers. Without this poll, a
// device stuck in that state would never re-evaluate connectivity and
// would never retry a pending sync.
const POLL_INTERVAL_MS = 15000;

// Derives an effective "are we actually online" boolean from a NetInfo
// state snapshot. `isConnected` only reflects radio-level association
// (has a WiFi/cellular link); `isInternetReachable` reflects whether that
// link actually reaches the internet (NetInfo performs a reachability
// probe for this). We require both, and only treat `isInternetReachable
// === false` as a hard "no" — while it's `null` (still being determined)
// we fall back to `isConnected` so we don't flicker offline on every check.
function deriveConnected(state: { isConnected: boolean | null; isInternetReachable: boolean | null }): boolean {
  if (state.isConnected !== true) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

export const NetworkProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Start as null (unknown) — we don't know connectivity until NetInfo responds.
  // RentalContext guards on isConnected, so starting true would fire fetches
  // immediately even when offline and corrupt the cache with empty responses.
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [lastConnectedAt, setLastConnectedAt] = useState<Date | null>(new Date());
  const [isCheckingConnection, setIsCheckingConnection] = useState<boolean>(false);
  // Guards against overlapping polls (e.g. a slow probe still in flight
  // when the next interval tick or an AppState resume fires).
  const checkInFlightRef = useRef(false);

  // Function to manually check connection status
  const checkConnection = async (): Promise<boolean> => {
    if (checkInFlightRef.current) return isConnected === true;
    checkInFlightRef.current = true;
    setIsCheckingConnection(true);
    try {
      const state = await NetInfo.fetch();
      const connected = deriveConnected(state);

      setIsConnected(connected);

      if (connected) {
        setLastConnectedAt(new Date());
      }

      return connected;
    } catch (error) {
      console.error('Error checking connection:', error);
      setIsConnected(false);
      return false;
    } finally {
      setIsCheckingConnection(false);
      checkInFlightRef.current = false;
    }
  };

  useEffect(() => {
    // Subscribe to radio-level network state updates
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = deriveConnected(state);
      setIsConnected(connected);

      if (connected) {
        setLastConnectedAt(new Date());
      }
    });

    // Initial check
    checkConnection();

    // Periodic re-probe — this is what lets the app notice (and recover
    // from) a "connected to WiFi/cellular but no real internet" state
    // that never produces a NetInfo event, and what re-triggers the
    // auto-sync effects that key off isConnected changing value.
    const intervalId = setInterval(() => {
      checkConnection();
    }, POLL_INTERVAL_MS);

    // Also re-probe immediately whenever the app comes back to the
    // foreground — important on older devices where background timers
    // get throttled/frozen while the app is backgrounded, so the periodic
    // poll may not have run recently by the time the user reopens the app.
    const appStateSub = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        checkConnection();
      }
    });

    return () => {
      unsubscribe();
      clearInterval(intervalId);
      appStateSub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <NetworkContext.Provider value={{ isConnected, lastConnectedAt, checkConnection, isCheckingConnection }}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => useContext(NetworkContext);

// Add default export to fix warning
const NetworkContextExport = { NetworkProvider, useNetwork };
export default NetworkContextExport;
