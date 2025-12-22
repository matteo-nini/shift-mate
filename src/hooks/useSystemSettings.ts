import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SystemSettings {
  payment_method: 'hourly' | 'per_shift';
  default_hourly_rate: number;
  default_shift_rate: number;
  users_can_edit_rates: boolean;
  allow_public_registration: boolean;
}

const defaultSettings: SystemSettings = {
  payment_method: 'hourly',
  default_hourly_rate: 10,
  default_shift_rate: 50,
  users_can_edit_rates: true,
  allow_public_registration: true,
};

export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value');

      if (error) throw error;

      const settingsMap = new Map(data?.map(s => [s.setting_key, s.setting_value]) || []);

      setSettings({
        payment_method: (settingsMap.get('payment_method') as 'hourly' | 'per_shift') || 'hourly',
        default_hourly_rate: parseFloat(settingsMap.get('default_hourly_rate') || '10'),
        default_shift_rate: parseFloat(settingsMap.get('default_shift_rate') || '50'),
        users_can_edit_rates: settingsMap.get('users_can_edit_rates') === '1',
        allow_public_registration: settingsMap.get('allow_public_registration') !== '0',
      });
    } catch (err) {
      console.error('Error fetching system settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = async (key: keyof SystemSettings, value: string | number | boolean) => {
    try {
      const stringValue = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);

      const { error } = await supabase
        .from('system_settings')
        .upsert(
          { setting_key: key, setting_value: stringValue },
          { onConflict: 'setting_key' }
        );

      if (error) throw error;

      setSettings(prev => ({
        ...prev,
        [key]: value,
      }));

      toast.success('Impostazione aggiornata');
      return true;
    } catch (err) {
      console.error('Error updating setting:', err);
      toast.error('Errore nell\'aggiornamento');
      return false;
    }
  };

  const updateMultipleSettings = async (updates: Partial<SystemSettings>) => {
    try {
      const upserts = Object.entries(updates).map(([key, value]) => ({
        setting_key: key,
        setting_value: typeof value === 'boolean' ? (value ? '1' : '0') : String(value),
      }));

      const { error } = await supabase
        .from('system_settings')
        .upsert(upserts, { onConflict: 'setting_key' });

      if (error) throw error;

      setSettings(prev => ({ ...prev, ...updates }));
      toast.success('Impostazioni aggiornate');
      return true;
    } catch (err) {
      console.error('Error updating settings:', err);
      toast.error('Errore nell\'aggiornamento');
      return false;
    }
  };

  return {
    settings,
    loading,
    updateSetting,
    updateMultipleSettings,
    refetch: fetchSettings,
  };
}
