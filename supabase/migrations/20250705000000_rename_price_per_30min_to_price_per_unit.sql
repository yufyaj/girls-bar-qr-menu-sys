-- Rename price_per_30min column to price_per_unit
ALTER TABLE seat_types RENAME COLUMN price_per_30min TO price_per_unit;
