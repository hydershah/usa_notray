-- Migration: Add verification image URL fields to users table
-- Date: 2025-01-05
-- Description: Add fields to store verification image URLs from Vultr storage

-- Add verification image URL columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS verification_image_front_url TEXT,
ADD COLUMN IF NOT EXISTS verification_image_back_url TEXT,
ADD COLUMN IF NOT EXISTS verification_image_selfie_url TEXT;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_verification_images ON users (verification_image_front_url, verification_image_back_url, verification_image_selfie_url);

-- Add comments for documentation
COMMENT ON COLUMN users.verification_image_front_url IS 'Vultr storage URL for front ID image';
COMMENT ON COLUMN users.verification_image_back_url IS 'Vultr storage URL for back ID image'; 
COMMENT ON COLUMN users.verification_image_selfie_url IS 'Vultr storage URL for selfie image'; 