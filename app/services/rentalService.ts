import { getAdminClient, supabase } from '../../lib/supabase';
import { RentalPeriod } from '../context/RentalContext';

// Interface for the database rental period
interface SupabaseRentalPeriod {
  id: string;
  house_id: number;
  start_date: string;
  end_date: string;
  start_half_day: boolean;
  end_half_day: boolean;
  renter_name?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// Convert from app model to database model
const toSupabaseRental = (rental: RentalPeriod): Omit<SupabaseRentalPeriod, 'id' | 'created_at' | 'updated_at'> => ({
  house_id: rental.houseId,
  start_date: rental.startDate,
  end_date: rental.endDate,
  start_half_day: rental.startHalfDay || false,
  end_half_day: rental.endHalfDay || false,
  renter_name: rental.renterName,
  notes: rental.notes,
});

// Convert from database model to app model
const fromSupabaseRental = (rental: SupabaseRentalPeriod): RentalPeriod & { id: string } => ({
  id: rental.id,
  houseId: rental.house_id,
  startDate: rental.start_date,
  endDate: rental.end_date,
  startHalfDay: rental.start_half_day,
  endHalfDay: rental.end_half_day,
  renterName: rental.renter_name,
  notes: rental.notes,
});


export const rentalService = {
  // Fetch all rental periods with retry mechanism
  async fetchRentalPeriods(retryCount = 3): Promise<RentalPeriod[]> {
    try {
      const { data, error } = await supabase
        .from('rental_periods')
        .select('*');

      if (error) {
        console.error('Error fetching rental periods:', error);
        if (retryCount > 0) {
          console.log(`Retrying fetch... (${retryCount} attempts left)`);
          // Wait for a short time before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.fetchRentalPeriods(retryCount - 1);
        }
        return [];
      }

      return data.map(fromSupabaseRental);
    } catch (error) {
      console.error('Exception fetching rental periods:', error);
      if (retryCount > 0) {
        console.log(`Retrying fetch after exception... (${retryCount} attempts left)`);
        // Wait for a short time before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.fetchRentalPeriods(retryCount - 1);
      }
      return [];
    }
  },

  // Add a new rental period with retry mechanism
  async addRentalPeriod(rental: RentalPeriod, retryCount = 3): Promise<string | null> {
    try {
      const { data, error } = await getAdminClient()
        .from('rental_periods')
        .insert(toSupabaseRental(rental))
        .select('id')
        .single();

      if (error) {
        console.error('Error adding rental period:', error);
        if (retryCount > 0) {
          console.log(`Retrying add... (${retryCount} attempts left)`);
          // Wait for a short time before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.addRentalPeriod(rental, retryCount - 1);
        }
        return null;
      }

      return data?.id || null;
    } catch (error) {
      console.error('Exception adding rental period:', error);
      if (retryCount > 0) {
        console.log(`Retrying add after exception... (${retryCount} attempts left)`);
        // Wait for a short time before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.addRentalPeriod(rental, retryCount - 1);
      }
      return null;
    }
  },

  // Update an existing rental period
  // Update a rental period with retry mechanism
  async updateRentalPeriod(id: string, rental: RentalPeriod, retryCount = 3): Promise<boolean> {
    try {
      const { error } = await getAdminClient()
        .from('rental_periods')
        .update(toSupabaseRental(rental))
        .eq('id', id);

      if (error) {
        console.error('Error updating rental period:', error);
        if (retryCount > 0) {
          console.log(`Retrying update... (${retryCount} attempts left)`);
          // Wait for a short time before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.updateRentalPeriod(id, rental, retryCount - 1);
        }
        return false;
      }

      return true;
    } catch (error) {
      console.error('Exception updating rental period:', error);
      if (retryCount > 0) {
        console.log(`Retrying update after exception... (${retryCount} attempts left)`);
        // Wait for a short time before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.updateRentalPeriod(id, rental, retryCount - 1);
      }
      return false;
    }
  },

  // Remove a rental period with retry mechanism
  async removeRentalPeriod(id: string, retryCount = 3): Promise<boolean> {
    try {
      const { error } = await getAdminClient()
        .from('rental_periods')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error removing rental period:', error);
        if (retryCount > 0) {
          console.log(`Retrying removal... (${retryCount} attempts left)`);
          // Wait for a short time before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.removeRentalPeriod(id, retryCount - 1);
        }
        return false;
      }

      return true;
    } catch (error) {
      console.error('Exception removing rental period:', error);
      if (retryCount > 0) {
        console.log(`Retrying removal after exception... (${retryCount} attempts left)`);
        // Wait for a short time before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.removeRentalPeriod(id, retryCount - 1);
      }
      return false;
    }
  },

  // Subscribe to changes in rental periods
  // Subscribe to rental period changes with retry mechanism
  subscribeToRentalPeriods(callback: (periods: RentalPeriod[]) => void, maxRetries = 3): () => void {
    let retryCount = 0;
    let subscription: any = null;
    
    const setupSubscription = () => {
      try {
        // Clear any existing subscription
        if (subscription) {
          supabase.removeChannel(subscription);
          subscription = null;
        }
        
        subscription = supabase
          .channel('rental_periods_channel')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'rental_periods' },
            async (payload) => {
              try {
                // Check subscription status
                if (subscription?.state === 'SUBSCRIPTION_ERROR') {
                  console.error('Subscription error detected');
                  retrySubscription();
                  return;
                }
                
                // Fetch all rental periods after a change
                const periods = await this.fetchRentalPeriods();
                callback(periods);
              } catch (error) {
                console.error('Error handling subscription payload:', error);
              }
            }
          )
          .subscribe((status: any) => {
            if (status === 'SUBSCRIPTION_ERROR' && retryCount < maxRetries) {
              retrySubscription();
            } else if (status === 'SUBSCRIBED') {
              retryCount = 0; // Reset retry count on successful subscription
              console.log('Successfully subscribed to rental periods');
            }
          });
      } catch (error) {
        console.error('Error setting up subscription:', error);
        retrySubscription();
      }
    };
    
    const retrySubscription = () => {
      if (retryCount < maxRetries) {
        retryCount++;
        console.log(`Retrying subscription (${retryCount}/${maxRetries})...`);
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 30000);
        
        setTimeout(() => {
          setupSubscription();
        }, delay);
      } else {
        console.error('Max subscription retries reached');
      }
    };
    
    // Initial setup
    setupSubscription();
    
    // Return unsubscribe function
    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
        subscription = null;
      }
    };
  },
};

// Add default export to fix the warning
export default rentalService;