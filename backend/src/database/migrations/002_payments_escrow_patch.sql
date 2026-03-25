-- ═══════════════════════════════════════════════════════════════
-- Migration 002 — Payments & Escrow enhancements
-- Applied automatically on first docker-compose up (after 001)
-- ═══════════════════════════════════════════════════════════════

-- ─── orders ──────────────────────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS stripe_session_id  TEXT,
  ADD COLUMN IF NOT EXISTS auto_completed      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS delivery_note       TEXT,
  ADD COLUMN IF NOT EXISTS delivery_urls       JSONB   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS delivered_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS commission_rate     NUMERIC(5,2) DEFAULT 10;

-- ─── milestones ──────────────────────────────────────────────────
ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS stripe_session_id  TEXT,
  ADD COLUMN IF NOT EXISTS delivery_note_en   TEXT,
  ADD COLUMN IF NOT EXISTS delivery_note_ar   TEXT,
  ADD COLUMN IF NOT EXISTS delivery_urls      JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS delivered_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by        UUID,
  ADD COLUMN IF NOT EXISTS approved_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revision_note      TEXT;

-- ─── escrow_accounts ─────────────────────────────────────────────
ALTER TABLE escrow_accounts
  ADD COLUMN IF NOT EXISTS disputed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_refund_id   TEXT;

-- Ensure status column covers all needed values
DO $$
BEGIN
  -- Add 'disputed' and 'refunded' if the escrow status type is an enum
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'escrow_status'
  ) THEN
    BEGIN
      ALTER TYPE escrow_status ADD VALUE IF NOT EXISTS 'disputed';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE escrow_status ADD VALUE IF NOT EXISTS 'refunded';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END$$;

-- ─── audit_logs — idempotency unique constraint ───────────────────
-- Used by PaymentsService.markEventProcessed() to deduplicate Stripe webhooks
CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_logs_stripe_event
  ON audit_logs (entity_type, entity_id, action)
  WHERE entity_type = 'stripe_event';

-- ─── wallets — ensure total_withdrawn column ─────────────────────
ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS total_withdrawn NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earned    NUMERIC(14,3) DEFAULT 0;

-- ─── profiles — ensure completed_orders column ───────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS completed_orders INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_spent      NUMERIC(14,3) DEFAULT 0;

-- ─── transactions — ensure all needed columns ────────────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL;
