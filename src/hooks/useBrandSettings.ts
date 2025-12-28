import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BrandSettings {
  company_name: string;
  company_logo_url: string;
  primary_color: string;
}

const defaultBrandSettings: BrandSettings = {
  company_name: '',
  company_logo_url: '',
  primary_color: '',
};

// Helper function to convert hex to HSL
function hexToHSL(hex: string): { h: number; s: number; l: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function useBrandSettings() {
  const [brandSettings, setBrandSettings] = useState<BrandSettings>(defaultBrandSettings);
  const [loading, setLoading] = useState(true);

  const fetchBrandSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['company_name', 'company_logo_url', 'primary_color']);

      if (error) throw error;

      const settingsMap = new Map(data?.map(s => [s.setting_key, s.setting_value]) || []);

      setBrandSettings({
        company_name: settingsMap.get('company_name') || '',
        company_logo_url: settingsMap.get('company_logo_url') || '',
        primary_color: settingsMap.get('primary_color') || '',
      });
    } catch (err) {
      console.error('Error fetching brand settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Apply brand colors to CSS variables
  const applyBrandColors = useCallback((color: string) => {
    if (!color) {
      // Reset to default colors
      document.documentElement.style.removeProperty('--primary');
      document.documentElement.style.removeProperty('--ring');
      document.documentElement.style.removeProperty('--sidebar-primary');
      return;
    }

    const hsl = hexToHSL(color);
    if (hsl) {
      const hslValue = `${hsl.h} ${hsl.s}% ${hsl.l}%`;
      document.documentElement.style.setProperty('--primary', hslValue);
      document.documentElement.style.setProperty('--ring', hslValue);
      document.documentElement.style.setProperty('--sidebar-primary', hslValue);
    }
  }, []);

  useEffect(() => {
    fetchBrandSettings();
  }, [fetchBrandSettings]);

  useEffect(() => {
    if (!loading) {
      applyBrandColors(brandSettings.primary_color);
    }
  }, [brandSettings.primary_color, loading, applyBrandColors]);

  return {
    brandSettings,
    loading,
    refetch: fetchBrandSettings,
  };
}
