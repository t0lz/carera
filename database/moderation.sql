INSERT INTO roles (name)
VALUES ('manager')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE ads
  ADD COLUMN IF NOT EXISTS status VARCHAR(30),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

UPDATE ads
SET status = COALESCE(status, 'approved')
WHERE status IS NULL;

ALTER TABLE ads
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE ads
  DROP CONSTRAINT IF EXISTS ads_status_check;

ALTER TABLE ads
  ADD CONSTRAINT ads_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));
