-- =====================================================================================
-- MIGRATION: Company Approval System
-- Description: Add approval fields to companies table to enable admin approval workflow
-- Date: 2024
-- =====================================================================================

-- Add approval fields to companies table
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS approval_notes TEXT;

-- Update existing companies to 'active' status if they don't have a status
UPDATE companies SET status = 'active' WHERE status IS NULL;

-- Update status for any companies that were auto-approved during registration
-- You may want to set these to 'pending' if you want to review existing companies
-- UPDATE companies SET status = 'pending' WHERE status = 'active' AND approved_by IS NULL;

-- Add index for faster queries on approval status
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_approved_by ON companies(approved_by);

-- =====================================================================================
-- DATA VALIDATION QUERIES (for testing)
-- =====================================================================================

-- Check companies by status
-- SELECT status, COUNT(*) as count FROM companies GROUP BY status;

-- Check companies awaiting approval
-- SELECT id, company_name, status, created_at FROM companies WHERE status = 'pending' ORDER BY created_at;

-- Check approved companies
-- SELECT c.id, c.company_name, c.status, c.approved_at, u.full_name as approved_by_name 
-- FROM companies c 
-- LEFT JOIN users u ON c.approved_by = u.id 
-- WHERE c.status = 'active' AND c.approved_by IS NOT NULL;

COMMIT; 