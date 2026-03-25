-- ── Migration 011: Proposal-linked chat rooms (Interview phase) ───────────────
-- Allows a chat room to be created for a proposal BEFORE it is accepted,
-- enabling clients to "interview" multiple freelancers.

-- 1. Add proposal_id column
ALTER TABLE chat_rooms
  ADD COLUMN IF NOT EXISTS proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE;

-- 2. Unique: one chat room per proposal
ALTER TABLE chat_rooms
  DROP CONSTRAINT IF EXISTS chat_rooms_proposal_unique;
ALTER TABLE chat_rooms
  ADD CONSTRAINT chat_rooms_proposal_unique UNIQUE (proposal_id);

-- 3. Relax the context check to allow proposal_id as a valid context
ALTER TABLE chat_rooms
  DROP CONSTRAINT IF EXISTS chat_rooms_context_check;
ALTER TABLE chat_rooms
  ADD CONSTRAINT chat_rooms_context_check CHECK (
    (order_id IS NOT NULL AND contract_id IS NULL AND proposal_id IS NULL) OR
    (contract_id IS NOT NULL AND order_id IS NULL AND proposal_id IS NULL) OR
    (proposal_id IS NOT NULL AND order_id IS NULL AND contract_id IS NULL)
  );

-- 4. Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_chat_rooms_proposal_id ON chat_rooms (proposal_id);
