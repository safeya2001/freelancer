-- Proposals: hourly rate and estimated hours for hourly projects
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS proposed_hourly_rate DECIMAL(10,3),
  ADD COLUMN IF NOT EXISTS estimated_hours      DECIMAL(10,2);
