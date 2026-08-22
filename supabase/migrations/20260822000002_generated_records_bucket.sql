-- ============================================================================
-- Migration: Create generated-records Storage Bucket & Owner-Restricted Policies
-- ============================================================================

-- 1. Create generated-records Storage Bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'generated-records',
  'generated-records',
  false,
  52428800, -- 50MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Idempotent RLS Policies for generated-records bucket
DROP POLICY IF EXISTS "Authenticated users can upload generated records" ON storage.objects;
CREATE POLICY "Authenticated users can upload generated records"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'generated-records');

DROP POLICY IF EXISTS "Users can read generated records" ON storage.objects;
CREATE POLICY "Users can read generated records"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'generated-records');

DROP POLICY IF EXISTS "Users can update generated records" ON storage.objects;
CREATE POLICY "Users can update generated records"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'generated-records');

DROP POLICY IF EXISTS "Users can delete generated records" ON storage.objects;
CREATE POLICY "Users can delete generated records"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'generated-records');
