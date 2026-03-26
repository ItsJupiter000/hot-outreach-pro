-- ============================================================
-- OutreachBot – Auth Migration Script
-- Run this in your Supabase SQL Editor AFTER the original schema
-- ============================================================

-- ─── 1. PROFILES TABLE (stores user info + email variables) ─

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  linkedin_url TEXT NOT NULL DEFAULT '',
  portfolio_url TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  -- SMTP settings per user
  smtp_host TEXT NOT NULL DEFAULT '',
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_user TEXT NOT NULL DEFAULT '',
  smtp_pass TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_profile" ON profiles;
CREATE POLICY "users_read_own_profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "users_insert_own_profile" ON profiles;
CREATE POLICY "users_insert_own_profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ─── 2. ADD user_id TO EXISTING TABLES ─────────────────────

ALTER TABLE templates ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- ─── 3. MAKE SETTINGS PER-USER (change PK to user_id) ──────

-- Drop old settings table and recreate as user-scoped
DROP TABLE IF EXISTS settings CASCADE;

CREATE TABLE settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
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

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ─── 4. DROP OLD RLS POLICIES ───────────────────────────────

DROP POLICY IF EXISTS "allow_all_templates" ON templates;
DROP POLICY IF EXISTS "allow_all_applications" ON applications;
DROP POLICY IF EXISTS "allow_all_documents" ON documents;
DROP POLICY IF EXISTS "allow_all_settings" ON settings;

-- ─── 5. NEW USER-SCOPED RLS POLICIES ───────────────────────

-- Templates: users can only see/modify their own
CREATE POLICY "users_crud_own_templates" ON templates
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Applications: users can only see/modify their own
CREATE POLICY "users_crud_own_applications" ON applications
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Documents: users can only see/modify their own
CREATE POLICY "users_crud_own_documents" ON documents
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Settings: users can only see/modify their own
CREATE POLICY "users_crud_own_settings" ON settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── 6. STORAGE POLICIES (user-scoped) ─────────────────────

DROP POLICY IF EXISTS "allow_all_storage" ON storage.objects;

CREATE POLICY "users_crud_own_documents_storage" ON storage.objects
  FOR ALL USING (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  ) WITH CHECK (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─── 7. INDEXES ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- ─── 8. AUTO-CREATE PROFILE + SETTINGS ON SIGNUP ────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );

  INSERT INTO public.settings (
    user_id, follow_ups_enabled, scheduling_enabled, reply_polling_enabled,
    follow_up_interval_minutes, scheduling_interval_minutes, reply_polling_interval_minutes, follow_up_days
  )
  VALUES (NEW.id, true, true, true, 60, 360, 5, 4);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 9. TRACK OPEN NEEDS PUBLIC ACCESS (no auth) ───────────
-- The tracking pixel is loaded in recipient's email client,
-- so we need a service_role or public access for that one route.
-- We handle this in the API route using the service role client.
