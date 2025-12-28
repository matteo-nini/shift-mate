-- Create storage bucket for company assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to company-assets (only admins in practice)
CREATE POLICY "Admins can upload company assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-assets' 
  AND public.is_admin()
);

-- Allow public read access to company assets
CREATE POLICY "Public can view company assets"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'company-assets');

-- Allow admins to update company assets
CREATE POLICY "Admins can update company assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'company-assets' AND public.is_admin());

-- Allow admins to delete company assets
CREATE POLICY "Admins can delete company assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'company-assets' AND public.is_admin());