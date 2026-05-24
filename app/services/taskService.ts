import { getAdminClient, supabase } from '../../lib/supabase';

export type TaskCategory = 'cleaning' | 'purchase' | 'repair' | 'replacement';

export interface HouseTask {
  id?: string;
  tempId?: string;
  houseId: number;
  category: TaskCategory;
  description: string;
  isUrgent: boolean;
  isDone: boolean;
  rentalPeriodId?: string | null; // optional link to the rental that triggered this task
  createdAt?: string;
  updatedAt?: string;
}

// DB row → app model
const fromDb = (row: any): HouseTask => ({
  id: row.id,
  houseId: row.house_id,
  category: row.category as TaskCategory,
  description: row.description,
  isUrgent: row.is_urgent,
  isDone: row.is_done,
  rentalPeriodId: row.rental_period_id ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// App model → DB row (for insert/update)
const toDb = (task: HouseTask) => ({
  house_id: task.houseId,
  category: task.category,
  description: task.description,
  is_urgent: task.isUrgent,
  is_done: task.isDone,
  rental_period_id: task.rentalPeriodId ?? null,
});

export const taskService = {
  async fetchTasksForHouse(houseId: number): Promise<HouseTask[]> {
    const { data, error } = await supabase
      .from('house_tasks')
      .select('*')
      .eq('house_id', houseId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tasks:', error);
      return [];
    }
    return (data || []).map(fromDb);
  },

  async fetchAllTasks(): Promise<HouseTask[]> {
    const { data, error } = await supabase
      .from('house_tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all tasks:', error);
      return [];
    }
    return (data || []).map(fromDb);
  },

  async addTask(task: HouseTask): Promise<string | null> {
    const { data, error } = await getAdminClient()
      .from('house_tasks')
      .insert(toDb(task))
      .select('id')
      .single();

    if (error) {
      console.error('Error adding task:', error);
      return null;
    }
    return data?.id ?? null;
  },

  async updateTask(id: string, task: Partial<HouseTask>): Promise<boolean> {
    const updatePayload: any = {};
    if (task.category !== undefined) updatePayload.category = task.category;
    if (task.description !== undefined) updatePayload.description = task.description;
    if (task.isUrgent !== undefined) updatePayload.is_urgent = task.isUrgent;
    if (task.isDone !== undefined) updatePayload.is_done = task.isDone;
    if (task.rentalPeriodId !== undefined) updatePayload.rental_period_id = task.rentalPeriodId;

    const { error } = await getAdminClient()
      .from('house_tasks')
      .update(updatePayload)
      .eq('id', id);

    if (error) {
      console.error('Error updating task:', error);
      return false;
    }
    return true;
  },

  async deleteTask(id: string): Promise<boolean> {
    const { error } = await getAdminClient()
      .from('house_tasks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting task:', error);
      return false;
    }
    return true;
  },

  /**
   * Check if a cleaning task already exists for a given rental period.
   * Used to avoid creating duplicate auto-tasks.
   */
  async cleaningTaskExistsForRental(rentalPeriodId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('house_tasks')
      .select('id')
      .eq('rental_period_id', rentalPeriodId)
      .eq('category', 'cleaning')
      .limit(1);

    if (error) return false;
    return (data?.length ?? 0) > 0;
  },
};

export default taskService;
