-- ═══════════════════════════════════════════════════════════════
-- Migration 004 — Notification type additions & misc fixes
-- ═══════════════════════════════════════════════════════════════

-- Add missing notification_type enum values used in application code
DO $$
BEGIN
  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_failed';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_revision';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END$$;

-- Ensure refresh_tokens table exists (used for secure token rotation)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(64) NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  is_revoked  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- Ensure wallets exist for all users (created on demand normally, but ensure none are missing)
INSERT INTO wallets (user_id, balance, pending_balance)
SELECT u.id, 0, 0
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM wallets w WHERE w.user_id = u.id)
ON CONFLICT DO NOTHING;

-- Ensure chat_rooms table has needed columns
ALTER TABLE chat_rooms
  ADD COLUMN IF NOT EXISTS order_id     UUID REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contract_id  UUID REFERENCES contracts(id) ON DELETE SET NULL;

-- Ensure orders has commission_amount and freelancer_amount columns
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS commission_amount  NUMERIC(12,3),
  ADD COLUMN IF NOT EXISTS freelancer_amount  NUMERIC(12,3),
  ADD COLUMN IF NOT EXISTS started_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at       TIMESTAMPTZ;

-- Backfill commission_amount and freelancer_amount for existing orders
UPDATE orders
SET
  commission_amount = ROUND(price * 0.10, 3),
  freelancer_amount = ROUND(price * 0.90, 3)
WHERE commission_amount IS NULL AND price IS NOT NULL;
