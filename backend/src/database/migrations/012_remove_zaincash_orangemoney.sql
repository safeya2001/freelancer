-- Migration 012: Deprecate Zain Cash, Orange Money, and Cash on Delivery
--
-- PostgreSQL does not support dropping ENUM values, so the values
-- 'zain_cash', 'orange_money', and 'cash_on_delivery' remain in the
-- payment_method enum for historical data integrity.
--
-- Application-level enforcement: these methods are removed from all DTOs
-- and service validation. No new transactions or withdrawals will be
-- created with these methods. Existing records are unaffected.
--
-- Supported methods going forward:
--   Deposits:    cliq (manual)  |  stripe (automated)
--   Withdrawals: cliq           |  bank_transfer

-- Add CLIQ_NAME to platform settings if not present
INSERT INTO platform_settings (key, value, description, updated_by)
SELECT
  'cliq_name',
  'Dopa Work',
  'CliQ account holder name displayed to users during payment',
  (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM platform_settings WHERE key = 'cliq_name');

INSERT INTO platform_settings (key, value, description, updated_by)
SELECT
  'cliq_alias',
  'DOPAWORK.JO',
  'Platform CliQ alias for receiving payments',
  (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM platform_settings WHERE key = 'cliq_alias');
