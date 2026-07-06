import React, { ReactNode, createContext, useContext, useState } from 'react';
import { useRental } from './RentalContext';
import { useTask } from './TaskContext';

interface RefreshContextType {
  refreshAll: () => Promise<void>;
  isRefreshing: boolean;
}

const RefreshContext = createContext<RefreshContextType>({
  refreshAll: async () => {},
  isRefreshing: false,
});

export const RefreshProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { refreshHouses, syncRentalPeriods } = useRental();
  const { refreshTasks } = useTask();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshAll = async () => {
    setIsRefreshing(true);
    try {
      await syncRentalPeriods();
      await refreshHouses();
      await refreshTasks();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <RefreshContext.Provider value={{ refreshAll, isRefreshing }}>
      {children}
    </RefreshContext.Provider>
  );
};

export const useRefresh = () => useContext(RefreshContext);
