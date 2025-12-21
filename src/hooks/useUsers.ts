import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type UserSettings = Database['public']['Tables']['user_settings']['Row'];
type UserRole = Database['public']['Enums']['user_role'];

interface UserWithDetails extends Profile {
  role?: UserRole;
  settings?: UserSettings | null;
}

export function useUsers() {
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      // Fetch settings
      const { data: settings } = await supabase
        .from('user_settings')
        .select('*');

      // Combine data
      const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
      const settingsMap = new Map(settings?.map(s => [s.user_id, s]) || []);

      const combined = (profiles || []).map(profile => ({
        ...profile,
        role: rolesMap.get(profile.id) || 'user',
        settings: settingsMap.get(profile.id) || null,
      }));

      setUsers(combined);
    } catch (err) {
      console.error('Error fetching users:', err);
      toast.error('Errore nel caricamento degli utenti');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const updateUser = async (
    userId: string,
    updates: {
      profile?: Partial<Profile>;
      role?: UserRole;
      settings?: Partial<UserSettings>;
    }
  ) => {
    try {
      if (updates.profile) {
        const { error } = await supabase
          .from('profiles')
          .update(updates.profile)
          .eq('id', userId);
        if (error) throw error;
      }

      if (updates.role) {
        const { error } = await supabase
          .from('user_roles')
          .update({ role: updates.role })
          .eq('user_id', userId);
        if (error) throw error;
      }

      if (updates.settings) {
        const { error } = await supabase
          .from('user_settings')
          .update(updates.settings)
          .eq('user_id', userId);
        if (error) throw error;
      }

      await fetchUsers();
      toast.success('Utente aggiornato');
      return true;
    } catch (err) {
      console.error('Error updating user:', err);
      toast.error('Errore nell\'aggiornamento');
      return false;
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      // Check if user is admin
      const user = users.find(u => u.id === userId);
      if (user?.role === 'admin') {
        toast.error('Non puoi eliminare un amministratore');
        return false;
      }

      // Delete user settings
      await supabase.from('user_settings').delete().eq('user_id', userId);
      
      // Delete user shifts
      await supabase.from('shifts').delete().eq('user_id', userId);
      
      // Delete global shifts
      await supabase.from('global_shifts').delete().eq('assigned_to_user_id', userId);
      
      // Delete user role
      await supabase.from('user_roles').delete().eq('user_id', userId);
      
      // Delete profile
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) throw error;

      setUsers(prev => prev.filter(u => u.id !== userId));
      toast.success('Utente eliminato');
      return true;
    } catch (err) {
      console.error('Error deleting user:', err);
      toast.error('Errore nell\'eliminazione');
      return false;
    }
  };

  return {
    users,
    loading,
    updateUser,
    deleteUser,
    refetch: fetchUsers,
  };
}
