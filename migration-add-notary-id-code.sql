-- Migration: Add notary_id_code field to users table
-- Description: Add a system-generated ID code field for notaries with format CY0000

-- Add the notary_id_code column to users table
ALTER TABLE users ADD COLUMN notary_id_code TEXT;

-- Create a unique index on notary_id_code to ensure uniqueness
CREATE UNIQUE INDEX idx_users_notary_id_code ON users(notary_id_code) WHERE notary_id_code IS NOT NULL;

-- Function to generate the next notary ID code
CREATE OR REPLACE FUNCTION generate_notary_id_code()
RETURNS TEXT AS $$
DECLARE
    next_number INTEGER;
    next_code TEXT;
BEGIN
    -- Find the highest existing notary ID number
    SELECT COALESCE(MAX(CAST(SUBSTRING(notary_id_code FROM 3) AS INTEGER)), 0) + 1
    INTO next_number
    FROM users 
    WHERE notary_id_code IS NOT NULL AND notary_id_code ~ '^CY[0-9]{4}$';
    
    -- If no existing codes, start from 1
    IF next_number IS NULL THEN
        next_number := 1;
    END IF;
    
    -- Format as CY0000
    next_code := 'CY' || LPAD(next_number::TEXT, 4, '0');
    
    RETURN next_code;
END;
$$ LANGUAGE plpgsql;

-- Update existing notaries with ID codes
-- First, assign CY0001 to the admin user who is also a notary (ID = 1)
UPDATE users 
SET notary_id_code = 'CY0001' 
WHERE id = 1 AND role = 'notary';

-- Then assign sequential codes to other existing notaries
DO $$
DECLARE
    notary_record RECORD;
    current_code TEXT;
    counter INTEGER := 2; -- Start from 2 since admin got CY0001
BEGIN
    -- Get all notaries without ID codes, excluding the admin if already processed
    FOR notary_record IN 
        SELECT id FROM users 
        WHERE role = 'notary' AND notary_id_code IS NULL
        ORDER BY id ASC
    LOOP
        -- Generate code
        current_code := 'CY' || LPAD(counter::TEXT, 4, '0');
        
        -- Update the notary
        UPDATE users 
        SET notary_id_code = current_code 
        WHERE id = notary_record.id;
        
        -- Increment counter
        counter := counter + 1;
    END LOOP;
END;
$$;

-- Create a trigger to automatically generate ID codes for new notaries
CREATE OR REPLACE FUNCTION assign_notary_id_code()
RETURNS TRIGGER AS $$
BEGIN
    -- Only assign ID code if the user is a notary and doesn't already have one
    IF NEW.role = 'notary' AND NEW.notary_id_code IS NULL THEN
        NEW.notary_id_code := generate_notary_id_code();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT operations
CREATE TRIGGER trigger_assign_notary_id_code
    BEFORE INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION assign_notary_id_code();

-- Create trigger for UPDATE operations (in case role changes to notary)
CREATE TRIGGER trigger_assign_notary_id_code_update
    BEFORE UPDATE ON users
    FOR EACH ROW
    WHEN (OLD.role != 'notary' AND NEW.role = 'notary')
    EXECUTE FUNCTION assign_notary_id_code();

-- Verify the migration
SELECT 
    id, 
    username, 
    email, 
    role, 
    notary_id_code,
    created_at
FROM users 
WHERE role = 'notary' 
ORDER BY notary_id_code; 