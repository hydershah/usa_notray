-- ============================================================================
-- Title Company Notary Assignment System Migration
-- ============================================================================
-- This migration creates a many-to-many relationship between title companies
-- and notaries, allowing title companies to have multiple preferred notaries
-- with one designated as the default.

BEGIN;

-- Create title_company_notary_assignments table
CREATE TABLE IF NOT EXISTS title_company_notary_assignments (
    id SERIAL PRIMARY KEY,
    title_company_id INTEGER NOT NULL,
    notary_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_default BOOLEAN DEFAULT FALSE NOT NULL,
    assigned_by INTEGER REFERENCES users(id), -- Admin who made the assignment
    assigned_at TIMESTAMP DEFAULT NOW() NOT NULL,
    notes TEXT, -- Optional notes about the assignment
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')) NOT NULL,
    
    -- Ensure no duplicate assignments
    UNIQUE(title_company_id, notary_id),
    
    -- Ensure only one default per title company
    EXCLUDE (title_company_id WITH =) WHERE (is_default = true)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tc_notary_assignments_title_company 
ON title_company_notary_assignments(title_company_id);

CREATE INDEX IF NOT EXISTS idx_tc_notary_assignments_notary 
ON title_company_notary_assignments(notary_id);

CREATE INDEX IF NOT EXISTS idx_tc_notary_assignments_default 
ON title_company_notary_assignments(title_company_id, is_default) 
WHERE is_default = true;

-- Add foreign key constraint for title_company_id
-- We'll support both legacy title_companies table and new companies table
ALTER TABLE title_company_notary_assignments 
ADD CONSTRAINT fk_tc_notary_assignments_company 
FOREIGN KEY (title_company_id) 
REFERENCES companies(id) ON DELETE CASCADE;

-- Also create a legacy table for backward compatibility with title_companies
CREATE TABLE IF NOT EXISTS legacy_title_company_notary_assignments (
    id SERIAL PRIMARY KEY,
    title_company_id INTEGER NOT NULL REFERENCES title_companies(id) ON DELETE CASCADE,
    notary_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_default BOOLEAN DEFAULT FALSE NOT NULL,
    assigned_by INTEGER REFERENCES users(id),
    assigned_at TIMESTAMP DEFAULT NOW() NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')) NOT NULL,
    
    UNIQUE(title_company_id, notary_id),
    EXCLUDE (title_company_id WITH =) WHERE (is_default = true)
);

-- Migrate existing preferred notary data from companies table
INSERT INTO title_company_notary_assignments (title_company_id, notary_id, is_default, assigned_at, status)
SELECT 
    c.id,
    c.preferred_notary_id,
    true, -- Set as default since it was the only preferred notary
    c.created_at,
    'active'
FROM companies c
WHERE c.preferred_notary_id IS NOT NULL
ON CONFLICT (title_company_id, notary_id) DO NOTHING;

-- Migrate existing preferred notary data from legacy title_companies table
INSERT INTO legacy_title_company_notary_assignments (title_company_id, notary_id, is_default, assigned_at, status)
SELECT 
    tc.id,
    tc.preferred_notary_id,
    true,
    tc.created_at,
    'active'
FROM title_companies tc
WHERE tc.preferred_notary_id IS NOT NULL
ON CONFLICT (title_company_id, notary_id) DO NOTHING;

-- Add audit fields to track changes
ALTER TABLE title_company_notary_assignments 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id);

ALTER TABLE legacy_title_company_notary_assignments 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id);

-- Create function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_tc_notary_assignments_updated_at ON title_company_notary_assignments;
CREATE TRIGGER update_tc_notary_assignments_updated_at
    BEFORE UPDATE ON title_company_notary_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_legacy_tc_notary_assignments_updated_at ON legacy_title_company_notary_assignments;
CREATE TRIGGER update_legacy_tc_notary_assignments_updated_at
    BEFORE UPDATE ON legacy_title_company_notary_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- Verification queries (commented out for production)
/*
-- Verify the migration worked correctly
SELECT 
    c.company_name,
    u.first_name || ' ' || u.last_name as notary_name,
    tca.is_default,
    tca.status,
    tca.assigned_at
FROM title_company_notary_assignments tca
JOIN companies c ON tca.title_company_id = c.id
JOIN users u ON tca.notary_id = u.id
ORDER BY c.company_name, tca.is_default DESC;

-- Check for any title companies without assignments
SELECT c.company_name, c.preferred_notary_id
FROM companies c
LEFT JOIN title_company_notary_assignments tca ON c.id = tca.title_company_id
WHERE tca.id IS NULL;
*/ 