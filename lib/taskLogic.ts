/**
 * taskLogic.ts
 *
 * Pure functions extracted from TaskContext and HouseTasks for testability.
 */

import { HouseTask } from '../app/services/taskService';
import { RentalPeriod } from './rentalLogic';

/**
 * Sorts pending (not-done) tasks: urgent tasks first, then newest first.
 * Does not mutate the input array.
 */
export function sortPendingTasks(tasks: HouseTask[]): HouseTask[] {
  return [...tasks].sort((a, b) => {
    if (a.isUrgent && !b.isUrgent) return -1;
    if (!a.isUrgent && b.isUrgent) return 1;
    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
  });
}

/**
 * Builds the auto-generated cleaning task description for a completed rental.
 * Mirrors the logic in TaskContext.checkAndCreateAutoTasks.
 */
export function buildCleaningTaskDescription(rental: RentalPeriod): string {
  const endDateStr = new Date(rental.endDate).toLocaleDateString('fr-FR');
  const checkoutTime = rental.endHalfDay ? 'midi' : 'soir';
  return `Nettoyage après location de ${rental.renterName || 'locataire'} — fin le ${endDateStr} (${checkoutTime})`;
}

/**
 * Determines whether an auto-cleaning task should be created for a rental.
 * Returns true when:
 *   - The rental has a real Supabase id (not a local-only temp rental)
 *   - The rental's end date is today or in the past (at day level)
 *
 * @param rental   The rental period to check
 * @param today    A Date representing "today" at midnight (injected for testability)
 */
export function shouldCreateCleaningTask(rental: RentalPeriod, today: Date): boolean {
  if (!rental.id) return false;

  const endDate = new Date(rental.endDate);
  endDate.setHours(0, 0, 0, 0);

  const todayMidnight = new Date(today);
  todayMidnight.setHours(0, 0, 0, 0);

  return endDate <= todayMidnight;
}
