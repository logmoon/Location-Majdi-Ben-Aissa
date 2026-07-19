import NetInfo from '@react-native-community/netinfo';
import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { deriveConnected, withTimeout } from '../../lib/networkLogic';

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

// NetInfo.fetch()'s reachability probe is itself a network operation, and on
// some devices (older Android builds / OEM network stacks in particular) it
// can hang indefinitely instead of resolving or rejecting when the network
// is in a bad state — the exact situation this probe exists to detect.
// Every other network call in this app (Supabase fetches, sync operations)
// is wrapped in a timeout for this reason; this one previously wasn't. If it
// hangs, checkInFlightRef below never clears, which silently disables every
// future poll tick, every foreground re-check, AND the manual retry button —
// freezing isConnected forever and starving auto-sync/manual sync of any way
// to ever re-fire. This timeout guarantees checkConnection always completes.
const CHECK_TIMEOUT_MS = 10000;

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
      const state = await withTimeout(NetInfo.fetch(), CHECK_TIMEOUT_MS, 'NetInfo.fetch()');
      const connected = deriveConnected(state);

      setIsConnected(connected);

      if (connected) {
        setLastConnectedAt(new Date());
      }

      return connected;
    } catch (error) {
      // Either a real NetInfo error, or our timeout fired because the
      // underlying probe hung — either way we can't confirm connectivity,
      // so fail closed to offline. Falling through to `finally` (rather
      // than getting stuck) is the whole point: it guarantees
      // checkInFlightRef/isCheckingConnection always get released so the
      // next poll tick, foreground resume, or manual retry tap can try again.
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
