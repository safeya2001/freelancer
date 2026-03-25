-- ═══════════════════════════════════════════════════════════════
-- Migration 005 — Local payment methods + Cash on delivery
-- Dopa Work: cash_on_delivery, payment_instructions for pending local payments
-- ═══════════════════════════════════════════════════════════════

-- Add cash_on_delivery to payment_method enum (PostgreSQL 9.1+ compatible)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'payment_method' AND e.enumlabel = 'cash_on_delivery'
  ) THEN
    ALTER TYPE payment_method ADD VALUE 'cash_on_delivery';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

-- Store payment instructions for client (e.g. CliQ alias, IBAN, phone) and reference
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS payment_instructions JSONB,
  ADD COLUMN IF NOT EXISTS reference_number       VARCHAR(100);

-- Index for pending local transactions (admin confirm list)
CREATE INDEX IF NOT EXISTS idx_transactions_status_pending
  ON transactions (status, created_at DESC)
  WHERE status = 'pending';
