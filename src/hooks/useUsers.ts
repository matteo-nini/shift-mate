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

  // Helper to log user actions
  const logUserAction = async (userId: string, action: string, details: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('user_audit_log').insert({
        user_id: userId,
        action,
        details,
        performed_by_user_id: user?.id || null,
      });
    } catch (err) {
      console.error('Error logging user action:', err);
    }
  };

  const updateUser = async (
    userId: string,
    updates: {
      profile?: Partial<Profile>;
      role?: UserRole;
      settings?: Partial<UserSettings>;
    }
  ) => {
    try {
      const user = users.find(u => u.id === userId);
      const changes: string[] = [];

      if (updates.profile) {
        const { error } = await supabase
          .from('profiles')
          .update(updates.profile)
          .eq('id', userId);
        if (error) throw error;

        // Track profile changes
        if (updates.profile.full_name !== undefined && updates.profile.full_name !== user?.full_name) {
          changes.push(`Nome: "${user?.full_name || '-'}" → "${updates.profile.full_name || '-'}"`);
        }
        if (updates.profile.email !== undefined && updates.profile.email !== user?.email) {
          changes.push(`Email: "${user?.email || '-'}" → "${updates.profile.email || '-'}"`);
        }
        if (updates.profile.is_active !== undefined && updates.profile.is_active !== user?.is_active) {
          changes.push(`Stato: ${user?.is_active ? 'Attivo' : 'Disabilitato'} → ${updates.profile.is_active ? 'Attivo' : 'Disabilitato'}`);
        }
      }

      if (updates.role && updates.role !== user?.role) {
        const { error } = await supabase
          .from('user_roles')
          .update({ role: updates.role })
          .eq('user_id', userId);
        if (error) throw error;
        changes.push(`Ruolo: ${user?.role || 'user'} → ${updates.role}`);
      }

      if (updates.settings) {
        const { error } = await supabase
          .from('user_settings')
          .update(updates.settings)
          .eq('user_id', userId);
        if (error) throw error;

        // Track settings changes
        if (updates.settings.weekly_hours !== undefined && updates.settings.weekly_hours !== user?.settings?.weekly_hours) {
          changes.push(`Ore settimanali: ${user?.settings?.weekly_hours || 18} → ${updates.settings.weekly_hours}`);
        }
        if (updates.settings.use_custom_rates !== undefined && updates.settings.use_custom_rates !== user?.settings?.use_custom_rates) {
          changes.push(`Tariffe personalizzate: ${user?.settings?.use_custom_rates ? 'Sì' : 'No'} → ${updates.settings.use_custom_rates ? 'Sì' : 'No'}`);
        }
      }

      // Log the update action
      if (changes.length > 0) {
        await logUserAction(
          userId,
          'update',
          `Modificato utente ${user?.username || user?.full_name || userId}: ${changes.join(', ')}`
        );
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

      const userName = user?.username || user?.full_name || userId;

      // Delete user settings
      await supabase.from('user_settings').delete().eq('user_id', userId);
      
      // Delete user shifts
      await supabase.from('shifts').delete().eq('user_id', userId);
      
      // Delete global shifts
      await supabase.from('global_shifts').delete().eq('assigned_to_user_id', userId);
      
      // Delete leave requests
      await supabase.from('leave_requests').delete().eq('user_id', userId);
      
      // Delete user role
      await supabase.from('user_roles').delete().eq('user_id', userId);
      
      // Delete profile
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) throw error;

      // Log the deletion
      await logUserAction(userId, 'delete', `Eliminato utente: ${userName}`);

      setUsers(prev => prev.filter(u => u.id !== userId));
      toast.success('Utente eliminato');
      return true;
    } catch (err) {
      console.error('Error deleting user:', err);
      toast.error('Errore nell\'eliminazione');
      return false;
    }
  };

  const createUserAuditLog = async (userId: string, action: string, details: string) => {
    await logUserAction(userId, action, details);
  };

  return {
    users,
    loading,
    updateUser,
    deleteUser,
    createUserAuditLog,
    refetch: fetchUsers,
  };
}
