-- Create leave request status enum
CREATE TYPE public.leave_request_status AS ENUM ('pending', 'approved', 'rejected');

-- Create leave request type enum
CREATE TYPE public.leave_request_type AS ENUM ('ferie', 'permesso', 'malattia', 'altro');

-- Create leave requests table
CREATE TABLE public.leave_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    request_type leave_request_type NOT NULL DEFAULT 'ferie',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status leave_request_status NOT NULL DEFAULT 'pending',
    reviewed_by_user_id UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own leave requests"
ON public.leave_requests
FOR SELECT
USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Users can create own leave requests"
ON public.leave_requests
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own pending requests"
ON public.leave_requests
FOR UPDATE
USING (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Admins can manage all leave requests"
ON public.leave_requests
FOR ALL
USING (is_admin());

-- Add trigger for updated_at
CREATE TRIGGER update_leave_requests_updated_at
BEFORE UPDATE ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();