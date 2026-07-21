-- ============================================================
-- ContractIQ — Security RLS Policies + Rate Limiting Table
-- Version: 1.0.0
--
-- HOW TO USE:
--   1. Open your Supabase project → SQL Editor
--   2. Paste this entire file and click Run
--   3. This script is idempotent — safe to re-run
--
-- This file supplements database.sql.
-- Run database.sql first to create the base tables.
-- ============================================================


-- ============================================================
-- SECTION 1: RATE LIMITING TABLE
--
-- Used by lib/security/rateLimiter.ts.
-- Service role only — no user-facing RLS policies.
-- Clean up old events nightly with a pg_cron job:
--   DELETE FROM rate_limit_events WHERE created_at < now() - interval '7 days';
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action     text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_lookup
  ON public.rate_limit_events (user_id, action, created_at DESC);

ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

-- No user-facing policies — all reads and writes go through service role key.
-- The createSupabaseServiceClient() in lib/supabase.ts bypasses RLS.


-- ============================================================
-- SECTION 2: ENSURE RLS IS ENABLED ON ALL APP TABLES
-- (Idempotent — safe to run even if already enabled)
-- ============================================================

ALTER TABLE public.contracts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.key_terms       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feedback   ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- SECTION 3: CONTRACTS RLS
-- ============================================================

DROP POLICY IF EXISTS "Users can select their own contracts"  ON public.contracts;
DROP POLICY IF EXISTS "Users can insert their own contracts"  ON public.contracts;
DROP POLICY IF EXISTS "Users can update their own contracts"  ON public.contracts;
DROP POLICY IF EXISTS "Users can delete their own contracts"  ON public.contracts;

CREATE POLICY "Users can select their own contracts"
  ON public.contracts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contracts"
  ON public.contracts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contracts"
  ON public.contracts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contracts"
  ON public.contracts FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================
-- SECTION 4: KEY TERMS RLS
-- ============================================================

DROP POLICY IF EXISTS "Users can select their own key terms"  ON public.key_terms;
DROP POLICY IF EXISTS "Users can insert their own key terms"  ON public.key_terms;
DROP POLICY IF EXISTS "Users can update their own key terms"  ON public.key_terms;
DROP POLICY IF EXISTS "Users can delete their own key terms"  ON public.key_terms;

CREATE POLICY "Users can select their own key terms"
  ON public.key_terms FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own key terms"
  ON public.key_terms FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own key terms"
  ON public.key_terms FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own key terms"
  ON public.key_terms FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================
-- SECTION 5: CHAT SESSIONS RLS
-- ============================================================

DROP POLICY IF EXISTS "Users can select their own chat sessions"  ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can insert their own chat sessions"  ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can delete their own chat sessions"  ON public.chat_sessions;

CREATE POLICY "Users can select their own chat sessions"
  ON public.chat_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat sessions"
  ON public.chat_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat sessions"
  ON public.chat_sessions FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================
-- SECTION 6: CHAT MESSAGES RLS
-- ============================================================

DROP POLICY IF EXISTS "Users can select their own chat messages"  ON public.chat_messages;
DROP POLICY IF EXISTS "Users can insert their own chat messages"  ON public.chat_messages;

CREATE POLICY "Users can select their own chat messages"
  ON public.chat_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- SECTION 7: USER FEEDBACK RLS
-- ============================================================

DROP POLICY IF EXISTS "Users can select their own feedback"  ON public.user_feedback;
DROP POLICY IF EXISTS "Users can insert their own feedback"  ON public.user_feedback;

CREATE POLICY "Users can select their own feedback"
  ON public.user_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feedback"
  ON public.user_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- SECTION 8: STORAGE RLS
-- (Idempotent — drops and recreates)
-- ============================================================

DROP POLICY IF EXISTS "Users can upload their own contract PDFs"  ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own contract PDFs"    ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own contract PDFs"  ON storage.objects;

CREATE POLICY "Users can upload their own contract PDFs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'contracts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can read their own contract PDFs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'contracts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own contract PDFs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'contracts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );


-- ============================================================
-- DONE
-- ============================================================
