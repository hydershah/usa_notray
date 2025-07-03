-- Add signature data fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS signature_image TEXT,
ADD COLUMN IF NOT EXISTS initials_image TEXT,
ADD COLUMN IF NOT EXISTS signature_typed TEXT,
ADD COLUMN IF NOT EXISTS initials_typed TEXT,
ADD COLUMN IF NOT EXISTS default_signature_type VARCHAR(20) DEFAULT 'draw'; -- 'draw', 'type', or 'upload'

-- Create signature history table for audit trail
CREATE TABLE IF NOT EXISTS user_signatures (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    signature_type VARCHAR(20) NOT NULL, -- 'signature' or 'initials'
    format VARCHAR(20) NOT NULL, -- 'draw', 'type', 'upload'
    data TEXT NOT NULL, -- base64 image or text
    created_at TIMESTAMP DEFAULT NOW(),
    ip_address VARCHAR(45),
    user_agent TEXT
);

-- Add indexes
CREATE INDEX idx_user_signatures_user_id ON user_signatures(user_id);
CREATE INDEX idx_user_signatures_created_at ON user_signatures(created_at); 