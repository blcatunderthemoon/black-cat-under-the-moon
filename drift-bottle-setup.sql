-- =============================================================================
-- 月光漂流瓶 (Moonlight Drift Bottle) — Supabase Schema Setup
-- Run this in Supabase Dashboard → SQL Editor
-- =============================================================================

-- 1. bottles table
CREATE TABLE IF NOT EXISTS bottles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  view_key     TEXT        NOT NULL,
  content      TEXT        NOT NULL,
  mood_tag     TEXT,
  user_id      TEXT,
  report_count INT4        NOT NULL DEFAULT 0,
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_bottles_view_key ON bottles(view_key);
CREATE INDEX        IF NOT EXISTS idx_bottles_active   ON bottles(is_active) WHERE is_active = TRUE;

-- 3. replies table
CREATE TABLE IF NOT EXISTS replies (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bottle_id       UUID        NOT NULL REFERENCES bottles(id) ON DELETE CASCADE,
  parent_reply_id UUID        REFERENCES replies(id) ON DELETE CASCADE,
  user_id         TEXT        NOT NULL,
  content         TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- No UNIQUE(bottle_id, user_id) — multi-comment allowed; cooldown enforced by API
);

CREATE INDEX IF NOT EXISTS idx_replies_bottle_id ON replies(bottle_id);
CREATE INDEX IF NOT EXISTS idx_replies_parent    ON replies(parent_reply_id);

-- =============================================================================
-- Migration (run once on existing DB):
-- ALTER TABLE replies ADD COLUMN IF NOT EXISTS parent_reply_id UUID REFERENCES replies(id) ON DELETE CASCADE;
-- CREATE INDEX IF NOT EXISTS idx_replies_parent ON replies(parent_reply_id);
-- ALTER TABLE replies DROP CONSTRAINT IF EXISTS replies_bottle_id_user_id_key;
-- =============================================================================

-- 4. RPC: get_random_bottle() — picks one random active bottle
CREATE OR REPLACE FUNCTION get_random_bottle()
RETURNS SETOF bottles
LANGUAGE sql STABLE
AS $$
  SELECT * FROM bottles
  WHERE is_active = TRUE
  ORDER BY RANDOM()
  LIMIT 1;
$$;

-- 5. RPC: increment_report(p_bottle_id) — increments report count; auto-hides at 5
--    Uses SECURITY DEFINER so the anon key can call it without needing UPDATE permission
CREATE OR REPLACE FUNCTION increment_report(p_bottle_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE bottles
  SET
    report_count = report_count + 1,
    is_active    = CASE WHEN report_count + 1 >= 5 THEN FALSE ELSE is_active END
  WHERE id = p_bottle_id;
END;
$$;

-- =============================================================================
-- Row Level Security (RLS) — optional but recommended
-- If you enable RLS, add these policies so the anon key can read/write
-- =============================================================================

-- ALTER TABLE bottles ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "anon_insert_bottles" ON bottles FOR INSERT TO anon WITH CHECK (true);
-- CREATE POLICY "anon_select_bottles" ON bottles FOR SELECT TO anon USING (is_active = true);

-- ALTER TABLE replies ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "anon_insert_replies" ON replies FOR INSERT TO anon WITH CHECK (true);
-- CREATE POLICY "anon_select_replies" ON replies FOR SELECT TO anon USING (true);

-- =============================================================================
-- Phase 6: Bottle Lifecycle Migration
-- Soft-expiry: bottles are hidden after 30 days but NEVER deleted from the DB.
-- Filtering is done via WHERE expires_at > NOW() — no DELETE is ever executed.
-- =============================================================================

ALTER TABLE bottles
  ADD COLUMN IF NOT EXISTS expires_at      TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  ADD COLUMN IF NOT EXISTS bottle_type     TEXT        NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS exposure_count  INT         NOT NULL DEFAULT 0;

-- Backfill existing rows
UPDATE bottles
SET expires_at = created_at + INTERVAL '30 days'
WHERE expires_at IS NULL;

-- Index for expiry-aware queries
CREATE INDEX IF NOT EXISTS idx_bottles_expires
  ON bottles(expires_at)
  WHERE is_active = TRUE;

-- Update get_random_bottle() to exclude expired bottles
CREATE OR REPLACE FUNCTION get_random_bottle()
RETURNS SETOF bottles
LANGUAGE sql STABLE
AS $$
  SELECT * FROM bottles
  WHERE is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY RANDOM()
  LIMIT 1;
$$;

-- Moonlight upgrade trigger: auto-promote to 'moonlight' after 5 replies
CREATE OR REPLACE FUNCTION promote_to_moonlight()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE bottles
  SET bottle_type = 'moonlight'
  WHERE id = NEW.bottle_id
    AND bottle_type = 'normal'
    AND (SELECT COUNT(*) FROM replies WHERE bottle_id = NEW.bottle_id) >= 5;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_moonlight ON replies;
CREATE TRIGGER trg_promote_moonlight
  AFTER INSERT ON replies
  FOR EACH ROW EXECUTE FUNCTION promote_to_moonlight();

-- =============================================================================
-- Phase 7: Weighted Random RPC + Exposure Tracking
-- Score formula:
--   (0.5 * e^(-age/7d)  +  0.3 * 1/(1+exposure)  +  0.2 * min(replies/10, 0.3))
--   * (0.7 + rand * 0.6)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_weighted_bottle()
RETURNS SETOF bottles
LANGUAGE sql STABLE
AS $$
  SELECT (b).*
  FROM (
    SELECT b,
      (
        0.5 * EXP(-EXTRACT(EPOCH FROM (NOW() - b.created_at)) / 604800.0)
        + 0.3 * (1.0 / (1.0 + b.exposure_count))
        + 0.2 * LEAST(
            (SELECT COUNT(*) FROM replies r WHERE r.bottle_id = b.id)::float / 10.0,
            0.3
          )
      ) * (0.7 + RANDOM() * 0.6) AS score
    FROM bottles b
    WHERE b.is_active = TRUE
      AND (b.expires_at IS NULL OR b.expires_at > NOW())
  ) ranked
  ORDER BY ranked.score DESC
  LIMIT 1;
$$;

-- =============================================================================
-- Phase 8: Mission Bottle (召集貓隊友) Schema
-- =============================================================================

ALTER TABLE bottles
  ADD COLUMN IF NOT EXISTS tags              TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_mission_bottle BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for fast mission bottle filtering
CREATE INDEX IF NOT EXISTS idx_bottles_mission
  ON bottles(is_mission_bottle)
  WHERE is_mission_bottle = TRUE AND is_active = TRUE;

-- =============================================================================
-- Protection System: Reply Reporting + Moderation
-- =============================================================================

-- Add report tracking columns to replies
ALTER TABLE replies
  ADD COLUMN IF NOT EXISTS report_count INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_hidden    BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_replies_hidden ON replies(is_hidden) WHERE is_hidden = FALSE;

-- Update increment_report threshold: auto-hide bottles at 3 reports (was 5)
CREATE OR REPLACE FUNCTION increment_report(p_bottle_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE bottles
  SET
    report_count = report_count + 1,
    is_active    = CASE WHEN report_count + 1 >= 3 THEN FALSE ELSE is_active END
  WHERE id = p_bottle_id;
END;
$$;

-- New RPC: increment_reply_report — auto-hides a reply at 3 reports
CREATE OR REPLACE FUNCTION increment_reply_report(p_reply_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE replies
  SET
    report_count = report_count + 1,
    is_hidden    = CASE WHEN report_count + 1 >= 3 THEN TRUE ELSE is_hidden END
  WHERE id = p_reply_id;
END;
$$;
