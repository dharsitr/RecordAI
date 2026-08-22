-- ==============================================================================
-- Migration: 20260822000001_storage_bucket_lab_uploads.sql
-- Description: Provision private 'lab-uploads' storage bucket & RLS policies
-- Author: Full-Stack Engineer
-- Note: Idempotent migration for PostgreSQL / Supabase Storage
-- ==============================================================================

-- 1. Insert private 'lab-uploads' storage bucket if it does not exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'lab-uploads',
    'lab-uploads',
    false,
    15728640, -- 15MB file size limit in bytes (15 * 1024 * 1024)
    ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 15728640,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'application/pdf'];


-- 2. ROW LEVEL SECURITY (RLS) POLICIES FOR 'lab-uploads' BUCKET
-- Restrict access to paths matching {user_id}/* where user_id equals auth.uid()

-- 2.1 SELECT Policy: Users can view their own uploaded files
DROP POLICY IF EXISTS "Users can view their own lab uploads" ON storage.objects;
CREATE POLICY "Users can view their own lab uploads"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'lab-uploads'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- 2.2 INSERT Policy: Users can upload files into their own folder ({user_id}/*)
DROP POLICY IF EXISTS "Users can upload into their own folder in lab-uploads" ON storage.objects;
CREATE POLICY "Users can upload into their own folder in lab-uploads"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'lab-uploads'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- 2.3 UPDATE Policy: Users can update their own lab uploads
DROP POLICY IF EXISTS "Users can update their own lab uploads" ON storage.objects;
CREATE POLICY "Users can update their own lab uploads"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'lab-uploads'
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'lab-uploads'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- 2.4 DELETE Policy: Users can delete their own lab uploads
DROP POLICY IF EXISTS "Users can delete their own lab uploads" ON storage.objects;
CREATE POLICY "Users can delete their own lab uploads"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'lab-uploads'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
