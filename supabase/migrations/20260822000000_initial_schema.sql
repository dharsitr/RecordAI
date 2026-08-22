-- ==============================================================================
-- Migration: 20260822000000_initial_schema.sql
-- Description: RecordAI Database Schema & Row Level Security (RLS) Policies
-- Author: Senior Full-Stack Engineer
-- Note: Fully Idempotent Migration script for PostgreSQL / Supabase
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 0. AUTOMATIC UPDATED_AT TRIGGER FUNCTION
-- ------------------------------------------------------------------------------
-- Function to automatically set updated_at column to NOW() on row updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ------------------------------------------------------------------------------
-- 1. EXPERIMENTS TABLE
-- Stores top-level research and laboratory experiments created by users
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    subject TEXT,
    experiment_number TEXT,
    template_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for foreign key performance and RLS evaluations
CREATE INDEX IF NOT EXISTS idx_experiments_user_id ON experiments(user_id);

-- Trigger for auto-updating updated_at timestamp
DROP TRIGGER IF EXISTS set_experiments_updated_at ON experiments;
CREATE TRIGGER set_experiments_updated_at
    BEFORE UPDATE ON experiments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ------------------------------------------------------------------------------
-- 2. DOCUMENTS TABLE
-- Stores photographed or uploaded notebook page document metadata
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    processing_status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for foreign key lookups and RLS evaluations
CREATE INDEX IF NOT EXISTS idx_documents_experiment_id ON documents(experiment_id);

-- Trigger for auto-updating updated_at timestamp
DROP TRIGGER IF EXISTS set_documents_updated_at ON documents;
CREATE TRIGGER set_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ------------------------------------------------------------------------------
-- 3. SECTIONS TABLE
-- Stores digitized text sections extracted from lab document images via OCR/AI
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    section_type TEXT NOT NULL,
    content TEXT,
    confidence DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for foreign key lookups and RLS evaluations
CREATE INDEX IF NOT EXISTS idx_sections_document_id ON sections(document_id);

-- Trigger for auto-updating updated_at timestamp
DROP TRIGGER IF EXISTS set_sections_updated_at ON sections;
CREATE TRIGGER set_sections_updated_at
    BEFORE UPDATE ON sections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ------------------------------------------------------------------------------
-- 4. OBSERVATION_TABLES TABLE
-- Stores tabular experimental observations extracted from lab notebook pages
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS observation_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    title TEXT,
    data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for foreign key lookups and RLS evaluations
CREATE INDEX IF NOT EXISTS idx_observation_tables_document_id ON observation_tables(document_id);

-- Trigger for auto-updating updated_at timestamp
DROP TRIGGER IF EXISTS set_observation_tables_updated_at ON observation_tables;
CREATE TRIGGER set_observation_tables_updated_at
    BEFORE UPDATE ON observation_tables
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ------------------------------------------------------------------------------
-- 5. CALCULATIONS TABLE
-- Stores math expressions, variable inputs, outputs, and verification statuses
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calculations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    expression TEXT NOT NULL,
    inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
    output TEXT,
    verification_status TEXT NOT NULL DEFAULT 'unverified',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for foreign key lookups and RLS evaluations
CREATE INDEX IF NOT EXISTS idx_calculations_experiment_id ON calculations(experiment_id);

-- Trigger for auto-updating updated_at timestamp
DROP TRIGGER IF EXISTS set_calculations_updated_at ON calculations;
CREATE TRIGGER set_calculations_updated_at
    BEFORE UPDATE ON calculations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ------------------------------------------------------------------------------
-- 6. TEMPLATES TABLE
-- Stores predefined lab notebook layout and extraction configuration templates
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    subject TEXT,
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for foreign key lookups and RLS evaluations
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);

-- Trigger for auto-updating updated_at timestamp
DROP TRIGGER IF EXISTS set_templates_updated_at ON templates;
CREATE TRIGGER set_templates_updated_at
    BEFORE UPDATE ON templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ------------------------------------------------------------------------------
-- 7. GENERATED_DOCUMENTS TABLE
-- Stores metadata for exported PDF/Word/LaTeX reports compiled from experiments
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS generated_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    format TEXT NOT NULL,
    file_path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for foreign key lookups and RLS evaluations
CREATE INDEX IF NOT EXISTS idx_generated_documents_experiment_id ON generated_documents(experiment_id);

-- Trigger for auto-updating updated_at timestamp
DROP TRIGGER IF EXISTS set_generated_documents_updated_at ON generated_documents;
CREATE TRIGGER set_generated_documents_updated_at
    BEFORE UPDATE ON generated_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable Row Level Security on all 7 tables
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE observation_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_documents ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- RLS POLICIES FOR: experiments
-- ------------------------------------------------------------------------------
-- Inline Comment: Restrict SELECT, INSERT, UPDATE, and DELETE operations to users who own the experiment (user_id = auth.uid()).
DROP POLICY IF EXISTS "Users can view their own experiments" ON experiments;
CREATE POLICY "Users can view their own experiments"
    ON experiments FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own experiments" ON experiments;
CREATE POLICY "Users can insert their own experiments"
    ON experiments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own experiments" ON experiments;
CREATE POLICY "Users can update their own experiments"
    ON experiments FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own experiments" ON experiments;
CREATE POLICY "Users can delete their own experiments"
    ON experiments FOR DELETE
    USING (auth.uid() = user_id);


-- ------------------------------------------------------------------------------
-- RLS POLICIES FOR: documents
-- ------------------------------------------------------------------------------
-- Inline Comment: Restrict document access to users who own the parent experiment associated with experiment_id.
DROP POLICY IF EXISTS "Users can view documents of their experiments" ON documents;
CREATE POLICY "Users can view documents of their experiments"
    ON documents FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM experiments
            WHERE experiments.id = documents.experiment_id
              AND experiments.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert documents into their experiments" ON documents;
CREATE POLICY "Users can insert documents into their experiments"
    ON documents FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM experiments
            WHERE experiments.id = documents.experiment_id
              AND experiments.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update documents of their experiments" ON documents;
CREATE POLICY "Users can update documents of their experiments"
    ON documents FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM experiments
            WHERE experiments.id = documents.experiment_id
              AND experiments.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM experiments
            WHERE experiments.id = documents.experiment_id
              AND experiments.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete documents of their experiments" ON documents;
CREATE POLICY "Users can delete documents of their experiments"
    ON documents FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM experiments
            WHERE experiments.id = documents.experiment_id
              AND experiments.user_id = auth.uid()
        )
    );


-- ------------------------------------------------------------------------------
-- RLS POLICIES FOR: sections
-- ------------------------------------------------------------------------------
-- Inline Comment: Restrict section access to users owning the underlying document's experiment (documents.document_id -> experiment_id -> user_id = auth.uid()).
DROP POLICY IF EXISTS "Users can view sections of their experiment documents" ON sections;
CREATE POLICY "Users can view sections of their experiment documents"
    ON sections FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM documents
            JOIN experiments ON experiments.id = documents.experiment_id
            WHERE documents.id = sections.document_id
              AND experiments.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert sections into their experiment documents" ON sections;
CREATE POLICY "Users can insert sections into their experiment documents"
    ON sections FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM documents
            JOIN experiments ON experiments.id = documents.experiment_id
            WHERE documents.id = sections.document_id
              AND experiments.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update sections of their experiment documents" ON sections;
CREATE POLICY "Users can update sections of their experiment documents"
    ON sections FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM documents
            JOIN experiments ON experiments.id = documents.experiment_id
            WHERE documents.id = sections.document_id
              AND experiments.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM documents
            JOIN experiments ON experiments.id = documents.experiment_id
            WHERE documents.id = sections.document_id
              AND experiments.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete sections of their experiment documents" ON sections;
CREATE POLICY "Users can delete sections of their experiment documents"
    ON sections FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM documents
            JOIN experiments ON experiments.id = documents.experiment_id
            WHERE documents.id = sections.document_id
              AND experiments.user_id = auth.uid()
        )
    );


-- ------------------------------------------------------------------------------
-- RLS POLICIES FOR: observation_tables
-- ------------------------------------------------------------------------------
-- Inline Comment: Restrict observation table access to users owning the underlying document's experiment (documents.document_id -> experiment_id -> user_id = auth.uid()).
DROP POLICY IF EXISTS "Users can view observation tables of their experiment documents" ON observation_tables;
CREATE POLICY "Users can view observation tables of their experiment documents"
    ON observation_tables FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM documents
            JOIN experiments ON experiments.id = documents.experiment_id
            WHERE documents.id = observation_tables.document_id
              AND experiments.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert observation tables into their experiment documents" ON observation_tables;
CREATE POLICY "Users can insert observation tables into their experiment documents"
    ON observation_tables FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM documents
            JOIN experiments ON experiments.id = documents.experiment_id
            WHERE documents.id = observation_tables.document_id
              AND experiments.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update observation tables of their experiment documents" ON observation_tables;
CREATE POLICY "Users can update observation tables of their experiment documents"
    ON observation_tables FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM documents
            JOIN experiments ON experiments.id = documents.experiment_id
            WHERE documents.id = observation_tables.document_id
              AND experiments.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM documents
            JOIN experiments ON experiments.id = documents.experiment_id
            WHERE documents.id = observation_tables.document_id
              AND experiments.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete observation tables of their experiment documents" ON observation_tables;
CREATE POLICY "Users can delete observation tables of their experiment documents"
    ON observation_tables FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM documents
            JOIN experiments ON experiments.id = documents.experiment_id
            WHERE documents.id = observation_tables.document_id
              AND experiments.user_id = auth.uid()
        )
    );


-- ------------------------------------------------------------------------------
-- RLS POLICIES FOR: calculations
-- ------------------------------------------------------------------------------
-- Inline Comment: Restrict calculations access to users who own the parent experiment referenced by experiment_id.
DROP POLICY IF EXISTS "Users can view calculations of their experiments" ON calculations;
CREATE POLICY "Users can view calculations of their experiments"
    ON calculations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM experiments
            WHERE experiments.id = calculations.experiment_id
              AND experiments.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert calculations into their experiments" ON calculations;
CREATE POLICY "Users can insert calculations into their experiments"
    ON calculations FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM experiments
            WHERE experiments.id = calculations.experiment_id
              AND experiments.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update calculations of their experiments" ON calculations;
CREATE POLICY "Users can update calculations of their experiments"
    ON calculations FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM experiments
            WHERE experiments.id = calculations.experiment_id
              AND experiments.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM experiments
            WHERE experiments.id = calculations.experiment_id
              AND experiments.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete calculations of their experiments" ON calculations;
CREATE POLICY "Users can delete calculations of their experiments"
    ON calculations FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM experiments
            WHERE experiments.id = calculations.experiment_id
              AND experiments.user_id = auth.uid()
        )
    );


-- ------------------------------------------------------------------------------
-- RLS POLICIES FOR: templates
-- ------------------------------------------------------------------------------
-- Inline Comment: Restrict template viewing, creation, updating, and deletion to the template owner (user_id = auth.uid()).
DROP POLICY IF EXISTS "Users can view their own templates" ON templates;
CREATE POLICY "Users can view their own templates"
    ON templates FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own templates" ON templates;
CREATE POLICY "Users can insert their own templates"
    ON templates FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own templates" ON templates;
CREATE POLICY "Users can update their own templates"
    ON templates FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own templates" ON templates;
CREATE POLICY "Users can delete their own templates"
    ON templates FOR DELETE
    USING (auth.uid() = user_id);


-- ------------------------------------------------------------------------------
-- RLS POLICIES FOR: generated_documents
-- ------------------------------------------------------------------------------
-- Inline Comment: Restrict generated document report access to users who own the parent experiment referenced by experiment_id.
DROP POLICY IF EXISTS "Users can view generated documents of their experiments" ON generated_documents;
CREATE POLICY "Users can view generated documents of their experiments"
    ON generated_documents FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM experiments
            WHERE experiments.id = generated_documents.experiment_id
              AND experiments.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert generated documents into their experiments" ON generated_documents;
CREATE POLICY "Users can insert generated documents into their experiments"
    ON generated_documents FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM experiments
            WHERE experiments.id = generated_documents.experiment_id
              AND experiments.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update generated documents of their experiments" ON generated_documents;
CREATE POLICY "Users can update generated documents of their experiments"
    ON generated_documents FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM experiments
            WHERE experiments.id = generated_documents.experiment_id
              AND experiments.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM experiments
            WHERE experiments.id = generated_documents.experiment_id
              AND experiments.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete generated documents of their experiments" ON generated_documents;
CREATE POLICY "Users can delete generated documents of their experiments"
    ON generated_documents FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM experiments
            WHERE experiments.id = generated_documents.experiment_id
              AND experiments.user_id = auth.uid()
        )
    );
