-- ============================================================
-- ContractIQ — Supabase Schema
-- Paste this entire file into the Supabase SQL Editor and run.
-- Tested against a fresh Supabase project (no prior tables).
-- ============================================================


-- ============================================================
-- EXTENSIONS
-- ============================================================

-- UUID generation (gen_random_uuid is available by default in Supabase)
-- No additional extensions required for MVP.


-- ============================================================
-- TABLE: contracts
-- One row per uploaded contract.
-- contract_text is stored at upload time; AI pipeline reads from here.
-- file_path is null if Storage upload failed (non-blocking).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contracts (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_name     text          NOT NULL,
  contract_type     text          NOT NULL CHECK (contract_type IN ('nda', 'msa')),
  contract_text     text          NOT NULL,
  file_path         text,                        -- null if Storage upload failed
  status            text          NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'processing', 'complete', 'error')),
  page_count        integer       NOT NULL,
  token_count       integer,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  last_accessed_at  timestamptz
);

CREATE INDEX IF NOT EXISTS contracts_user_id_idx ON public.contracts (user_id);
CREATE INDEX IF NOT EXISTS contracts_created_at_idx ON public.contracts (created_at DESC);


-- ============================================================
-- TABLE: key_terms
-- One row per extracted (or custom) key term per contract.
-- ai_value is immutable — stores the original AI extraction forever.
-- value is the current value (may be user-edited).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.key_terms (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id       uuid          NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id           uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  term_name         text          NOT NULL,
  value             text          NOT NULL,
  ai_value          text          NOT NULL,      -- immutable original AI value
  page_number       integer       NOT NULL CHECK (page_number >= 1),
  confidence_score  float         NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  source_sentence   text          NOT NULL DEFAULT '',
  is_manual         boolean       NOT NULL DEFAULT false,
  is_edited         boolean       NOT NULL DEFAULT false,
  sort_order        integer,
  created_at        timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS key_terms_contract_id_idx ON public.key_terms (contract_id);
CREATE INDEX IF NOT EXISTS key_terms_user_id_idx ON public.key_terms (user_id);


-- ============================================================
-- TABLE: chat_sessions
-- One session per contract per user.
-- Created lazily on first chat message for a contract.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id   uuid          NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id       uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_sessions_contract_id_idx ON public.chat_sessions (contract_id);
CREATE INDEX IF NOT EXISTS chat_sessions_user_id_idx ON public.chat_sessions (user_id);


-- ============================================================
-- TABLE: chat_messages
-- All user and assistant messages for a chat session.
-- Ordered by created_at ASC to reconstruct conversation history.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid          NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  user_id     uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text          NOT NULL CHECK (role IN ('user', 'assistant')),
  content     text          NOT NULL,
  created_at  timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_session_id_idx ON public.chat_messages (session_id);
CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON public.chat_messages (created_at ASC);


-- ============================================================
-- TABLE: user_feedback
-- Thumbs-up / thumbs-down per contract review + optional comment.
-- Multiple submissions per contract are allowed.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_feedback (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id  uuid          NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id      uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating       text          NOT NULL CHECK (rating IN ('up', 'down')),
  comment      text          CHECK (length(comment) <= 500),
  created_at   timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_feedback_contract_id_idx ON public.user_feedback (contract_id);
CREATE INDEX IF NOT EXISTS user_feedback_user_id_idx ON public.user_feedback (user_id);


-- ============================================================
-- ROW LEVEL SECURITY
-- All tables: users can only access rows where user_id = auth.uid()
-- ============================================================

-- contracts
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

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


-- key_terms
ALTER TABLE public.key_terms ENABLE ROW LEVEL SECURITY;

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


-- chat_sessions
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their own chat sessions"
  ON public.chat_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat sessions"
  ON public.chat_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat sessions"
  ON public.chat_sessions FOR DELETE
  USING (auth.uid() = user_id);


-- chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their own chat messages"
  ON public.chat_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- user_feedback
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their own feedback"
  ON public.user_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feedback"
  ON public.user_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- SUPABASE STORAGE — BUCKET & POLICIES
-- Bucket: contracts (private)
-- Path pattern: contracts/{user_id}/{contract_id}/{filename}.pdf
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contracts',
  'contracts',
  false,
  10485760,        -- 10 MB in bytes
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;


-- Storage RLS: users can only access files in their own folder (first path segment = user_id)

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
-- HELPER VIEW: term_corrections
-- Used to monitor AI correction rate for prompt improvement.
-- Alert threshold: correction rate > 12% in any 7-day window.
-- ============================================================

CREATE OR REPLACE VIEW public.term_corrections AS
SELECT
  c.user_id,
  c.contract_type,
  kt.contract_id,
  COUNT(*) FILTER (WHERE kt.is_edited = true)   AS corrected_terms,
  COUNT(*)                                        AS total_terms,
  ROUND(
    (COUNT(*) FILTER (WHERE kt.is_edited = true))::numeric / NULLIF(COUNT(*), 0) * 100,
    2
  )                                               AS correction_rate_pct,
  DATE_TRUNC('day', kt.created_at)               AS extraction_date
FROM public.key_terms kt
JOIN public.contracts c ON c.id = kt.contract_id
GROUP BY c.user_id, c.contract_type, kt.contract_id, DATE_TRUNC('day', kt.created_at);
