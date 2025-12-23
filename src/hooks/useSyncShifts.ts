import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useSyncShifts() {
  const { user } = useAuth();
  const hasSynced = useRef(false);

  const syncShifts = useCallback(async () => {
    if (!user || hasSynced.current) return;
    
    hasSynced.current = true;
    console.log('Starting shift sync for user:', user.id);

    try {
      // Fetch global shifts assigned to this user
      const { data: globalShifts, error: globalError } = await supabase
        .from('global_shifts')
        .select('*')
        .eq('assigned_to_user_id', user.id);

      if (globalError) throw globalError;

      // Fetch personal shifts
      const { data: personalShifts, error: personalError } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', user.id);

      if (personalError) throw personalError;

      // Find global shifts not in personal shifts (by matching date, start_time, end_time)
      const personalShiftKeys = new Set(
        personalShifts?.map(s => `${s.date}-${s.start_time}-${s.end_time}`) || []
      );

      const missingShifts = globalShifts?.filter(gs => {
        const key = `${gs.date}-${gs.start_time}-${gs.end_time}`;
        return !personalShiftKeys.has(key);
      }) || [];

      if (missingShifts.length > 0) {
        // Add missing shifts to personal shifts
        const shiftsToInsert = missingShifts.map(gs => ({
          user_id: user.id,
          date: gs.date,
          start_time: gs.start_time,
          end_time: gs.end_time,
          notes: gs.notes,
          status: gs.status,
        }));

        const { error: insertError } = await supabase
          .from('shifts')
          .insert(shiftsToInsert);

        if (insertError) throw insertError;

        console.log(`Synced ${missingShifts.length} shifts from global calendar`);
        toast.success(`${missingShifts.length} nuovi turni sincronizzati`);
      } else {
        console.log('No new shifts to sync');
      }

      // Also sync personal shifts to global (for non-admin users who added shifts directly)
      const globalShiftKeys = new Set(
        globalShifts?.map(s => `${s.date}-${s.start_time}-${s.end_time}`) || []
      );

      const personalOnlyShifts = personalShifts?.filter(ps => {
        const key = `${ps.date}-${ps.start_time}-${ps.end_time}`;
        return !globalShiftKeys.has(key);
      }) || [];

      if (personalOnlyShifts.length > 0) {
        const globalToInsert = personalOnlyShifts.map(ps => ({
          assigned_to_user_id: user.id,
          created_by_user_id: user.id,
          date: ps.date,
          start_time: ps.start_time,
          end_time: ps.end_time,
          notes: ps.notes,
          status: ps.status,
        }));

        const { error: globalInsertError } = await supabase
          .from('global_shifts')
          .insert(globalToInsert);

        if (globalInsertError) {
          console.error('Error syncing to global:', globalInsertError);
          // Don't throw, personal shifts might not have permission to add global
        } else {
          console.log(`Synced ${personalOnlyShifts.length} personal shifts to global calendar`);
        }
      }
    } catch (err) {
      console.error('Error syncing shifts:', err);
    }
  }, [user]);

  useEffect(() => {
    syncShifts();
  }, [syncShifts]);

  return { syncShifts };
}
