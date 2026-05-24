import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { buildCleaningTaskDescription, shouldCreateCleaningTask } from '../../lib/taskLogic';
import { HouseTask, TaskCategory, taskService } from '../services/taskService';
import { useNetwork } from './NetworkContext';
import { useRental } from './RentalContext';

const TASKS_CACHE_KEY = '@rental_app:house_tasks';
const TASKS_PENDING_OPS_KEY = '@rental_app:task_pending_ops';

// ─── Pending operation types ─────────────────────────────────────────────────

type TaskOpType = 'add' | 'update' | 'delete';

interface PendingTaskOp {
  type: TaskOpType;
  // For add: full task with tempId. For update/delete: id + partial updates.
  taskId?: string;       // real Supabase id (update/delete)
  tempId?: string;       // local id (add)
  payload?: Partial<HouseTask>; // full task for add, partial for update
  timestamp: number;
}

// ─── Context interface ────────────────────────────────────────────────────────

interface TaskContextType {
  tasks: HouseTask[];
  isTasksLoading: boolean;
  addTask: (task: Omit<HouseTask, 'id' | 'tempId'>) => Promise<boolean>;
  updateTask: (id: string, updates: Partial<HouseTask>) => Promise<boolean>;
  deleteTask: (id: string) => Promise<boolean>;
  toggleTaskDone: (task: HouseTask) => Promise<boolean>;
  getTasksForHouse: (houseId: number) => HouseTask[];
  getPendingTasksForHouse: (houseId: number) => HouseTask[];
  refreshTasks: () => Promise<void>;
}

const TaskContext = createContext<TaskContextType>({
  tasks: [],
  isTasksLoading: false,
  addTask: async () => false,
  updateTask: async () => false,
  deleteTask: async () => false,
  toggleTaskDone: async () => false,
  getTasksForHouse: () => [],
  getPendingTasksForHouse: () => [],
  refreshTasks: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export const TaskProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isConnected } = useNetwork();
  const { rentalPeriods, houses, isAdmin } = useRental();
  const [tasks, setTasks] = useState<HouseTask[]>([]);
  const [isTasksLoading, setIsTasksLoading] = useState(false);
  const [pendingOps, setPendingOps] = useState<PendingTaskOp[]>([]);
  const autoTaskCheckDoneRef = useRef(false);
  const tasksRef = useRef(tasks);
  // Keep a ref to pendingOps so flushPendingOps always reads the latest value
  // even when called from a useEffect that captured an earlier closure
  const pendingOpsRef = useRef(pendingOps);

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { pendingOpsRef.current = pendingOps; }, [pendingOps]);

  // Load from cache on mount
  useEffect(() => {
    loadFromCache();
  }, []);

  // When we come online: flush pending ops then sync remote
  useEffect(() => {
    if (isConnected === null) return; // still waiting for NetInfo
    if (isConnected) {
      flushPendingOps().then(() => loadTasksFromRemote());
    }
  }, [isConnected]);

  // Auto-create cleaning tasks once per session when online + admin + data ready.
  // Guard: only set autoTaskCheckDoneRef AFTER the check actually runs, not before —
  // otherwise a race where rentalPeriods is empty on first fire permanently skips the check.
  useEffect(() => {
    if (!isConnected || !isAdmin || autoTaskCheckDoneRef.current) return;
    if (rentalPeriods.length === 0 || houses.length === 0) return;
    // Mark done before the async call to prevent concurrent runs, not to skip future ones
    autoTaskCheckDoneRef.current = true;
    checkAndCreateAutoTasks();
  }, [isConnected, isAdmin, rentalPeriods, houses]);

  // ─── Cache helpers ──────────────────────────────────────────────────────────

  const loadFromCache = async () => {
    try {
      const [cachedTasks, cachedOps] = await Promise.all([
        AsyncStorage.getItem(TASKS_CACHE_KEY),
        AsyncStorage.getItem(TASKS_PENDING_OPS_KEY),
      ]);
      if (cachedTasks) setTasks(JSON.parse(cachedTasks));
      if (cachedOps) setPendingOps(JSON.parse(cachedOps));
    } catch (error) {
      console.error('Error loading tasks from cache:', error);
    }
  };

  const saveCachedTasks = async (updated: HouseTask[]) => {
    try {
      await AsyncStorage.setItem(TASKS_CACHE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving tasks cache:', error);
    }
  };

  const savePendingOps = async (ops: PendingTaskOp[]) => {
    try {
      await AsyncStorage.setItem(TASKS_PENDING_OPS_KEY, JSON.stringify(ops));
    } catch (error) {
      console.error('Error saving task pending ops:', error);
    }
  };

  const addPendingOp = async (op: PendingTaskOp) => {
    setPendingOps(prev => {
      const updated = [...prev, op];
      savePendingOps(updated);
      return updated;
    });
  };

  // ─── Remote sync ────────────────────────────────────────────────────────────

  const loadTasksFromRemote = async () => {
    setIsTasksLoading(true);
    try {
      const remoteTasks = await taskService.fetchAllTasks();
      setTasks(prev => {
        // If remote returned empty but we have local data, likely a silent failure
        // — don't wipe the cache.
        if (remoteTasks.length === 0 && prev.length > 0) return prev;

        // Keep local-only tasks that haven't been synced yet
        const localOnly = prev.filter(t => !t.id && t.tempId);
        const trulyLocal = localOnly.filter(local =>
          !remoteTasks.some(r =>
            r.houseId === local.houseId &&
            r.category === local.category &&
            r.description === local.description
          )
        );
        const merged = [...remoteTasks, ...trulyLocal];
        saveCachedTasks(merged);
        return merged;
      });
    } catch (error) {
      console.error('Error loading tasks from remote:', error);
      // On error, leave existing tasks in place — don't wipe
    } finally {
      setIsTasksLoading(false);
    }
  };

  /**
   * Flush all pending offline operations to Supabase in order.
   * Removes successful ops from the queue.
   * Reads from pendingOpsRef to avoid stale closure issues when called from useEffect.
   */
  const flushPendingOps = async () => {
    const currentOps = pendingOpsRef.current;
    if (currentOps.length === 0) return;

    const remaining: PendingTaskOp[] = [];

    for (const op of currentOps) {
      try {
        let success = false;

        if (op.type === 'add' && op.payload) {
          const id = await taskService.addTask(op.payload as HouseTask);
          if (id) {
            // Replace the tempId task in state with the real id
            setTasks(prev => {
              const updated = prev.map(t =>
                t.tempId === op.tempId ? { ...t, id, tempId: undefined } : t
              );
              saveCachedTasks(updated);
              return updated;
            });
            success = true;
          }
        } else if (op.type === 'update' && op.taskId && op.payload) {
          success = await taskService.updateTask(op.taskId, op.payload);
        } else if (op.type === 'delete' && op.taskId) {
          success = await taskService.deleteTask(op.taskId);
        }

        if (!success) remaining.push(op);
      } catch {
        remaining.push(op);
      }
    }

    setPendingOps(remaining);
    await savePendingOps(remaining);
  };

  // ─── Auto-task creation ─────────────────────────────────────────────────────

  const checkAndCreateAutoTasks = async () => {
    try {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      for (const rental of rentalPeriods) {
        if (!shouldCreateCleaningTask(rental, now)) continue;

        const exists = await taskService.cleaningTaskExistsForRental(rental.id!);
        if (exists) continue;

        const house = houses.find(h => h.id === rental.houseId);
        if (!house) continue;

        const newTask: HouseTask = {
          houseId: rental.houseId,
          category: 'cleaning' as TaskCategory,
          description: buildCleaningTaskDescription(rental),
          isUrgent: false,
          isDone: false,
          rentalPeriodId: rental.id,
        };

        const taskId = await taskService.addTask(newTask);
        if (taskId) {
          const taskWithId = { ...newTask, id: taskId };
          setTasks(prev => {
            const updated = [taskWithId, ...prev];
            saveCachedTasks(updated);
            return updated;
          });
          // Push notification is sent server-side via the house_tasks DB webhook
        }
      }
    } catch (error) {
      console.error('Error in checkAndCreateAutoTasks:', error);
    }
  };

  // ─── CRUD operations ────────────────────────────────────────────────────────

  const addTask = async (task: Omit<HouseTask, 'id' | 'tempId'>): Promise<boolean> => {
    const tempId = `local_task_${Date.now()}`;
    const optimisticTask: HouseTask = { ...task, tempId };

    // Optimistic local update
    setTasks(prev => {
      const updated = [optimisticTask, ...prev];
      saveCachedTasks(updated);
      return updated;
    });

    if (isConnected) {
      try {
        const id = await taskService.addTask(task as HouseTask);
        if (id) {
          setTasks(prev => {
            const updated = prev.map(t => t.tempId === tempId ? { ...t, id, tempId: undefined } : t);
            saveCachedTasks(updated);
            return updated;
          });
          return true;
        }
      } catch (error) {
        console.error('Error adding task to remote:', error);
      }
    }

    // Offline or remote failed — queue for later
    await addPendingOp({
      type: 'add',
      tempId,
      payload: optimisticTask,
      timestamp: Date.now(),
    });
    return true;
  };

  const updateTask = async (id: string, updates: Partial<HouseTask>): Promise<boolean> => {
    // Optimistic local update
    setTasks(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, ...updates } : t);
      saveCachedTasks(updated);
      return updated;
    });

    if (isConnected) {
      try {
        const success = await taskService.updateTask(id, updates);
        if (success) return true;
      } catch (error) {
        console.error('Error updating task on remote:', error);
      }
    }

    // Offline or remote failed — queue for later
    await addPendingOp({
      type: 'update',
      taskId: id,
      payload: updates,
      timestamp: Date.now(),
    });
    return true;
  };

  const deleteTask = async (id: string): Promise<boolean> => {
    // Optimistic local removal
    setTasks(prev => {
      const updated = prev.filter(t => t.id !== id);
      saveCachedTasks(updated);
      return updated;
    });

    if (isConnected) {
      try {
        const success = await taskService.deleteTask(id);
        if (success) return true;
      } catch (error) {
        console.error('Error deleting task on remote:', error);
      }
    }

    // Offline or remote failed — queue for later
    await addPendingOp({
      type: 'delete',
      taskId: id,
      timestamp: Date.now(),
    });
    return true;
  };

  const toggleTaskDone = async (task: HouseTask): Promise<boolean> => {
    // Works for both synced tasks (id) and offline tasks (tempId via updateTask local path)
    if (task.id) {
      return updateTask(task.id, { isDone: !task.isDone });
    }
    // Task only has tempId — update locally, pending op will carry the full update when synced
    if (task.tempId) {
      setTasks(prev => {
        const updated = prev.map(t =>
          t.tempId === task.tempId ? { ...t, isDone: !task.isDone } : t
        );
        saveCachedTasks(updated);
        return updated;
      });
      // Update the pending add op payload so when it syncs it carries the correct isDone value
      setPendingOps(prev => {
        const updated = prev.map(op =>
          op.type === 'add' && op.tempId === task.tempId && op.payload
            ? { ...op, payload: { ...op.payload, isDone: !task.isDone } }
            : op
        );
        savePendingOps(updated);
        return updated;
      });
      return true;
    }
    return false;
  };

  // ─── Selectors ──────────────────────────────────────────────────────────────

  const getTasksForHouse = useCallback(
    (houseId: number) => tasks.filter(t => t.houseId === houseId),
    [tasks]
  );

  const getPendingTasksForHouse = useCallback(
    (houseId: number) => tasks.filter(t => t.houseId === houseId && !t.isDone),
    [tasks]
  );

  const refreshTasks = async () => {
    if (!isConnected) return; // offline — don't wipe cached tasks
    await flushPendingOps();
    await loadTasksFromRemote();
  };

  return (
    <TaskContext.Provider value={{
      tasks,
      isTasksLoading,
      addTask,
      updateTask,
      deleteTask,
      toggleTaskDone,
      getTasksForHouse,
      getPendingTasksForHouse,
      refreshTasks,
    }}>
      {children}
    </TaskContext.Provider>
  );
};

export const useTask = () => useContext(TaskContext);

export default TaskContext;
