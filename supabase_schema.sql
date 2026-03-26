-- ============================================================
-- OutreachBot – Complete Supabase Schema
-- Run this in your Supabase SQL Editor to create everything
-- ============================================================

-- ─── 1. TEMPLATES ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE
);

-- ─── 2. APPLICATIONS ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  email TEXT NOT NULL,
  template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Applied',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  history JSONB NOT NULL DEFAULT '[]',
  follow_up_template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  follow_up_days INTEGER,
  follow_up_sent_at TIMESTAMPTZ
);

-- ─── 3. DOCUMENTS ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 4. SETTINGS ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  follow_ups_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  scheduling_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  reply_polling_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  follow_up_interval_minutes INTEGER NOT NULL DEFAULT 60,
  scheduling_interval_minutes INTEGER NOT NULL DEFAULT 360,
  reply_polling_interval_minutes INTEGER NOT NULL DEFAULT 5,
  follow_up_template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  follow_up_days INTEGER NOT NULL DEFAULT 4,
  last_follow_up_at TIMESTAMPTZ,
  last_scheduling_at TIMESTAMPTZ,
  last_reply_polling_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default global settings row
INSERT INTO settings (
  id,
  follow_ups_enabled,
  scheduling_enabled,
  reply_polling_enabled,
  follow_up_interval_minutes,
  scheduling_interval_minutes,
  reply_polling_interval_minutes,
  follow_up_days
)
VALUES (
  'global', true, true, true, 60, 360, 5, 4
)
ON CONFLICT (id) DO NOTHING;

-- ─── 5. ROW LEVEL SECURITY ─────────────────────────────────

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Allow full access (no auth — single-user app)
DROP POLICY IF EXISTS "allow_all_templates" ON templates;
CREATE POLICY "allow_all_templates" ON templates
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_applications" ON applications;
CREATE POLICY "allow_all_applications" ON applications
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_documents" ON documents;
CREATE POLICY "allow_all_documents" ON documents
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_settings" ON settings;
CREATE POLICY "allow_all_settings" ON settings
  FOR ALL USING (true) WITH CHECK (true);

-- ─── 6. STORAGE BUCKET ─────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "allow_all_storage" ON storage.objects;
CREATE POLICY "allow_all_storage" ON storage.objects
  FOR ALL USING (bucket_id = 'documents')
  WITH CHECK (bucket_id = 'documents');

-- ─── 7. INDEXES (performance) ──────────────────────────────

CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_sent_at ON applications(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_email ON applications(email);
CREATE INDEX IF NOT EXISTS idx_applications_follow_up ON applications(status, follow_up_sent_at)
  WHERE follow_up_sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_type_default ON documents(type, is_default);
CREATE INDEX IF NOT EXISTS idx_templates_default ON templates(is_default)
  WHERE is_default = TRUE;
