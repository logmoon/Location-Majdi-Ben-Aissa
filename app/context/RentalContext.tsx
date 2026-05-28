import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { ReactNode, createContext, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import {
  RentalPeriod,
  checkForOverlap as _checkForOverlap,
  isHouseAvailable as _isHouseAvailable,
  toLocalMidnight,
} from '../../lib/rentalLogic';
import { clearAdminSession } from '../../lib/supabase';
import { House } from '../constants/Houses';
import { houseService } from '../services/houseService';
import { rentalService } from '../services/rentalService';
import { useNetwork } from './NetworkContext';

// Re-export so consumers that import RentalPeriod from this file keep working
export type { RentalPeriod };

// Define the context interface
interface RentalContextType {
  houses: House[];
  rentalPeriods: RentalPeriod[];
  isAdmin: boolean;
  setIsAdmin: (value: boolean) => void;
  addRentalPeriod: (rental: RentalPeriod) => Promise<boolean>;
  removeRentalPeriod: (houseId: number, startDate: string, idOrTempId?: string) => Promise<void>;
  updateRentalPeriod: (rental: RentalPeriod) => Promise<boolean>;
  isHouseAvailable: (houseId: number, date: string, timeOfDay?: 'AM' | 'PM') => boolean;
  getRentalPeriodsForHouse: (houseId: number) => RentalPeriod[];
  getRentalPeriodForDate: (houseId: number, date: string, timeOfDay?: 'AM' | 'PM') => RentalPeriod | null;
  syncRentalPeriods: () => Promise<boolean>;
  clearLocalData: () => Promise<boolean>;
  isSyncing: boolean;
  checkForOverlap: (houseId: number, startDate: string, endDate: string, startHalfDay: boolean, endHalfDay: boolean, currentRentalId?: string) => boolean;
  refreshHouses: () => Promise<void>;
  addHouse: (house: Omit<House, 'id'>) => Promise<number | null>;
  updateHouse: (house: House) => Promise<boolean>;
  deleteHouse: (id: number) => Promise<boolean>;
  addHouseImage: (houseId: number, uri: string) => Promise<string | null>;
  deleteHouseImage: (imageId: string) => Promise<boolean>;
  isHousesLoading: boolean;
}

// Create the context with default values
const RentalContext = createContext<RentalContextType>({
  houses: [],
  rentalPeriods: [],
  isAdmin: false,
  setIsAdmin: () => {},
  addRentalPeriod: async () => false,
  removeRentalPeriod: async () => {},
  updateRentalPeriod: async () => false,
  isHouseAvailable: () => true,
  getRentalPeriodsForHouse: () => [],
  getRentalPeriodForDate: () => null,
  syncRentalPeriods: async () => false,
  clearLocalData: async () => false,
  isSyncing: false,
  checkForOverlap: () => false,
  refreshHouses: async () => {},
  addHouse: async () => null,
  updateHouse: async () => false,
  deleteHouse: async () => false,
  addHouseImage: async () => null,
  deleteHouseImage: async () => false,
  isHousesLoading: false,
});

// Storage keys
const RENTAL_PERIODS_KEY = '@rental_app:rental_periods';
const PENDING_OPERATIONS_KEY = '@rental_app:pending_operations';
const HOUSES_CACHE_KEY = '@rental_app:houses_cache';

// Pending operation types
type OperationType = 'add' | 'update' | 'remove';

interface PendingOperation {
  id: string;
  type: OperationType;
  data: RentalPeriod;
  timestamp: number;
}

// Create a provider component
export const RentalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isConnected } = useNetwork();
  const [houses, setHouses] = useState<House[]>([]);
  const [isHousesLoading, setIsHousesLoading] = useState(false);
  const [rentalPeriods, setRentalPeriods] = useState<RentalPeriod[]>([]);
  const [isAdmin, setIsAdminState] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingOperations, setPendingOperations] = useState<PendingOperation[]>([]);
  const rentalPeriodsRef = useRef(rentalPeriods);
  // Ref so processPendingOperations always reads the latest queue even from a stale closure
  const pendingOperationsRef = useRef(pendingOperations);

  // Sync ref with state so subscription callback always reads latest
  useEffect(() => {
    rentalPeriodsRef.current = rentalPeriods;
  }, [rentalPeriods]);

  useEffect(() => {
    pendingOperationsRef.current = pendingOperations;
  }, [pendingOperations]);

  // Load saved data on initial render
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        // Load rental periods from local storage first
        const savedRentalPeriods = await AsyncStorage.getItem(RENTAL_PERIODS_KEY);
        if (savedRentalPeriods !== null) {
          setRentalPeriods(JSON.parse(savedRentalPeriods));
        }
        
        // Load pending operations
        const savedPendingOperations = await AsyncStorage.getItem(PENDING_OPERATIONS_KEY);
        if (savedPendingOperations !== null) {
          setPendingOperations(JSON.parse(savedPendingOperations));
        }
        
        setIsInitialized(true);
      } catch (error) {
        console.error('Error loading saved data:', error);
        setIsInitialized(true);
      }
    };

    loadSavedData();
  }, []);

  // Load houses from Supabase (with cache fallback)
  const loadHouses = async () => {
    setIsHousesLoading(true);
    try {
      const remoteHouses = await houseService.fetchHouses();
      // Only trust the remote result if it's non-empty OR we have no cache.
      // An empty array from a silent network failure would wipe the cache.
      if (remoteHouses.length > 0) {
        setHouses(remoteHouses);
        await AsyncStorage.setItem(HOUSES_CACHE_KEY, JSON.stringify(remoteHouses));
      } else {
        // Remote returned empty — fall back to cache to avoid wiping the UI
        const cached = await AsyncStorage.getItem(HOUSES_CACHE_KEY);
        if (cached) {
          const cachedHouses = JSON.parse(cached);
          if (cachedHouses.length > 0) {
            setHouses(cachedHouses);
          } else {
            // Cache is also empty — remote is genuinely empty
            setHouses([]);
          }
        } else {
          setHouses([]);
        }
      }
    } catch {
      // Network error — fall back to cache, never wipe
      const cached = await AsyncStorage.getItem(HOUSES_CACHE_KEY);
      if (cached) {
        setHouses(JSON.parse(cached));
      }
      // If no cache either, leave houses as-is (don't reset to [])
    } finally {
      setIsHousesLoading(false);
    }
  };

  // Load houses on init and when coming back online
  useEffect(() => {
    if (!isInitialized) return;
    if (isConnected === null) return; // still waiting for NetInfo — don't do anything yet
    if (isConnected) {
      loadHouses();
    } else if (houses.length === 0) {
      // Offline and no houses in state yet — try the cache
      AsyncStorage.getItem(HOUSES_CACHE_KEY).then(cached => {
        if (cached) setHouses(JSON.parse(cached));
      }).catch(() => {});
    }
  }, [isConnected, isInitialized]);

  // Sync with Supabase when online
  useEffect(() => {
    if (!isInitialized) return;
    if (isConnected === null) return; // still waiting for NetInfo
    if (isConnected) {
      // Process pending ops then sync — own isSyncing for the whole sequence
      const runSync = async () => {
        setIsSyncing(true);
        try {
          await processPendingOperations();
          await syncWithSupabase();
        } finally {
          setIsSyncing(false);
        }
      };
      runSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, isInitialized]);

  // Subscribe to Supabase changes
  useEffect(() => {
    if (!isInitialized || !isConnected) return;
    
    // Subscribe to changes in rental periods
    const unsubscribe = rentalService.subscribeToRentalPeriods(async (updatedPeriods) => {
      // Merge remote periods with local-only periods, dedup by compound key.
      // When a rental exists both in remote (real id) and local-only (tempId),
      // keep the remote version — it's the authoritative one.
      const currentPeriods = rentalPeriodsRef.current;
      const localOnlyPeriods = currentPeriods.filter(period => !period.id);
      const deduped = new Map<string, RentalPeriod>();
      for (const r of updatedPeriods) {
        deduped.set(`${r.houseId}-${r.startDate}-${r.endDate}`, r);
      }
      for (const r of localOnlyPeriods) {
        const key = `${r.houseId}-${r.startDate}-${r.endDate}`;
        if (!deduped.has(key)) {
          deduped.set(key, r);
        }
      }
      const mergedPeriods = Array.from(deduped.values());
      
      setRentalPeriods(mergedPeriods);
      await saveRentalPeriods(mergedPeriods);
    });

    return () => {
      unsubscribe();
    };
  }, [isInitialized, isConnected]); // Remove rentalPeriods dependency to avoid re-subscribing on every rental change

  // Set admin status and save to AsyncStorage
  const setIsAdmin = async (value: boolean) => {
    setIsAdminState(value);
    // Note: admin JWT persistence is handled by lib/supabase (setAdminSession /
    // clearAdminSession). We no longer store a separate admin_status flag here
    // to avoid conflicts with the JWT restore in _layout.tsx.
  };

  // Save rental periods to AsyncStorage
  const saveRentalPeriods = async (periods: RentalPeriod[]) => {
    try {
      await AsyncStorage.setItem(RENTAL_PERIODS_KEY, JSON.stringify(periods));
    } catch (error) {
      console.error('Error saving rental periods:', error);
    }
  };

  // Save pending operations to AsyncStorage
  const savePendingOperations = async (operations: PendingOperation[]) => {
    try {
      await AsyncStorage.setItem(PENDING_OPERATIONS_KEY, JSON.stringify(operations));
    } catch (error) {
      console.error('Error saving pending operations:', error);
    }
  };

  // Add a pending operation
  const addPendingOperation = async (type: OperationType, data: RentalPeriod) => {
    const newOperation: PendingOperation = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      type,
      data,
      timestamp: Date.now(),
    };
    // Use functional update to avoid reading stale pendingOperations from closure
    setPendingOperations(prev => {
      const updatedOperations = [...prev, newOperation];
      savePendingOperations(updatedOperations);
      return updatedOperations;
    });
  };

  // Process pending operations when online
  const processPendingOperations = async () => {
    const currentOps = pendingOperationsRef.current;
    if (!isConnected || currentOps.length === 0) return;
    
    try {
      const successfulOperations: PendingOperation[] = [];
      // Maps tempId → real Supabase id for adds that succeed in this flush pass.
      // Subsequent update/remove ops in the same queue can use this to resolve
      // the real id even before syncWithSupabase runs.
      const resolvedIds: Record<string, string> = {};
      
      for (const operation of currentOps) {
        try {
          let success = false;
          
          switch (operation.type) {
            case 'add':
              const id = await rentalService.addRentalPeriod(operation.data);
              success = !!id;
              if (id) {
                // Track the resolved id so later ops in this queue can use it
                if (operation.data.tempId) resolvedIds[operation.data.tempId] = id;
                // Update the local rental in state: replace the tempId-only entry
                // with one that has the real Supabase id. Without this, a delete
                // attempted right after coming online would find no id and fail.
                setRentalPeriods(prev => {
                  const updated = prev.map(r =>
                    r.tempId === operation.data.tempId ? { ...r, id } : r
                  );
                  saveRentalPeriods(updated);
                  return updated;
                });
              }
              break;
            case 'update': {
              // Resolve the real id: prefer operation.data.id, fall back to
              // resolvedIds in case this rental was added offline in the same queue
              const updateId = operation.data.id
                ?? (operation.data.tempId ? resolvedIds[operation.data.tempId] : undefined);
              if (updateId) {
                success = await rentalService.updateRentalPeriod(updateId, { ...operation.data, id: updateId });
              }
              break;
            }
            case 'remove': {
              // Same id resolution for removes
              const removeId = operation.data.id
                ?? (operation.data.tempId ? resolvedIds[operation.data.tempId] : undefined);
              if (removeId) {
                success = await rentalService.removeRentalPeriod(removeId);
              }
              break;
            }
          }
          
          if (success) {
            successfulOperations.push(operation);
          }
        } catch (operationError) {
          console.error('Error processing operation:', operationError);
        }
      }
      
      // Remove successful operations from the pending list using unique id
      const successfulIds = new Set(successfulOperations.map(op => op.id));
      const updatedOperations = currentOps.filter(op => !successfulIds.has(op.id));
      
      setPendingOperations(updatedOperations);
      await savePendingOperations(updatedOperations);
    } catch (error) {
      console.error('Error processing pending operations:', error);
    }
  };

  // Sync with Supabase — callers are responsible for managing isSyncing
  const syncWithSupabase = async () => {
    if (!isConnected) return false;
    
    try {
      const remotePeriods = await rentalService.fetchRentalPeriods();

      // Use ref to avoid stale closure — rentalPeriods state may be outdated here
      const currentPeriods = rentalPeriodsRef.current;
      const localOnlyPeriods = currentPeriods.filter(period => !period.id);

      // If remote returned empty but we have local data, it's likely a silent
      // network failure — don't wipe the cache.
      if (remotePeriods.length === 0 && currentPeriods.length > 0) {
        return false;
      }

      // Merge remote + local-only periods, dedup by compound key.
      // Prefer the remote version (has real id) when there's a collision
      // (e.g. if processPendingOps just flushed an add but the ref is stale).
      const deduped = new Map<string, RentalPeriod>();
      for (const r of remotePeriods) {
        deduped.set(`${r.houseId}-${r.startDate}-${r.endDate}`, r);
      }
      for (const r of localOnlyPeriods) {
        const key = `${r.houseId}-${r.startDate}-${r.endDate}`;
        if (!deduped.has(key)) {
          deduped.set(key, r);
        }
      }
      const mergedPeriods = Array.from(deduped.values());
      
      setRentalPeriods(mergedPeriods);
      await saveRentalPeriods(mergedPeriods);
      return true;
    } catch (error) {
      console.error('Error syncing with Supabase:', error);
      return false;
    }
  };

  // Add a new rental period
  const addRentalPeriod = async (rental: RentalPeriod) => {
    // Generate tempRental once — reused in both the happy path and catch block
    const tempRental = { ...rental, tempId: `local_${Date.now()}` };
    try {
      // Check for overlapping rentals (excluding the current one being edited)
      const hasOverlap = checkForOverlap(
        tempRental.houseId, 
        tempRental.startDate, 
        tempRental.endDate, 
        tempRental.startHalfDay || false,
        tempRental.endHalfDay || false,
        tempRental.id || tempRental.tempId
      );
      
      if (hasOverlap) {
        return false;
      }
      
      if (isConnected && isAdmin) {
        const id = await rentalService.addRentalPeriod(rental);
        
        if (id) {
          const rentalWithId = { ...rental, id };
          const updatedPeriods = [...rentalPeriods, rentalWithId];
          setRentalPeriods([...updatedPeriods]);
          saveRentalPeriods(updatedPeriods);
        } else {
          const updatedPeriods = [...rentalPeriods, tempRental];
          setRentalPeriods([...updatedPeriods]);
          saveRentalPeriods(updatedPeriods);
          await addPendingOperation('add', tempRental);
        }
      } else {
        const updatedPeriods = [...rentalPeriods, tempRental];
        setRentalPeriods([...updatedPeriods]);
        saveRentalPeriods(updatedPeriods);
        await addPendingOperation('add', tempRental);
      }
      return true;
    } catch (error) {
      console.error('Error adding rental period:', error);
      Alert.alert('Erreur', 'Impossible d\'ajouter la location. Les données ont été sauvegardées localement et seront synchronisées plus tard.');
      // Reuse the same tempRental — don't create a second one with a different tempId
      const updatedPeriods = [...rentalPeriods, tempRental];
      setRentalPeriods([...updatedPeriods]);
      saveRentalPeriods(updatedPeriods);
      await addPendingOperation('add', tempRental);
      return true;
    }
  };

  // Remove a rental period
  const removeRentalPeriod = async (houseId: number, startDate: string, idOrTempId?: string) => {
    try {
      // Find the rental to remove — prefer unique identifier over compound key
      const rentalToRemove = idOrTempId
        ? rentalPeriods.find(r => r.id === idOrTempId || r.tempId === idOrTempId)
        : rentalPeriods.find(r => r.houseId === houseId && r.startDate === startDate);

      if (!rentalToRemove) return;

      let removalSuccess = false;
      
      if (isConnected && isAdmin && rentalToRemove.id) {
        // If online and it has an ID, remove from Supabase
        removalSuccess = await rentalService.removeRentalPeriod(rentalToRemove.id);
        
        if (!removalSuccess) {
          // If Supabase removal fails, add to pending operations
          await addPendingOperation('remove', rentalToRemove);
        }
      } else if (isAdmin) {
        // Offline mode - add to pending operations
        await addPendingOperation('remove', rentalToRemove);
      }

      // Update local state — use id/tempId when available for precise match
      const updatedPeriods = idOrTempId
        ? rentalPeriods.filter(r => r.id !== idOrTempId && r.tempId !== idOrTempId)
        : rentalPeriods.filter(r => !(r.houseId === houseId && r.startDate === startDate));
      setRentalPeriods([...updatedPeriods]);
      saveRentalPeriods(updatedPeriods);
    } catch (error) {
      console.error('Error removing rental period:', error);
      Alert.alert('Erreur', 'Impossible de supprimer la location. La modification sera synchronisée plus tard.');
      // Fall back to local-only update
      const rentalToRemove = idOrTempId
        ? rentalPeriods.find(r => r.id === idOrTempId || r.tempId === idOrTempId)
        : rentalPeriods.find(r => r.houseId === houseId && r.startDate === startDate);
      
      if (rentalToRemove) {
        await addPendingOperation('remove', rentalToRemove);
      }
      
      const updatedPeriods = idOrTempId
        ? rentalPeriods.filter(r => r.id !== idOrTempId && r.tempId !== idOrTempId)
        : rentalPeriods.filter(r => !(r.houseId === houseId && r.startDate === startDate));
      setRentalPeriods([...updatedPeriods]);
      saveRentalPeriods(updatedPeriods);
    }
  };

  // Update an existing rental period
  const updateRentalPeriod = async (updatedRental: RentalPeriod) => {
    try {
      // Find the rental to update - use tempId or id if available, otherwise use houseId + startDate
      const existingRental = rentalPeriods.find(
        (rental) => {
          if (updatedRental.id && rental.id === updatedRental.id) return true;
          if (updatedRental.tempId && rental.tempId === updatedRental.tempId) return true;
          return rental.houseId === updatedRental.houseId && rental.startDate === updatedRental.startDate;
        }
      );

      if (!existingRental) {
        console.error('Could not find rental to update');
        return false;
      }

      // Build a clean copy — don't mutate the caller's object
      const rentalToSave = { ...updatedRental };
      if (existingRental?.id) {
        rentalToSave.id = existingRental.id;
      }
      if (existingRental?.tempId && !rentalToSave.tempId) {
        rentalToSave.tempId = existingRental.tempId;
      }

      // Check for overlapping rentals (excluding the current one being edited)
      const hasOverlap = checkForOverlap(
        rentalToSave.houseId, 
        rentalToSave.startDate, 
        rentalToSave.endDate, 
        rentalToSave.startHalfDay || false,
        rentalToSave.endHalfDay || false,
        rentalToSave.id || rentalToSave.tempId
      );
      
      if (hasOverlap) {
        // Return false to indicate failure due to overlap
        return false;
      }

      let updateSuccess = false;

      if (isConnected && isAdmin && rentalToSave.id) {
        // If online and it has an ID, update in Supabase
        updateSuccess = await rentalService.updateRentalPeriod(rentalToSave.id, rentalToSave);
        
        if (!updateSuccess) {
          await addPendingOperation('update', rentalToSave);
        }
      } else if (isAdmin) {
        await addPendingOperation('update', rentalToSave);
      }

      // Update local state - use id or tempId to identify the rental if available
      const updatedPeriods = rentalPeriods.map(rental => {
        if (rentalToSave.id && rental.id === rentalToSave.id) return rentalToSave;
        if (rentalToSave.tempId && rental.tempId === rentalToSave.tempId) return rentalToSave;
        if (rental.houseId === existingRental.houseId && rental.startDate === existingRental.startDate) return rentalToSave;
        return rental;
      });
      
      // Set the updated periods in state to trigger UI refresh
      setRentalPeriods([...updatedPeriods]);
      saveRentalPeriods(updatedPeriods);

      // If online and update was successful, fetch the latest data to ensure UI is in sync
      if (isConnected && updateSuccess) {
        setIsSyncing(true);
        try {
          await syncWithSupabase();
        } finally {
          setIsSyncing(false);
        }
      }
      
      return true; // Return true to indicate success
    } catch (error) {
      console.error('Error updating rental period:', error);
      Alert.alert('Erreur', 'Impossible de modifier la location. La modification sera synchronisée plus tard.');
      // Fall back to local-only update
      const rentalToSave = { ...updatedRental };
      // Copy existing id/tempId into the fallback copy too
      const existing = rentalPeriods.find(
        (r) => {
          if (updatedRental.id && r.id === updatedRental.id) return true;
          if (updatedRental.tempId && r.tempId === updatedRental.tempId) return true;
          return r.houseId === updatedRental.houseId && r.startDate === updatedRental.startDate;
        }
      );
      if (existing?.id) rentalToSave.id = existing.id;
      if (existing?.tempId && !rentalToSave.tempId) rentalToSave.tempId = existing.tempId;

      await addPendingOperation('update', rentalToSave);

      // Try to find the existing rental again
      const existingRental = rentalPeriods.find(
        (rental) => {
          if (rentalToSave.id && rental.id === rentalToSave.id) return true;
          if (rentalToSave.tempId && rental.tempId === rentalToSave.tempId) return true;
          return rental.houseId === rentalToSave.houseId && rental.startDate === rentalToSave.startDate;
        }
      );

      if (!existingRental) {
        console.error('Could not find rental to update in error handler');
        return false;
      }

      // Update local state - use id or tempId to identify the rental if available
      const updatedPeriods = rentalPeriods.map(rental => {
        if (rentalToSave.id && rental.id === rentalToSave.id) return rentalToSave;
        if (rentalToSave.tempId && rental.tempId === rentalToSave.tempId) return rentalToSave;
        if (rental.houseId === existingRental.houseId && rental.startDate === existingRental.startDate) return rentalToSave;
        return rental;
      });
      
      // Set the updated periods in state to trigger UI refresh
      setRentalPeriods([...updatedPeriods]);
      saveRentalPeriods(updatedPeriods);
      
      return true; // Return true to indicate success despite the error (local update succeeded)
    }
  };

  // Manual sync function that can be called from UI
  const syncRentalPeriods = async () => {
    if (!isConnected) return false;
    setIsSyncing(true);
    try {
      await processPendingOperations();
      return await syncWithSupabase();
    } finally {
      setIsSyncing(false);
    }
  };

  // House CRUD operations
  const refreshHouses = async () => {
    // Don't attempt a fetch when offline — it would return empty and corrupt the cache
    if (!isConnected) return;
    await loadHouses();
  };

  const addHouse = async (house: Omit<House, 'id'>): Promise<number | null> => {
    if (!isConnected) return null;
    const id = await houseService.addHouse(house);
    if (id) {
      const newHouse: House = { ...house, id };
      setHouses(prev => [...prev, newHouse]);
    }
    return id;
  };

  const updateHouse = async (house: House): Promise<boolean> => {
    if (!isConnected) return false;
    const success = await houseService.updateHouse(house);
    if (success) {
      setHouses(prev => prev.map(h => h.id === house.id ? house : h));
    }
    return success;
  };

  const deleteHouse = async (id: number): Promise<boolean> => {
    if (!isConnected) return false;
    const success = await houseService.deleteHouse(id);
    if (success) {
      setHouses(prev => prev.filter(h => h.id !== id));
    }
    return success;
  };

  const addHouseImage = async (houseId: number, uri: string): Promise<string | null> => {
    return houseService.uploadImage(houseId, uri);
  };

  const deleteHouseImage = async (imageId: string): Promise<boolean> => {
    return houseService.deleteImage(imageId);
  };

  // Pure logic lives in lib/rentalLogic.ts — these are thin context wrappers
  // that close over the current rentalPeriods state.

  const isHouseAvailable = (houseId: number, date: string, timeOfDay?: 'AM' | 'PM') =>
    _isHouseAvailable(rentalPeriods, houseId, date, timeOfDay);

  const checkForOverlap = (
    houseId: number,
    startDate: string,
    endDate: string,
    startHalfDay: boolean,
    endHalfDay: boolean,
    currentRentalId?: string
  ) => _checkForOverlap(rentalPeriods, houseId, startDate, endDate, startHalfDay, endHalfDay, currentRentalId);

  // Get all rental periods for a specific house
  const getRentalPeriodsForHouse = (houseId: number) => {
    return rentalPeriods.filter((rental) => rental.houseId === houseId);
  };

  // Get rental period for a specific date and house
  const getRentalPeriodForDate = (houseId: number, date: string, timeOfDay?: 'AM' | 'PM') => {
    const dateObj = toLocalMidnight(date);
    
    // If timeOfDay is specified, we need to handle half-day rentals
    if (timeOfDay) {
      // Find all rentals that include this date
      const rentalsOnDate = rentalPeriods.filter(
        (rental) =>
          rental.houseId === houseId &&
          dateObj >= toLocalMidnight(rental.startDate) &&
          dateObj <= toLocalMidnight(rental.endDate)
      );
      
      // For each rental, check if it covers the specified time of day
      for (const rental of rentalsOnDate) {
        const rentalStart = toLocalMidnight(rental.startDate);
        const rentalEnd = toLocalMidnight(rental.endDate);
        
        // If it's the start date of a rental
        if (dateObj.getTime() === rentalStart.getTime()) {
          // If rental starts in PM and we're checking AM, it doesn't cover this time
          if (rental.startHalfDay && timeOfDay === 'AM') continue;
          // Otherwise it covers this time
          return rental;
        }
        
        // If it's the end date of a rental
        if (dateObj.getTime() === rentalEnd.getTime()) {
          // If rental ends in AM and we're checking PM, it doesn't cover this time
          if (rental.endHalfDay && timeOfDay === 'PM') continue;
          // Otherwise it covers this time
          return rental;
        }
        
        // If it's a date in the middle of a rental, it covers this time
        return rental;
      }
      
      return null; // No rental covers this time of day
    }
    
    // If timeOfDay is not specified, return the first rental that includes this date (original behavior)
    const rental = rentalPeriods.find(
      (rental) =>
        rental.houseId === houseId &&
        dateObj >= toLocalMidnight(rental.startDate) &&
        dateObj <= toLocalMidnight(rental.endDate)
    );
    return rental || null;
  };


  // Clear all local data
  const clearLocalData = async () => {
    try {
      await AsyncStorage.removeItem(RENTAL_PERIODS_KEY);
      await AsyncStorage.removeItem(PENDING_OPERATIONS_KEY);
      await AsyncStorage.removeItem(HOUSES_CACHE_KEY);
      // Also clear the admin JWT so the session is fully reset
      await clearAdminSession();
      setIsAdminState(false);
      
      setRentalPeriods([]);
      setPendingOperations([]);
      
      return true;
    } catch (error) {
      console.error('Error clearing local data:', error);
      return false;
    }
  };

  return (
    <RentalContext.Provider
      value={{
        houses,
        rentalPeriods,
        isAdmin,
        setIsAdmin,
        addRentalPeriod,
        removeRentalPeriod,
        updateRentalPeriod,
        isHouseAvailable,
        getRentalPeriodsForHouse,
        getRentalPeriodForDate,
        syncRentalPeriods,
        clearLocalData,
        isSyncing,
        checkForOverlap,
        refreshHouses,
        addHouse,
        updateHouse,
        deleteHouse,
        addHouseImage,
        deleteHouseImage,
        isHousesLoading,
      }}
    >
      {children}
    </RentalContext.Provider>
  );
};

// Create a custom hook to use the rental context
export const useRental = () => useContext(RentalContext);

// Add default export to fix warning
const RentalContextExport = { RentalProvider, useRental };
export default RentalContextExport;