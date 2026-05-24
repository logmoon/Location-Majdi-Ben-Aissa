import NetInfo from '@react-native-community/netinfo';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

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

export const NetworkProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Start as null (unknown) — we don't know connectivity until NetInfo responds.
  // RentalContext guards on isConnected, so starting true would fire fetches
  // immediately even when offline and corrupt the cache with empty responses.
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [lastConnectedAt, setLastConnectedAt] = useState<Date | null>(new Date());
  const [isCheckingConnection, setIsCheckingConnection] = useState<boolean>(false);

  useEffect(() => {
    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected !== null ? state.isConnected : false;
      setIsConnected(connected);
      
      if (connected) {
        setLastConnectedAt(new Date());
      }
    });

    // Initial check
    checkConnection();

    return () => {
      unsubscribe();
    };
  }, []);

  // Function to manually check connection status
  const checkConnection = async (): Promise<boolean> => {
    setIsCheckingConnection(true);
    try {
      const state = await NetInfo.fetch();
      const connected = state.isConnected !== null ? state.isConnected : false;
      
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
    }
  };

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