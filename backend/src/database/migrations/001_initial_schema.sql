-- =============================================================
-- FREELANCE PLATFORM — COMPLETE DATABASE SCHEMA
-- PostgreSQL
-- Bilingual (Arabic/English) | JOD Currency | Jordan Market
-- =============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- trigram index for search
CREATE EXTENSION IF NOT EXISTS "unaccent";       -- accent-insensitive search

-- =============================================================
-- ENUMS
-- =============================================================

CREATE TYPE user_role AS ENUM ('client', 'freelancer', 'admin', 'super_admin', 'finance_admin', 'support_admin');
CREATE TYPE user_status AS ENUM ('pending', 'active', 'suspended', 'banned');
CREATE TYPE verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');
CREATE TYPE language AS ENUM ('en', 'ar');
CREATE TYPE jordan_city AS ENUM ('amman', 'irbid', 'zarqa', 'aqaba', 'madaba', 'salt', 'karak', 'jerash', 'other');

CREATE TYPE project_budget_type AS ENUM ('fixed', 'hourly');
CREATE TYPE project_status AS ENUM ('open', 'in_progress', 'completed', 'cancelled', 'closed');

CREATE TYPE proposal_status AS ENUM ('pending', 'accepted', 'rejected', 'withdrawn');

CREATE TYPE gig_status AS ENUM ('active', 'paused', 'deleted');
CREATE TYPE gig_package_type AS ENUM ('basic', 'standard', 'premium');

CREATE TYPE order_status AS ENUM ('pending', 'in_progress', 'delivered', 'revision_requested', 'completed', 'cancelled', 'disputed');
CREATE TYPE contract_status AS ENUM ('active', 'completed', 'cancelled', 'disputed');

CREATE TYPE milestone_status AS ENUM ('pending', 'in_progress', 'submitted', 'approved', 'revision_requested', 'disputed');

CREATE TYPE payment_method AS ENUM ('stripe', 'bank_transfer', 'cliq', 'zain_cash', 'orange_money');
CREATE TYPE transaction_type AS ENUM ('deposit', 'release', 'refund', 'commission', 'withdrawal');
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

CREATE TYPE escrow_status AS ENUM ('funded', 'released', 'refunded', 'disputed');

CREATE TYPE withdrawal_status AS ENUM ('pending', 'approved', 'processing', 'completed', 'rejected');

CREATE TYPE notification_type AS ENUM (
  'proposal_received', 'proposal_accepted', 'proposal_rejected',
  'order_placed', 'order_delivered', 'order_completed', 'order_cancelled',
  'milestone_submitted', 'milestone_approved', 'milestone_revision',
  'payment_received', 'payment_released', 'withdrawal_processed',
  'message_received', 'dispute_opened', 'dispute_resolved',
  'review_received', 'ticket_updated', 'identity_verified', 'identity_rejected'
);

CREATE TYPE dispute_status AS ENUM ('open', 'under_review', 'resolved_client', 'resolved_freelancer', 'closed');
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- =============================================================
-- CATEGORIES
-- =============================================================

CREATE TABLE categories (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_en       VARCHAR(100) NOT NULL,
  name_ar       VARCHAR(100) NOT NULL,
  slug          VARCHAR(120) UNIQUE NOT NULL,
  description_en TEXT,
  description_ar TEXT,
  icon          VARCHAR(100),
  parent_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
  is_active     BOOLEAN DEFAULT TRUE,
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- SKILLS
-- =============================================================

CREATE TABLE skills (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_en   VARCHAR(100) NOT NULL,
  name_ar   VARCHAR(100) NOT NULL,
  slug      VARCHAR(120) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- USERS
-- =============================================================

CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email             VARCHAR(255) UNIQUE NOT NULL,
  phone             VARCHAR(20),                           -- +962xxxxxxxxx
  password_hash     VARCHAR(255),                          -- nullable for OAuth users
  role              user_role NOT NULL DEFAULT 'client',
  status            user_status NOT NULL DEFAULT 'pending',
  preferred_language language DEFAULT 'ar',

  -- OAuth
  google_id         VARCHAR(255) UNIQUE,

  -- Verification flags
  email_verified    BOOLEAN DEFAULT FALSE,
  phone_verified    BOOLEAN DEFAULT FALSE,
  email_verify_token VARCHAR(255),
  email_verify_expires TIMESTAMPTZ,
  phone_otp         VARCHAR(10),
  phone_otp_expires TIMESTAMPTZ,

  -- Password reset
  reset_password_token VARCHAR(255),
  reset_password_expires TIMESTAMPTZ,

  -- Timestamps
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- =============================================================
-- PROFILES (shared client + freelancer base)
-- =============================================================

CREATE TABLE profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Personal info
  full_name_en    VARCHAR(200) NOT NULL,
  full_name_ar    VARCHAR(200),
  professional_title_en VARCHAR(200),
  professional_title_ar VARCHAR(200),
  bio_en          TEXT,
  bio_ar          TEXT,
  avatar_url      VARCHAR(500),

  -- Location
  city            jordan_city DEFAULT 'amman',
  address         VARCHAR(500),

  -- Client-specific
  company_name    VARCHAR(200),

  -- Freelancer-specific
  hourly_rate     DECIMAL(10,3),                           -- JOD
  availability    BOOLEAN DEFAULT TRUE,
  identity_doc_url VARCHAR(500),
  identity_verified verification_status DEFAULT 'unverified',
  identity_verified_at TIMESTAMPTZ,
  identity_verified_by UUID REFERENCES users(id),

  -- Stats (denormalized for performance)
  total_earned    DECIMAL(12,3) DEFAULT 0,
  total_spent     DECIMAL(12,3) DEFAULT 0,
  total_jobs_done INTEGER DEFAULT 0,
  total_orders    INTEGER DEFAULT 0,
  avg_rating      DECIMAL(3,2) DEFAULT 0,
  review_count    INTEGER DEFAULT 0,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_city ON profiles(city);
CREATE INDEX idx_profiles_hourly_rate ON profiles(hourly_rate);
CREATE INDEX idx_profiles_avg_rating ON profiles(avg_rating);

-- =============================================================
-- FREELANCER SKILLS
-- =============================================================

CREATE TABLE freelancer_skills (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id      UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  level         VARCHAR(20) DEFAULT 'intermediate',        -- beginner, intermediate, expert
  UNIQUE(user_id, skill_id)
);

-- =============================================================
-- PORTFOLIO ITEMS
-- =============================================================

CREATE TABLE portfolio_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_en    VARCHAR(300) NOT NULL,
  title_ar    VARCHAR(300),
  description_en TEXT,
  description_ar TEXT,
  project_url VARCHAR(500),
  image_urls  TEXT[],                                      -- array of image URLs
  pdf_url     VARCHAR(500),
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- EDUCATION
-- =============================================================

CREATE TABLE education (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institution  VARCHAR(300) NOT NULL,
  degree       VARCHAR(200),
  field        VARCHAR(200),
  start_year   INTEGER,
  end_year     INTEGER,
  description  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- CERTIFICATIONS
-- =============================================================

CREATE TABLE certifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(300) NOT NULL,
  issuing_org     VARCHAR(300),
  issue_date      DATE,
  expiry_date     DATE,
  credential_url  VARCHAR(500),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- GIGS (Fiverr-style)
-- =============================================================

CREATE TABLE gigs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  freelancer_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id     UUID NOT NULL REFERENCES categories(id),

  title_en        VARCHAR(300) NOT NULL,
  title_ar        VARCHAR(300),
  description_en  TEXT NOT NULL,
  description_ar  TEXT,
  slug            VARCHAR(400) UNIQUE,

  -- Base price (used when no packages)
  price           DECIMAL(10,3),                           -- JOD
  delivery_days   INTEGER NOT NULL DEFAULT 3,

  -- Gallery
  gallery_urls    TEXT[],
  video_url       VARCHAR(500),

  -- Requirements from buyer
  requirements_en TEXT,
  requirements_ar TEXT,

  status          gig_status DEFAULT 'active',

  -- Stats
  views_count     INTEGER DEFAULT 0,
  orders_count    INTEGER DEFAULT 0,
  avg_rating      DECIMAL(3,2) DEFAULT 0,
  review_count    INTEGER DEFAULT 0,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gigs_freelancer_id ON gigs(freelancer_id);
CREATE INDEX idx_gigs_category_id ON gigs(category_id);
CREATE INDEX idx_gigs_status ON gigs(status);
CREATE INDEX idx_gigs_price ON gigs(price);
CREATE INDEX idx_gigs_avg_rating ON gigs(avg_rating);
CREATE INDEX idx_gigs_title_search ON gigs USING gin(to_tsvector('english', title_en));

-- =============================================================
-- GIG PACKAGES
-- =============================================================

CREATE TABLE gig_packages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gig_id          UUID NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
  package_type    gig_package_type NOT NULL,
  name_en         VARCHAR(200) NOT NULL,
  name_ar         VARCHAR(200),
  description_en  TEXT,
  description_ar  TEXT,
  price           DECIMAL(10,3) NOT NULL,                  -- JOD
  delivery_days   INTEGER NOT NULL,
  revisions       INTEGER DEFAULT 1,
  features        JSONB,                                   -- [{label_en, label_ar, included}]
  UNIQUE(gig_id, package_type)
);

-- =============================================================
-- GIG SKILLS
-- =============================================================

CREATE TABLE gig_skills (
  gig_id   UUID NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (gig_id, skill_id)
);

-- =============================================================
-- PROJECTS (Upwork-style)
-- =============================================================

CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id     UUID REFERENCES categories(id),

  title_en        VARCHAR(300) NOT NULL,
  title_ar        VARCHAR(300),
  description_en  TEXT NOT NULL,
  description_ar  TEXT,

  budget_type     project_budget_type NOT NULL DEFAULT 'fixed',
  budget_min      DECIMAL(10,3),                           -- JOD
  budget_max      DECIMAL(10,3),                           -- JOD
  hourly_rate_min DECIMAL(10,3),                           -- JOD
  hourly_rate_max DECIMAL(10,3),                           -- JOD

  deadline        DATE,
  preferred_city  jordan_city,
  attachment_urls TEXT[],

  status          project_status DEFAULT 'open',

  -- Stats
  proposals_count INTEGER DEFAULT 0,
  views_count     INTEGER DEFAULT 0,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_client_id ON projects(client_id);
CREATE INDEX idx_projects_category_id ON projects(category_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_budget_type ON projects(budget_type);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX idx_projects_title_search ON projects USING gin(to_tsvector('english', title_en));

-- =============================================================
-- PROJECT SKILLS
-- =============================================================

CREATE TABLE project_skills (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  skill_id   UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, skill_id)
);

-- =============================================================
-- PROPOSALS
-- =============================================================

CREATE TABLE proposals (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  freelancer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  cover_letter_en   TEXT NOT NULL,
  cover_letter_ar   TEXT,
  proposed_budget   DECIMAL(10,3) NOT NULL,                -- JOD
  delivery_days     INTEGER NOT NULL,
  attachment_urls   TEXT[],

  status            proposal_status DEFAULT 'pending',

  -- Admin/client notes
  rejection_reason  TEXT,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(project_id, freelancer_id)
);

CREATE INDEX idx_proposals_project_id ON proposals(project_id);
CREATE INDEX idx_proposals_freelancer_id ON proposals(freelancer_id);
CREATE INDEX idx_proposals_status ON proposals(status);

-- =============================================================
-- CONTRACTS
-- =============================================================

CREATE TABLE contracts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  proposal_id     UUID REFERENCES proposals(id) ON DELETE SET NULL,
  client_id       UUID NOT NULL REFERENCES users(id),
  freelancer_id   UUID NOT NULL REFERENCES users(id),

  title_en        VARCHAR(300) NOT NULL,
  title_ar        VARCHAR(300),
  description_en  TEXT,

  total_amount    DECIMAL(12,3) NOT NULL,                  -- JOD
  commission_rate DECIMAL(5,2) DEFAULT 10.00,              -- %
  commission_amount DECIMAL(12,3),
  freelancer_amount DECIMAL(12,3),                         -- total - commission

  start_date      DATE,
  end_date        DATE,

  status          contract_status DEFAULT 'active',

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contracts_client_id ON contracts(client_id);
CREATE INDEX idx_contracts_freelancer_id ON contracts(freelancer_id);
CREATE INDEX idx_contracts_status ON contracts(status);

-- =============================================================
-- MILESTONES
-- =============================================================

CREATE TABLE milestones (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id     UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,

  title_en        VARCHAR(300) NOT NULL,
  title_ar        VARCHAR(300),
  description_en  TEXT,
  description_ar  TEXT,

  amount          DECIMAL(10,3) NOT NULL,                  -- JOD
  due_date        DATE,
  sort_order      INTEGER DEFAULT 0,

  status          milestone_status DEFAULT 'pending',

  -- Delivery
  delivery_note_en TEXT,
  delivery_note_ar TEXT,
  delivery_urls    TEXT[],
  delivered_at     TIMESTAMPTZ,

  -- Approval
  approved_at     TIMESTAMPTZ,
  approved_by     UUID REFERENCES users(id),

  -- Revision
  revision_note   TEXT,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_milestones_contract_id ON milestones(contract_id);
CREATE INDEX idx_milestones_status ON milestones(status);

-- =============================================================
-- ORDERS (Gig purchases)
-- =============================================================

CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gig_id          UUID NOT NULL REFERENCES gigs(id),
  package_id      UUID REFERENCES gig_packages(id),
  client_id       UUID NOT NULL REFERENCES users(id),
  freelancer_id   UUID NOT NULL REFERENCES users(id),

  -- Pricing snapshot at order time
  price           DECIMAL(10,3) NOT NULL,                  -- JOD
  commission_rate DECIMAL(5,2) DEFAULT 10.00,
  commission_amount DECIMAL(12,3),
  freelancer_amount DECIMAL(12,3),

  delivery_days   INTEGER NOT NULL,
  deadline        TIMESTAMPTZ,

  requirements    TEXT,                                    -- buyer's requirements text

  -- Delivery
  delivery_note   TEXT,
  delivery_urls   TEXT[],
  delivered_at    TIMESTAMPTZ,

  status          order_status DEFAULT 'pending',

  -- Timestamps
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  cancellation_reason TEXT,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_client_id ON orders(client_id);
CREATE INDEX idx_orders_freelancer_id ON orders(freelancer_id);
CREATE INDEX idx_orders_gig_id ON orders(gig_id);
CREATE INDEX idx_orders_status ON orders(status);

-- =============================================================
-- CHAT ROOMS
-- =============================================================

CREATE TABLE chat_rooms (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  contract_id   UUID UNIQUE REFERENCES contracts(id) ON DELETE CASCADE,
  client_id     UUID NOT NULL REFERENCES users(id),
  freelancer_id UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chat_rooms_context_check CHECK (
    (order_id IS NOT NULL AND contract_id IS NULL) OR
    (contract_id IS NOT NULL AND order_id IS NULL)
  )
);

CREATE INDEX idx_chat_rooms_order_id ON chat_rooms(order_id);
CREATE INDEX idx_chat_rooms_contract_id ON chat_rooms(contract_id);

-- =============================================================
-- MESSAGES
-- =============================================================

CREATE TABLE messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id     UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES users(id),

  body        TEXT,
  file_urls   TEXT[],
  file_names  TEXT[],

  -- Read receipts
  read_by     UUID[],                                      -- array of user_ids who read
  read_at     JSONB,                                       -- {user_id: timestamp}

  is_deleted  BOOLEAN DEFAULT FALSE,

  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_room_id ON messages(room_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- =============================================================
-- ESCROW ACCOUNTS
-- =============================================================

CREATE TABLE escrow_accounts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID UNIQUE REFERENCES orders(id) ON DELETE SET NULL,
  contract_id     UUID REFERENCES contracts(id) ON DELETE SET NULL,
  milestone_id    UUID REFERENCES milestones(id) ON DELETE SET NULL,

  client_id       UUID NOT NULL REFERENCES users(id),
  freelancer_id   UUID NOT NULL REFERENCES users(id),

  amount          DECIMAL(12,3) NOT NULL,                  -- JOD (gross)
  commission      DECIMAL(12,3) NOT NULL DEFAULT 0,
  net_amount      DECIMAL(12,3) NOT NULL,                  -- JOD (to freelancer)

  status          escrow_status DEFAULT 'funded',
  funded_at       TIMESTAMPTZ DEFAULT NOW(),
  released_at     TIMESTAMPTZ,
  refunded_at     TIMESTAMPTZ,

  -- Stripe ref
  stripe_payment_intent_id VARCHAR(255),

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_escrow_client_id ON escrow_accounts(client_id);
CREATE INDEX idx_escrow_freelancer_id ON escrow_accounts(freelancer_id);
CREATE INDEX idx_escrow_status ON escrow_accounts(status);

-- =============================================================
-- TRANSACTIONS
-- =============================================================

CREATE TABLE transactions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escrow_id               UUID REFERENCES escrow_accounts(id) ON DELETE SET NULL,
  order_id                UUID REFERENCES orders(id) ON DELETE SET NULL,
  contract_id             UUID REFERENCES contracts(id) ON DELETE SET NULL,
  milestone_id            UUID REFERENCES milestones(id) ON DELETE SET NULL,
  from_user_id            UUID REFERENCES users(id),
  to_user_id              UUID REFERENCES users(id),

  type                    transaction_type NOT NULL,
  amount                  DECIMAL(12,3) NOT NULL,          -- JOD
  currency                VARCHAR(10) DEFAULT 'JOD',
  status                  transaction_status DEFAULT 'pending',
  payment_method          payment_method DEFAULT 'stripe',

  -- Stripe data
  stripe_payment_intent_id VARCHAR(255),
  stripe_charge_id         VARCHAR(255),
  stripe_checkout_session  VARCHAR(255),

  description_en          TEXT,
  description_ar          TEXT,

  metadata                JSONB,

  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_from_user ON transactions(from_user_id);
CREATE INDEX idx_transactions_to_user ON transactions(to_user_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

-- =============================================================
-- FREELANCER WALLETS
-- =============================================================

CREATE TABLE wallets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance         DECIMAL(12,3) DEFAULT 0,                 -- JOD available
  pending_balance DECIMAL(12,3) DEFAULT 0,                 -- JOD in escrow
  total_earned    DECIMAL(12,3) DEFAULT 0,
  total_withdrawn DECIMAL(12,3) DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- WITHDRAWALS
-- =============================================================

CREATE TABLE withdrawals (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  freelancer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  amount            DECIMAL(12,3) NOT NULL,                -- JOD
  method            payment_method NOT NULL,

  -- Method-specific details (encrypted in production)
  bank_name         VARCHAR(200),
  bank_account      VARCHAR(100),
  bank_iban         VARCHAR(50),
  cliq_alias        VARCHAR(100),
  mobile_number     VARCHAR(20),

  status            withdrawal_status DEFAULT 'pending',

  -- Admin
  processed_by      UUID REFERENCES users(id),
  processed_at      TIMESTAMPTZ,
  rejection_reason  TEXT,
  reference_number  VARCHAR(200),
  notes             TEXT,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_withdrawals_freelancer_id ON withdrawals(freelancer_id);
CREATE INDEX idx_withdrawals_status ON withdrawals(status);

-- =============================================================
-- REVIEWS
-- =============================================================

CREATE TABLE reviews (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,
  contract_id     UUID REFERENCES contracts(id) ON DELETE SET NULL,
  reviewer_id     UUID NOT NULL REFERENCES users(id),
  reviewee_id     UUID NOT NULL REFERENCES users(id),

  overall_rating  INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  communication   INTEGER CHECK (communication BETWEEN 1 AND 5),
  quality         INTEGER CHECK (quality BETWEEN 1 AND 5),
  timeliness      INTEGER CHECK (timeliness BETWEEN 1 AND 5),

  comment_en      TEXT,
  comment_ar      TEXT,

  is_public       BOOLEAN DEFAULT TRUE,

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reviews_reviewee_id ON reviews(reviewee_id);
CREATE INDEX idx_reviews_reviewer_id ON reviews(reviewer_id);

-- =============================================================
-- NOTIFICATIONS
-- =============================================================

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  type        notification_type NOT NULL,
  title_en    VARCHAR(300),
  title_ar    VARCHAR(300),
  body_en     TEXT,
  body_ar     TEXT,

  -- Link target
  entity_type VARCHAR(50),                                 -- 'order', 'contract', etc.
  entity_id   UUID,

  is_read     BOOLEAN DEFAULT FALSE,
  read_at     TIMESTAMPTZ,

  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- =============================================================
-- DISPUTES
-- =============================================================

CREATE TABLE disputes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,
  contract_id     UUID REFERENCES contracts(id) ON DELETE SET NULL,
  milestone_id    UUID REFERENCES milestones(id) ON DELETE SET NULL,

  opened_by       UUID NOT NULL REFERENCES users(id),
  client_id       UUID NOT NULL REFERENCES users(id),
  freelancer_id   UUID NOT NULL REFERENCES users(id),
  assigned_admin  UUID REFERENCES users(id),

  title_en        VARCHAR(300) NOT NULL,
  title_ar        VARCHAR(300),
  description_en  TEXT NOT NULL,
  description_ar  TEXT,
  attachment_urls TEXT[],

  status          dispute_status DEFAULT 'open',
  resolution_note TEXT,
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID REFERENCES users(id),

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_disputes_status ON disputes(status);
CREATE INDEX idx_disputes_client_id ON disputes(client_id);
CREATE INDEX idx_disputes_freelancer_id ON disputes(freelancer_id);

-- =============================================================
-- SUPPORT TICKETS
-- =============================================================

CREATE TABLE support_tickets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_to     UUID REFERENCES users(id),

  subject_en      VARCHAR(300) NOT NULL,
  subject_ar      VARCHAR(300),
  body_en         TEXT NOT NULL,
  body_ar         TEXT,
  attachment_urls TEXT[],

  status          ticket_status DEFAULT 'open',
  priority        ticket_priority DEFAULT 'medium',

  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ticket_replies (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES users(id),
  body        TEXT NOT NULL,
  attachment_urls TEXT[],
  is_internal BOOLEAN DEFAULT FALSE,                       -- admin-only note
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tickets_user_id ON support_tickets(user_id);
CREATE INDEX idx_tickets_status ON support_tickets(status);

-- =============================================================
-- DOCUMENTS (Payment proofs, contracts PDFs)
-- =============================================================

CREATE TABLE documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type            VARCHAR(50) NOT NULL,                    -- 'payment_proof', 'contract'
  ref_id          UUID NOT NULL,                           -- order_id, transaction_id, etc.
  ref_type        VARCHAR(50) NOT NULL,
  generated_by    UUID REFERENCES users(id),

  title_en        VARCHAR(300),
  title_ar        VARCHAR(300),
  file_url        VARCHAR(500),
  doc_number      VARCHAR(50) UNIQUE,                      -- e.g. PAY-2024-001234

  metadata        JSONB,                                   -- custom fields for PDF

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_ref_id ON documents(ref_id);

-- =============================================================
-- REFRESH TOKENS (JWT rotation)
-- =============================================================

CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  is_revoked  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);

-- =============================================================
-- FILE UPLOADS (tracking)
-- =============================================================

CREATE TABLE file_uploads (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uploader_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_name   VARCHAR(300) NOT NULL,
  stored_name     VARCHAR(300) NOT NULL,
  url             VARCHAR(500) NOT NULL,
  mime_type       VARCHAR(100),
  size_bytes      BIGINT,
  entity_type     VARCHAR(50),                             -- 'message', 'project', etc.
  entity_id       UUID,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- ADMIN AUDIT LOG
-- =============================================================

CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID NOT NULL REFERENCES users(id),
  action      VARCHAR(200) NOT NULL,
  entity_type VARCHAR(100),
  entity_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- =============================================================
-- PLATFORM SETTINGS
-- =============================================================

CREATE TABLE platform_settings (
  key         VARCHAR(200) PRIMARY KEY,
  value       TEXT,
  description VARCHAR(500),
  updated_by  UUID REFERENCES users(id),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- SEED: CATEGORIES
-- =============================================================

INSERT INTO categories (name_en, name_ar, slug, icon) VALUES
  ('Web Development',   'تطوير الويب',           'web-development',  'code'),
  ('Graphic Design',    'التصميم الجرافيكي',     'graphic-design',   'palette'),
  ('Translation',       'الترجمة',               'translation',      'language'),
  ('Marketing',         'التسويق',               'marketing',        'megaphone'),
  ('Video Editing',     'مونتاج الفيديو',         'video-editing',    'video'),
  ('Content Writing',   'كتابة المحتوى',          'content-writing',  'pen'),
  ('Data Entry',        'إدخال البيانات',          'data-entry',       'database'),
  ('Mobile Apps',       'تطبيقات الموبايل',       'mobile-apps',      'mobile'),
  ('SEO',               'تحسين محركات البحث',     'seo',              'search'),
  ('Photography',       'التصوير الفوتوغرافي',    'photography',      'camera');

-- =============================================================
-- SEED: SKILLS
-- =============================================================

INSERT INTO skills (name_en, name_ar, slug) VALUES
  ('React',           'ريأكت',                'react'),
  ('Node.js',         'نود جي إس',             'nodejs'),
  ('PostgreSQL',      'بوستجريس',              'postgresql'),
  ('Figma',           'فيغما',                 'figma'),
  ('Adobe Photoshop', 'أدوبي فوتوشوب',         'photoshop'),
  ('Arabic Typing',   'الطباعة بالعربية',      'arabic-typing'),
  ('English Writing', 'الكتابة بالإنجليزية',   'english-writing'),
  ('SEO',             'تحسين محركات البحث',    'seo'),
  ('WordPress',       'ووردبريس',              'wordpress'),
  ('Python',          'بايثون',                'python'),
  ('Flutter',         'فلاتر',                 'flutter'),
  ('Adobe Premiere',  'أدوبي بريمير',          'premiere'),
  ('Excel',           'إكسيل',                 'excel'),
  ('Logo Design',     'تصميم الشعارات',        'logo-design'),
  ('Social Media',    'التواصل الاجتماعي',     'social-media');

-- =============================================================
-- SEED: PLATFORM SETTINGS
-- =============================================================

INSERT INTO platform_settings (key, value, description) VALUES
  ('commission_rate',        '10',           'Platform commission percentage'),
  ('min_withdrawal',         '20',           'Minimum withdrawal amount in JOD'),
  ('max_file_size_mb',       '25',           'Max file upload size in MB'),
  ('allowed_file_types',     'jpg,jpeg,png,gif,pdf,doc,docx,zip,mp4', 'Allowed upload extensions'),
  ('payment_currency',       'JOD',          'Platform currency'),
  ('sms_verification_enabled', 'true',       'Enable SMS OTP verification'),
  ('email_verification_enabled', 'true',     'Enable email verification');

-- =============================================================
-- SEED: SUPER ADMIN
-- Hardcoded admin credentials have been removed for security.
-- Run the seed script after first deployment to create the admin:
--
--   ADMIN_EMAIL=admin@yourdomain.com \
--   ADMIN_PASSWORD=YourStrongPass123! \
--   npm run seed:admin
--
-- See backend/scripts/seed-admin.js for details.
-- =============================================================

-- =============================================================
-- FUNCTIONS AND TRIGGERS
-- =============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'profiles', 'gigs', 'projects', 'proposals',
    'contracts', 'milestones', 'orders', 'escrow_accounts',
    'transactions', 'withdrawals', 'disputes', 'support_tickets'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()', t
    );
  END LOOP;
END;
$$;

-- Auto-update proposal count on project when proposal inserted
CREATE OR REPLACE FUNCTION update_project_proposal_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE projects SET proposals_count = proposals_count + 1
  WHERE id = NEW.project_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_proposal_count
AFTER INSERT ON proposals
FOR EACH ROW EXECUTE FUNCTION update_project_proposal_count();

-- Auto-create wallet for new freelancers
CREATE OR REPLACE FUNCTION create_wallet_for_freelancer()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'freelancer' THEN
    INSERT INTO wallets (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_wallet
AFTER INSERT OR UPDATE OF role ON users
FOR EACH ROW EXECUTE FUNCTION create_wallet_for_freelancer();

-- Auto-compute contract commission
CREATE OR REPLACE FUNCTION compute_contract_commission()
RETURNS TRIGGER AS $$
BEGIN
  NEW.commission_amount := ROUND(NEW.total_amount * (NEW.commission_rate / 100), 3);
  NEW.freelancer_amount  := NEW.total_amount - NEW.commission_amount;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contract_commission
BEFORE INSERT OR UPDATE OF total_amount, commission_rate ON contracts
FOR EACH ROW EXECUTE FUNCTION compute_contract_commission();

-- Auto-compute order commission
CREATE OR REPLACE FUNCTION compute_order_commission()
RETURNS TRIGGER AS $$
BEGIN
  NEW.commission_amount := ROUND(NEW.price * (NEW.commission_rate / 100), 3);
  NEW.freelancer_amount  := NEW.price - NEW.commission_amount;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_commission
BEFORE INSERT OR UPDATE OF price, commission_rate ON orders
FOR EACH ROW EXECUTE FUNCTION compute_order_commission();

-- Update freelancer avg_rating when review inserted
CREATE OR REPLACE FUNCTION update_freelancer_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles SET
    avg_rating   = (SELECT ROUND(AVG(overall_rating)::NUMERIC, 2) FROM reviews WHERE reviewee_id = NEW.reviewee_id),
    review_count = (SELECT COUNT(*) FROM reviews WHERE reviewee_id = NEW.reviewee_id)
  WHERE user_id = NEW.reviewee_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_rating
AFTER INSERT ON reviews
FOR EACH ROW EXECUTE FUNCTION update_freelancer_rating();

-- Update gig avg_rating
CREATE OR REPLACE FUNCTION update_gig_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_id IS NOT NULL THEN
    UPDATE gigs SET
      avg_rating   = (SELECT ROUND(AVG(r.overall_rating)::NUMERIC, 2) FROM reviews r JOIN orders o ON o.id = r.order_id WHERE o.gig_id = gigs.id),
      review_count = (SELECT COUNT(*) FROM reviews r JOIN orders o ON o.id = r.order_id WHERE o.gig_id = gigs.id)
    WHERE id = (SELECT gig_id FROM orders WHERE id = NEW.order_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_gig_rating
AFTER INSERT ON reviews
FOR EACH ROW EXECUTE FUNCTION update_gig_rating();

-- =============================================================
-- VIEWS
-- =============================================================

-- Full freelancer search view
CREATE OR REPLACE VIEW v_freelancer_search AS
SELECT
  u.id,
  u.status,
  u.preferred_language,
  p.full_name_en,
  p.full_name_ar,
  p.professional_title_en,
  p.professional_title_ar,
  p.bio_en,
  p.bio_ar,
  p.avatar_url,
  p.city,
  p.hourly_rate,
  p.availability,
  p.avg_rating,
  p.review_count,
  p.total_jobs_done,
  p.identity_verified,
  ARRAY_AGG(DISTINCT s.name_en) FILTER (WHERE s.id IS NOT NULL) AS skills_en,
  ARRAY_AGG(DISTINCT s.name_ar) FILTER (WHERE s.id IS NOT NULL) AS skills_ar,
  ARRAY_AGG(DISTINCT c.name_en) FILTER (WHERE c.id IS NOT NULL) AS categories_en
FROM users u
JOIN profiles p ON p.user_id = u.id
LEFT JOIN freelancer_skills fs ON fs.user_id = u.id
LEFT JOIN skills s ON s.id = fs.skill_id
LEFT JOIN gigs g ON g.freelancer_id = u.id AND g.status = 'active'
LEFT JOIN categories c ON c.id = g.category_id
WHERE u.role = 'freelancer' AND u.status = 'active'
GROUP BY u.id, u.status, u.preferred_language, p.full_name_en, p.full_name_ar,
  p.professional_title_en, p.professional_title_ar, p.bio_en, p.bio_ar,
  p.avatar_url, p.city, p.hourly_rate, p.availability, p.avg_rating,
  p.review_count, p.total_jobs_done, p.identity_verified;

-- Active gig search view
CREATE OR REPLACE VIEW v_gig_search AS
SELECT
  g.*,
  p.full_name_en AS freelancer_name_en,
  p.full_name_ar AS freelancer_name_ar,
  p.avatar_url   AS freelancer_avatar,
  p.city         AS freelancer_city,
  c.name_en      AS category_name_en,
  c.name_ar      AS category_name_ar,
  gp_basic.price AS basic_price,
  gp_std.price   AS standard_price,
  gp_prem.price  AS premium_price
FROM gigs g
JOIN users u ON u.id = g.freelancer_id
JOIN profiles p ON p.user_id = g.freelancer_id
JOIN categories c ON c.id = g.category_id
LEFT JOIN gig_packages gp_basic ON gp_basic.gig_id = g.id AND gp_basic.package_type = 'basic'
LEFT JOIN gig_packages gp_std   ON gp_std.gig_id   = g.id AND gp_std.package_type   = 'standard'
LEFT JOIN gig_packages gp_prem  ON gp_prem.gig_id  = g.id AND gp_prem.package_type  = 'premium'
WHERE g.status = 'active' AND u.status = 'active';
