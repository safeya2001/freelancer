-- ═══════════════════════════════════════════════════════════════
-- Migration 006 — Withdrawal: transfer confirmation (screenshot/PDF)
-- Dopa Work: admin uploads proof after processing
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE withdrawals
  ADD COLUMN IF NOT EXISTS transfer_confirmation_url VARCHAR(500);
