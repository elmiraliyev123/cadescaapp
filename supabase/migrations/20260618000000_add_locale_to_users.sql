-- Add locale preference column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS locale text;
