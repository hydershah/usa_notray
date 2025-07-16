-- Migration: Fix user_signatures table schema
-- Date: 2024-12-19
-- Purpose: Create or update user_signatures table to support proper signature management

-- Create the table if it doesn't exist with the new schema
CREATE TABLE IF NOT EXISTS user_signatures (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  signature_type VARCHAR(20) NOT NULL DEFAULT 'signature',
  type VARCHAR(20) NOT NULL,
  image_url TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT
);

-- Add foreign key constraint if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_signatures_user_id_fkey'
  ) THEN
    ALTER TABLE user_signatures 
    ADD CONSTRAINT user_signatures_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id);
  END IF;
END $$;

-- Check if old columns exist and migrate data if they do
DO $$
BEGIN
  -- Check if old columns exist (format, data)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_signatures' AND column_name = 'format'
  ) THEN
    -- Add new columns if they don't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'user_signatures' AND column_name = 'name'
    ) THEN
      ALTER TABLE user_signatures ADD COLUMN name TEXT;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'user_signatures' AND column_name = 'type'
    ) THEN
      ALTER TABLE user_signatures ADD COLUMN type VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'user_signatures' AND column_name = 'image_url'
    ) THEN
      ALTER TABLE user_signatures ADD COLUMN image_url TEXT;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'user_signatures' AND column_name = 'metadata'
    ) THEN
      ALTER TABLE user_signatures ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'user_signatures' AND column_name = 'is_default'
    ) THEN
      ALTER TABLE user_signatures ADD COLUMN is_default BOOLEAN DEFAULT FALSE;
    END IF;

    -- Migrate existing data from old columns to new columns
    UPDATE user_signatures 
    SET 
      name = COALESCE(signature_type, 'Signature'),
      type = CASE 
        WHEN format = 'draw' THEN 'drawn'
        WHEN format = 'type' THEN 'generated'
        WHEN format = 'upload' THEN 'uploaded'
        ELSE 'drawn'
      END,
      image_url = data,
      metadata = '{}',
      is_default = FALSE
    WHERE name IS NULL OR type IS NULL OR image_url IS NULL;

    -- Add NOT NULL constraints after data migration
    ALTER TABLE user_signatures 
    ALTER COLUMN name SET NOT NULL,
    ALTER COLUMN type SET NOT NULL,
    ALTER COLUMN image_url SET NOT NULL;
  END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_signatures_user_id ON user_signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_user_signatures_type ON user_signatures(type);
CREATE INDEX IF NOT EXISTS idx_user_signatures_is_default ON user_signatures(is_default); 