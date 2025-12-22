-- Insert allow_public_registration setting if not exists
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES ('allow_public_registration', '1', 'Permetti la registrazione pubblica')
ON CONFLICT (setting_key) DO NOTHING;