-- Migration: Create Participant Roles System
-- Description: Creates configurable participant roles table and seeds default data

-- Create participant_roles table
CREATE TABLE IF NOT EXISTS participant_roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'signer',
  requires_signature BOOLEAN NOT NULL DEFAULT true,
  requires_id_verification BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_participant_roles_category ON participant_roles(category);
CREATE INDEX IF NOT EXISTS idx_participant_roles_active ON participant_roles(is_active);
CREATE INDEX IF NOT EXISTS idx_participant_roles_sort_order ON participant_roles(sort_order);

-- Insert default participant roles
INSERT INTO participant_roles (name, display_name, description, category, requires_signature, requires_id_verification, sort_order) VALUES
('borrower', 'Borrower (Signs documents)', 'Primary borrower who signs loan documents', 'signer', true, true, 1),
('co-borrower', 'Co-Borrower (Signs documents)', 'Secondary borrower who co-signs loan documents', 'signer', true, true, 2),
('seller', 'Seller (Signs documents)', 'Property seller who signs transfer documents', 'signer', true, true, 3),
('buyer', 'Buyer (Signs documents)', 'Property buyer who signs purchase documents', 'signer', true, true, 4),
('witness', 'Witness (Observes signing)', 'Witness who observes but does not sign documents', 'witness', false, true, 5),
('observer', 'Observer (Observes only)', 'Observer who watches the signing process', 'observer', false, false, 6),
('guardian', 'Guardian (Signs for minor)', 'Legal guardian signing on behalf of a minor', 'signer', true, true, 7),
('attorney', 'Attorney (Power of Attorney)', 'Attorney acting under power of attorney', 'signer', true, true, 8),
('trustee', 'Trustee (Trust representative)', 'Trustee representing a trust entity', 'signer', true, true, 9),
('corporate_officer', 'Corporate Officer', 'Officer representing a corporate entity', 'signer', true, true, 10);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_participant_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_participant_roles_updated_at_trigger
    BEFORE UPDATE ON participant_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_participant_roles_updated_at();

COMMIT; 