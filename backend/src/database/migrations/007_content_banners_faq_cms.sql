-- ═══════════════════════════════════════════════════════════════
-- Migration 007 — Content: banners, FAQ, CMS pages (Dopa Work)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS banners (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title_en    VARCHAR(300),
  title_ar    VARCHAR(300),
  image_url   VARCHAR(500) NOT NULL,
  link_url    VARCHAR(500),
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS faq (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_en  TEXT NOT NULL,
  question_ar  TEXT,
  answer_en    TEXT NOT NULL,
  answer_ar    TEXT,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_pages (
  page_key   VARCHAR(100) PRIMARY KEY,
  content    TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- Seed default keys for terms, privacy, about (AR/EN)
INSERT INTO cms_pages (page_key, content, updated_at)
VALUES
  ('terms_en', '', NOW()),
  ('terms_ar', '', NOW()),
  ('privacy_en', '', NOW()),
  ('privacy_ar', '', NOW()),
  ('about_en', '', NOW()),
  ('about_ar', '', NOW())
ON CONFLICT (page_key) DO NOTHING;
