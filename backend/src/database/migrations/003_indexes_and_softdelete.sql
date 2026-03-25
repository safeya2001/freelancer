-- ============================================================
-- Migration 003 — Performance indexes & soft-delete columns
-- ============================================================

-- ── Orders ────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status
    ON orders (status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_client_id
    ON orders (client_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_freelancer_id
    ON orders (freelancer_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_delivered_at
    ON orders (delivered_at)
    WHERE delivered_at IS NOT NULL;

-- ── Escrow accounts ──────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_escrow_status
    ON escrow_accounts (status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_escrow_order_id
    ON escrow_accounts (order_id)
    WHERE order_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_escrow_milestone_id
    ON escrow_accounts (milestone_id)
    WHERE milestone_id IS NOT NULL;

-- ── Withdrawals ──────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_withdrawals_status
    ON withdrawals (status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_withdrawals_freelancer_status
    ON withdrawals (freelancer_id, status);

-- ── Disputes ─────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_disputes_status
    ON disputes (status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_disputes_client_id
    ON disputes (client_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_disputes_freelancer_id
    ON disputes (freelancer_id);

-- ── Transactions ─────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_created
    ON transactions (from_user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_type_status
    ON transactions (type, status);

-- ── Gigs ─────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gigs_freelancer_status
    ON gigs (freelancer_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gigs_category
    ON gigs (category_id, status);

-- ── Proposals ────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_proposals_project_status
    ON proposals (project_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_proposals_freelancer
    ON proposals (freelancer_id);

-- ── Notifications ────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_read
    ON notifications (user_id, is_read, created_at DESC);

-- ── Messages ─────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_room
    ON messages (room_id, created_at ASC);

-- ── Reviews ──────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_reviewee
    ON reviews (reviewee_id);

-- ── Soft-delete support ──────────────────────────────────────
-- Add deleted_at where it may be missing (safe — no-ops if column exists)
DO $$ BEGIN
    ALTER TABLE orders       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE transactions  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE disputes      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE gigs          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE proposals     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE contracts     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
END $$;

-- Partial indexes to exclude soft-deleted rows from common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_active
    ON orders (client_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gigs_active
    ON gigs (category_id, created_at DESC)
    WHERE deleted_at IS NULL AND status = 'active';
