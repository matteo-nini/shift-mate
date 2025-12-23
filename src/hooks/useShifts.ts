import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';

type Shift = Database['public']['Tables']['shifts']['Row'];
type GlobalShift = Database['public']['Tables']['global_shifts']['Row'];
type ShiftInsert = Database['public']['Tables']['shifts']['Insert'];
type ShiftUpdate = Database['public']['Tables']['shifts']['Update'];

export function useShifts() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchShifts = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;
      setShifts(data || []);
    } catch (err) {
      console.error('Error fetching shifts:', err);
      toast.error('Errore nel caricamento dei turni');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const addShift = async (shift: Omit<ShiftInsert, 'user_id'>) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('shifts')
        .insert({ ...shift, user_id: user.id })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('global_shifts').insert({
        assigned_to_user_id: user.id,
        created_by_user_id: user.id,
        date: shift.date,
        start_time: shift.start_time,
        end_time: shift.end_time,
        notes: shift.notes,
        status: shift.status || 'pending',
      });

      setShifts(prev => [data, ...prev]);
      toast.success('Turno aggiunto con successo');
      return data;
    } catch (err) {
      console.error('Error adding shift:', err);
      toast.error('Errore nell\'aggiunta del turno');
      return null;
    }
  };

  const updateShift = async (id: string, updates: ShiftUpdate) => {
    try {
      const { data, error } = await supabase
        .from('shifts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setShifts(prev => prev.map(s => s.id === id ? data : s));
      toast.success('Turno aggiornato');
      return data;
    } catch (err) {
      console.error('Error updating shift:', err);
      toast.error('Errore nell\'aggiornamento del turno');
      return null;
    }
  };

  const deleteShift = async (id: string) => {
    try {
      const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setShifts(prev => prev.filter(s => s.id !== id));
      toast.success('Turno eliminato');
      return true;
    } catch (err) {
      console.error('Error deleting shift:', err);
      toast.error('Errore nell\'eliminazione del turno');
      return false;
    }
  };

  return {
    shifts,
    loading,
    addShift,
    updateShift,
    deleteShift,
    refetch: fetchShifts,
  };
}

type GlobalShiftWithProfile = GlobalShift & { 
  profile?: { username: string; full_name: string | null } | null 
};

export function useGlobalShifts() {
  const { user, isAdmin } = useAuth();
  const [shifts, setShifts] = useState<GlobalShiftWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchShifts = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch global shifts
      const { data: shiftsData, error: shiftsError } = await supabase
        .from('global_shifts')
        .select('*')
        .order('date', { ascending: false });

      if (shiftsError) throw shiftsError;

      // Fetch profiles separately
      const userIds = [...new Set(shiftsData?.map(s => s.assigned_to_user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .in('id', userIds);

      // Combine data
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const combined = (shiftsData || []).map(shift => ({
        ...shift,
        profile: profileMap.get(shift.assigned_to_user_id) || null
      }));

      setShifts(combined);
    } catch (err) {
      console.error('Error fetching global shifts:', err);
      toast.error('Errore nel caricamento del calendario');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const addGlobalShift = async (shift: {
    assigned_to_user_id: string;
    date: string;
    start_time: string;
    end_time: string;
    notes?: string;
  }) => {
    if (!user || !isAdmin) return null;

    try {
      const { data, error } = await supabase
        .from('global_shifts')
        .insert({
          ...shift,
          created_by_user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .eq('id', shift.assigned_to_user_id)
        .maybeSingle();

      await supabase.from('change_logs').insert({
        user_id: user.id,
        action: 'add',
        details: `Turno aggiunto per ${profile?.username || 'utente'} il ${shift.date}`,
      });

      // Send email notification to assigned user
      try {
        await supabase.functions.invoke('notify-shift', {
          body: {
            user_id: shift.assigned_to_user_id,
            shift_date: shift.date,
            start_time: shift.start_time,
            end_time: shift.end_time,
            notes: shift.notes,
          },
        });
        console.log('Email notification sent successfully');
      } catch (notifyError) {
        console.error('Failed to send notification:', notifyError);
        // Don't fail the main operation if notification fails
      }

      const newShift = { ...data, profile };
      setShifts(prev => [newShift, ...prev]);
      toast.success('Turno aggiunto al calendario globale');
      return newShift;
    } catch (err) {
      console.error('Error adding global shift:', err);
      toast.error('Errore nell\'aggiunta del turno');
      return null;
    }
  };

  const updateGlobalShift = async (id: string, updates: Partial<GlobalShift>) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('global_shifts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const existing = shifts.find(s => s.id === id);
      const updatedShift = { ...data, profile: existing?.profile };

      setShifts(prev => prev.map(s => s.id === id ? updatedShift : s));
      toast.success('Turno aggiornato');
      return updatedShift;
    } catch (err) {
      console.error('Error updating global shift:', err);
      toast.error('Errore nell\'aggiornamento');
      return null;
    }
  };

  const deleteGlobalShift = async (id: string) => {
    if (!user) return false;

    try {
      const shift = shifts.find(s => s.id === id);
      
      const { error } = await supabase
        .from('global_shifts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      if (isAdmin && shift) {
        await supabase.from('change_logs').insert({
          user_id: user.id,
          action: 'delete',
          details: `Turno eliminato per ${shift.profile?.username || 'utente'} il ${shift.date}`,
        });
      }

      setShifts(prev => prev.filter(s => s.id !== id));
      toast.success('Turno eliminato');
      return true;
    } catch (err) {
      console.error('Error deleting global shift:', err);
      toast.error('Errore nell\'eliminazione');
      return false;
    }
  };

  return {
    shifts,
    loading,
    addGlobalShift,
    updateGlobalShift,
    deleteGlobalShift,
    refetch: fetchShifts,
  };
}
