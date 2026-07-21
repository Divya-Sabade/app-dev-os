-- ============================================================
-- ContractIQ — Production Database Schema
-- Version: 1.0.0
-- Last updated: 2026-07-16
--
-- HOW TO USE:
--   1. Open your Supabase project → SQL Editor
--   2. Paste this entire file and click Run
--   3. This script is idempotent — safe to re-run on an existing DB
--
-- WHAT THIS SETS UP:
--   - 5 tables: contracts, key_terms, chat_sessions,
--               chat_messages, user_feedback
--   - Indexes for all common query patterns
--   - Row Level Security (RLS) on every table
--   - Supabase Storage bucket: contracts (private, PDF-only, 10 MB limit)
--   - Storage RLS: users access only their own files
--   - Helper view: term_corrections (AI correction rate monitoring)
-- ============================================================


-- ============================================================
-- SECTION 1: TABLES
-- Order matters — parent tables before child tables.
-- ============================================================


-- ------------------------------------------------------------
-- TABLE: contracts
--
-- One row per uploaded contract file.
-- contract_text is extracted at upload time (pdf-parse).
-- All downstream AI and chat operations read from this column.
-- file_path is null when Supabase Storage upload fails
-- (non-blocking failure — AI pipeline is unaffected).
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.contracts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_name    text        NOT NULL CHECK (length(contract_name) <= 255),
  contract_type    text        NOT NULL CHECK (contract_type IN ('nda', 'msa')),
  contract_text    text        NOT NULL,
  file_path        text,
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'processing', 'complete', 'error')),
  page_count       integer     NOT NULL CHECK (page_count >= 1),
  token_count      integer     CHECK (token_count >= 0),
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_accessed_at timestamptz
);

-- Single-column indexes
CREATE INDEX IF NOT EXISTS contracts_user_id_idx
  ON public.contracts (user_id);

-- Composite index for the dashboard query:
-- WHERE user_id = $1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS contracts_user_created_idx
  ON public.contracts (user_id, created_at DESC);

-- Composite index for sorting by name on the dashboard
CREATE INDEX IF NOT EXISTS contracts_user_name_idx
  ON public.contracts (user_id, contract_name);

-- Composite index for sorting by type on the dashboard
CREATE INDEX IF NOT EXISTS contracts_user_type_idx
  ON public.contracts (user_id, contract_type);


-- ------------------------------------------------------------
-- TABLE: key_terms
--
-- One row per extracted (or custom) key term per contract.
-- ai_value is immutable: stores the original AI extraction.
-- value is the current user-facing value (may be edited).
-- is_manual = true for user-supplied custom terms.
-- is_edited = true when user has changed value from ai_value.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.key_terms (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id      uuid        NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  term_name        text        NOT NULL CHECK (length(term_name) <= 120),
  value            text        NOT NULL,
  ai_value         text        NOT NULL,
  page_number      integer     NOT NULL CHECK (page_number >= 1),
  confidence_score float       NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  source_sentence  text        NOT NULL DEFAULT '',
  is_manual        boolean     NOT NULL DEFAULT false,
  is_edited        boolean     NOT NULL DEFAULT false,
  sort_order       integer,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Primary lookup: all terms for a contract, in display order
CREATE INDEX IF NOT EXISTS key_terms_contract_id_idx
  ON public.key_terms (contract_id);

CREATE INDEX IF NOT EXISTS key_terms_contract_sort_idx
  ON public.key_terms (contract_id, sort_order ASC NULLS LAST);

CREATE INDEX IF NOT EXISTS key_terms_user_id_idx
  ON public.key_terms (user_id);

-- Supports correction rate monitoring view
CREATE INDEX IF NOT EXISTS key_terms_is_edited_idx
  ON public.key_terms (contract_id, is_edited)
  WHERE is_edited = true;


-- ------------------------------------------------------------
-- TABLE: chat_sessions
--
-- One session per contract per user (enforced via UNIQUE).
-- Created lazily when the user sends their first chat message.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id  uuid        NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),

  -- Enforce one session per user per contract
  CONSTRAINT chat_sessions_unique_per_contract UNIQUE (contract_id, user_id)
);

CREATE INDEX IF NOT EXISTS chat_sessions_contract_id_idx
  ON public.chat_sessions (contract_id);

CREATE INDEX IF NOT EXISTS chat_sessions_user_id_idx
  ON public.chat_sessions (user_id);


-- ------------------------------------------------------------
-- TABLE: chat_messages
--
-- All user + assistant messages for a session.
-- Up to 200 messages are loaded per session for context window.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid        NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('user', 'assistant')),
  content     text        NOT NULL CHECK (length(content) > 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Primary lookup: all messages for a session in chronological order
CREATE INDEX IF NOT EXISTS chat_messages_session_id_idx
  ON public.chat_messages (session_id);

CREATE INDEX IF NOT EXISTS chat_messages_session_created_idx
  ON public.chat_messages (session_id, created_at ASC);

CREATE INDEX IF NOT EXISTS chat_messages_user_id_idx
  ON public.chat_messages (user_id);


-- ------------------------------------------------------------
-- TABLE: user_feedback
--
-- Thumbs-up / thumbs-down per contract review + optional comment.
-- Multiple submissions per contract are permitted.
-- comment is validated at the application layer (≤ 500 chars).
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_feedback (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id  uuid        NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating       text        NOT NULL CHECK (rating IN ('up', 'down')),
  comment      text        CHECK (comment IS NULL OR length(comment) <= 500),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_feedback_contract_id_idx
  ON public.user_feedback (contract_id);

CREATE INDEX IF NOT EXISTS user_feedback_user_id_idx
  ON public.user_feedback (user_id);


-- ============================================================
-- SECTION 2: ROW LEVEL SECURITY (RLS)
--
-- Every table is locked down to the authenticated user.
-- auth.uid() matches the user_id column on every row.
-- Service role key (used in API routes) bypasses RLS.
-- ============================================================


-- ------------------------------------------------------------
-- RLS: contracts
-- ------------------------------------------------------------

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

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


-- ------------------------------------------------------------
-- RLS: key_terms
-- ------------------------------------------------------------

ALTER TABLE public.key_terms ENABLE ROW LEVEL SECURITY;

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


-- ------------------------------------------------------------
-- RLS: chat_sessions
-- ------------------------------------------------------------

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

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


-- ------------------------------------------------------------
-- RLS: chat_messages
-- ------------------------------------------------------------

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select their own chat messages"  ON public.chat_messages;
DROP POLICY IF EXISTS "Users can insert their own chat messages"  ON public.chat_messages;

CREATE POLICY "Users can select their own chat messages"
  ON public.chat_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ------------------------------------------------------------
-- RLS: user_feedback
-- ------------------------------------------------------------

ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select their own feedback"  ON public.user_feedback;
DROP POLICY IF EXISTS "Users can insert their own feedback"  ON public.user_feedback;

CREATE POLICY "Users can select their own feedback"
  ON public.user_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feedback"
  ON public.user_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- SECTION 3: SUPABASE STORAGE
--
-- Bucket: contracts (private)
-- Path:   contracts/{user_id}/{contract_id}/{filename}.pdf
--
-- Storage RLS uses the first path segment to scope access:
-- (storage.foldername(name))[1] = auth.uid()::text
-- This means each user can only read/write/delete files
-- whose path starts with their own user ID.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contracts',
  'contracts',
  false,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;


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
-- SECTION 4: HELPER VIEW
--
-- term_corrections: monitors AI correction rate per contract.
-- Alert threshold (from engineering doc): > 12% corrections
-- in any 7-day rolling window signals prompt drift.
-- ============================================================

CREATE OR REPLACE VIEW public.term_corrections AS
SELECT
  c.user_id,
  c.contract_type,
  kt.contract_id,
  COUNT(*)                                              AS total_terms,
  COUNT(*) FILTER (WHERE kt.is_edited = true)          AS corrected_terms,
  ROUND(
    COUNT(*) FILTER (WHERE kt.is_edited = true)::numeric
      / NULLIF(COUNT(*), 0) * 100,
    2
  )                                                     AS correction_rate_pct,
  DATE_TRUNC('day', kt.created_at)                     AS extraction_date
FROM public.key_terms kt
JOIN public.contracts c ON c.id = kt.contract_id
GROUP BY
  c.user_id,
  c.contract_type,
  kt.contract_id,
  DATE_TRUNC('day', kt.created_at);


-- ============================================================
-- DONE
--
-- Verify with:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public';
--
-- Expected tables: contracts, key_terms, chat_sessions,
--                  chat_messages, user_feedback
-- ============================================================
