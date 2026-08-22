-- ============================================================================
-- Migration: Add template_id to experiments & Seed Default Templates
-- ============================================================================

-- 0. Make user_id in templates nullable for global system templates
ALTER TABLE public.templates ALTER COLUMN user_id DROP NOT NULL;

-- 1. Add template_id column to experiments table
ALTER TABLE public.experiments
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_experiments_template_id ON public.experiments(template_id);

-- 2. Update RLS Policy on templates to allow all users to read & insert templates
DROP POLICY IF EXISTS "Users can read their own templates" ON public.templates;
DROP POLICY IF EXISTS "Users can read templates" ON public.templates;

CREATE POLICY "Users can read templates"
  ON public.templates
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own templates" ON public.templates;

CREATE POLICY "Users can insert their own templates"
  ON public.templates
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 3. Seed Default System Templates
INSERT INTO public.templates (id, name, subject, configuration, created_at, updated_at)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'Physics/Chemistry Standard',
    'Physics/Chemistry',
    '{
      "section_order": ["aim", "apparatus", "procedure", "observation", "calculation", "result", "precautions"],
      "header_font": "Inter",
      "header_color": "#059669",
      "include_graph": true,
      "accent_color": "#10b981"
    }'::jsonb,
    NOW(),
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'Electronics/CS Standard',
    'Electronics/CS',
    '{
      "section_order": ["aim", "apparatus", "procedure", "observation", "calculation", "result"],
      "header_font": "Roboto",
      "header_color": "#2563eb",
      "include_graph": false,
      "accent_color": "#3b82f6"
    }'::jsonb,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  subject = EXCLUDED.subject,
  configuration = EXCLUDED.configuration,
  updated_at = NOW();
