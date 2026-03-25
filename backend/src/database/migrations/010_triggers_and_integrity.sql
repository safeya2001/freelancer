-- Migration 010: DB-level triggers for wallet auto-creation and avg_rating maintenance
-- Run once against the live database. All statements are idempotent.

-- ─── 1. Auto-create wallet on user insert ────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_auto_create_wallet()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO wallets (user_id, balance, pending_balance, total_earned)
  VALUES (NEW.id, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_wallet ON users;
CREATE TRIGGER trg_auto_create_wallet
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION fn_auto_create_wallet();

-- ─── 2. Refresh profile avg_rating / review_count after review insert ─────────
CREATE OR REPLACE FUNCTION fn_refresh_profile_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE profiles
  SET avg_rating   = (
        SELECT ROUND(AVG(overall_rating)::numeric, 2)
        FROM reviews
        WHERE reviewee_id = NEW.reviewee_id AND is_public = true
      ),
      review_count = (
        SELECT COUNT(*)
        FROM reviews
        WHERE reviewee_id = NEW.reviewee_id AND is_public = true
      )
  WHERE user_id = NEW.reviewee_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_profile_rating ON reviews;
CREATE TRIGGER trg_refresh_profile_rating
  AFTER INSERT OR UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION fn_refresh_profile_rating();

-- ─── 3. Refresh gig avg_rating / review_count after order review insert ───────
CREATE OR REPLACE FUNCTION fn_refresh_gig_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.order_id IS NOT NULL THEN
    UPDATE gigs
    SET avg_rating   = (
          SELECT ROUND(AVG(r.overall_rating)::numeric, 2)
          FROM reviews r
          JOIN orders o ON o.id = r.order_id
          WHERE o.gig_id = gigs.id AND r.is_public = true
        ),
        review_count = (
          SELECT COUNT(*)
          FROM reviews r
          JOIN orders o ON o.id = r.order_id
          WHERE o.gig_id = gigs.id AND r.is_public = true
        )
    WHERE id = (SELECT gig_id FROM orders WHERE id = NEW.order_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_gig_rating ON reviews;
CREATE TRIGGER trg_refresh_gig_rating
  AFTER INSERT OR UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION fn_refresh_gig_rating();

-- ─── 4. Ensure platform_settings has a default commission_rate row ────────────
INSERT INTO platform_settings (key, value, description)
VALUES ('commission_rate', '10', 'Platform commission percentage (0-100)')
ON CONFLICT (key) DO NOTHING;
