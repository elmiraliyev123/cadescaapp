-- Migration: Add verified_via flag to users table
-- Used for the 2-step hybrid verification (email vs ocr)

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS verified_via text NOT NULL DEFAULT 'email';
