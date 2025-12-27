-- Add is_extra column to shifts table for per-shift payment mode
ALTER TABLE public.shifts ADD COLUMN is_extra boolean NOT NULL DEFAULT false;

-- Add is_extra column to global_shifts table for consistency
ALTER TABLE public.global_shifts ADD COLUMN is_extra boolean NOT NULL DEFAULT false;