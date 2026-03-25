-- Add platform_announcement for admin broadcast
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'notification_type' AND e.enumlabel = 'platform_announcement'
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'platform_announcement';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;
