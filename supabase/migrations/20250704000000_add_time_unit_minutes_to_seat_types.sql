-- Add time_unit_minutes column to seat_types table
ALTER TABLE seat_types ADD COLUMN IF NOT EXISTS time_unit_minutes INTEGER DEFAULT 30 NOT NULL;

-- Update existing records to have the default value
UPDATE seat_types SET time_unit_minutes = 30 WHERE time_unit_minutes IS NULL;
