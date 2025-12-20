-- Create custom types
CREATE TYPE public.user_role AS ENUM ('admin', 'user');
CREATE TYPE public.shift_status AS ENUM ('pending', 'paid');
CREATE TYPE public.payment_method AS ENUM ('hourly', 'per_shift');

-- Create profiles table (linked to auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'user',
    UNIQUE(user_id, role)
);

-- Create user_settings table
CREATE TABLE public.user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    contract_start_date DATE,
    weekly_hours DECIMAL(5,2) DEFAULT 18.00,
    extra_rate DECIMAL(10,2) DEFAULT 10.00,
    custom_hourly_rate DECIMAL(10,2),
    custom_shift_rate DECIMAL(10,2),
    use_custom_rates BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create shifts table (personal shifts)
CREATE TABLE public.shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    notes TEXT,
    status shift_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create global_shifts table (admin assigned)
CREATE TABLE public.global_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assigned_to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    notes TEXT,
    status shift_status DEFAULT 'pending',
    payment_amount DECIMAL(10,2),
    payment_method payment_method DEFAULT 'hourly',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create system_settings table
CREATE TABLE public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create change_logs table
CREATE TABLE public.change_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    details TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create user_audit_log table
CREATE TABLE public.user_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    details TEXT,
    performed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('payment_method', 'hourly', 'Metodo di pagamento: hourly o per_shift'),
('default_hourly_rate', '10.00', 'Tariffa oraria di default (€/h)'),
('default_shift_rate', '50.00', 'Tariffa per turno di default (€/turno)'),
('users_can_edit_rates', 'true', 'Gli utenti possono modificare le proprie tariffe');

-- Create indexes
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_shifts_user_id ON public.shifts(user_id);
CREATE INDEX idx_shifts_date ON public.shifts(date);
CREATE INDEX idx_shifts_status ON public.shifts(status);
CREATE INDEX idx_global_shifts_assigned_to ON public.global_shifts(assigned_to_user_id);
CREATE INDEX idx_global_shifts_date ON public.global_shifts(date);
CREATE INDEX idx_global_shifts_status ON public.global_shifts(status);
CREATE INDEX idx_change_logs_created_at ON public.change_logs(created_at);
CREATE INDEX idx_user_audit_log_user_id ON public.user_audit_log(user_id);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_audit_log ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
    )
$$;

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.has_role(auth.uid(), 'admin')
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can update any profile" ON public.profiles
    FOR UPDATE TO authenticated USING (public.is_admin());

CREATE POLICY "Admins can delete profiles" ON public.profiles
    FOR DELETE TO authenticated USING (public.is_admin());

-- RLS Policies for user_roles
CREATE POLICY "Users can view own role" ON public.user_roles
    FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins can manage roles" ON public.user_roles
    FOR ALL TO authenticated USING (public.is_admin());

-- RLS Policies for user_settings
CREATE POLICY "Users can view own settings" ON public.user_settings
    FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can update own settings" ON public.user_settings
    FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own settings" ON public.user_settings
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all settings" ON public.user_settings
    FOR ALL TO authenticated USING (public.is_admin());

-- RLS Policies for shifts
CREATE POLICY "Users can view own shifts" ON public.shifts
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can manage own shifts" ON public.shifts
    FOR ALL TO authenticated USING (user_id = auth.uid());

-- RLS Policies for global_shifts
CREATE POLICY "Everyone can view global shifts" ON public.global_shifts
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can manage own global shifts" ON public.global_shifts
    FOR ALL TO authenticated USING (assigned_to_user_id = auth.uid());

CREATE POLICY "Admins can manage all global shifts" ON public.global_shifts
    FOR ALL TO authenticated USING (public.is_admin());

-- RLS Policies for system_settings
CREATE POLICY "Everyone can view system settings" ON public.system_settings
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage system settings" ON public.system_settings
    FOR ALL TO authenticated USING (public.is_admin());

-- RLS Policies for change_logs
CREATE POLICY "Admins can view change logs" ON public.change_logs
    FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "Authenticated users can insert logs" ON public.change_logs
    FOR INSERT TO authenticated WITH CHECK (true);

-- RLS Policies for user_audit_log
CREATE POLICY "Admins can view audit logs" ON public.user_audit_log
    FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "Admins can insert audit logs" ON public.user_audit_log
    FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- Trigger to create profile and settings on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Create profile
    INSERT INTO public.profiles (id, username, full_name, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'full_name',
        NEW.email
    );
    
    -- Create default settings
    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id);
    
    -- Assign default user role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Add update triggers
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_shifts_updated_at
    BEFORE UPDATE ON public.shifts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_global_shifts_updated_at
    BEFORE UPDATE ON public.global_shifts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();