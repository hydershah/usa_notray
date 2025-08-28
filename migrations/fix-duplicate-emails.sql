-- Migration: Fix duplicate email security issue
-- This script identifies and handles any existing duplicate emails
-- Created: 2024

-- Step 1: Identify duplicate emails (if any exist)
-- This should return empty results if the unique constraint is working properly
DO $$
DECLARE
    duplicate_count INTEGER;
    duplicate_record RECORD;
BEGIN
    -- Check for duplicate emails
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT LOWER(email) as normalized_email, COUNT(*) as count
        FROM users 
        GROUP BY LOWER(email)
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
        RAISE NOTICE 'SECURITY ALERT: Found % sets of duplicate emails', duplicate_count;
        
        -- Log all duplicate email groups
        FOR duplicate_record IN 
            SELECT LOWER(email) as normalized_email, COUNT(*) as count, 
                   STRING_AGG(id::text || ':' || role, ', ') as user_details
            FROM users 
            GROUP BY LOWER(email)
            HAVING COUNT(*) > 1
        LOOP
            RAISE NOTICE 'Duplicate email: % (count: %) - Users: %', 
                duplicate_record.normalized_email, 
                duplicate_record.count, 
                duplicate_record.user_details;
        END LOOP;
        
        -- Insert audit log for security team
        INSERT INTO system_activity_logs (
            action,
            action_category,
            action_description,
            severity,
            is_system_action,
            details
        ) VALUES (
            'SECURITY_AUDIT_DUPLICATE_EMAILS',
            'system_admin',
            'Migration script detected duplicate emails in users table',
            'critical',
            true,
            jsonb_build_object(
                'duplicate_email_count', duplicate_count,
                'migration_script', 'fix-duplicate-emails.sql',
                'requires_manual_review', true
            )
        );
        
        RAISE EXCEPTION 'CRITICAL SECURITY ISSUE: Duplicate emails found. Manual review required before proceeding.';
    ELSE
        RAISE NOTICE 'Security check passed: No duplicate emails found.';
        
        -- Log successful security verification
        INSERT INTO system_activity_logs (
            action,
            action_category,
            action_description,
            severity,
            is_system_action,
            details
        ) VALUES (
            'SECURITY_VERIFICATION_PASSED',
            'system_admin',
            'Email uniqueness verification completed successfully',
            'info',
            true,
            jsonb_build_object(
                'migration_script', 'fix-duplicate-emails.sql',
                'verification_type', 'email_uniqueness',
                'status', 'passed'
            )
        );
    END IF;
END $$;

-- Step 2: Ensure database constraints are properly in place
-- The schema should already have these constraints, but let's verify

-- Check if unique constraint exists on email
DO $$
DECLARE
    constraint_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = 'users' 
        AND tc.constraint_type = 'UNIQUE'
        AND ccu.column_name = 'email'
    ) INTO constraint_exists;
    
    IF constraint_exists THEN
        RAISE NOTICE 'Email unique constraint is properly configured.';
    ELSE
        RAISE NOTICE 'Adding unique constraint to email column...';
        -- This should not be necessary if the schema is correct, but adding as failsafe
        ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
        RAISE NOTICE 'Email unique constraint added successfully.';
    END IF;
END $$;

-- Step 3: Create email normalization function for consistent checks
CREATE OR REPLACE FUNCTION normalize_email(input_email TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(TRIM(input_email));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 4: Add email uniqueness validation function
CREATE OR REPLACE FUNCTION validate_email_uniqueness(input_email TEXT, exclude_user_id INTEGER DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    normalized_email TEXT;
    existing_user_count INTEGER;
BEGIN
    normalized_email := normalize_email(input_email);
    
    IF exclude_user_id IS NULL THEN
        SELECT COUNT(*) INTO existing_user_count
        FROM users 
        WHERE normalize_email(email) = normalized_email;
    ELSE
        SELECT COUNT(*) INTO existing_user_count
        FROM users 
        WHERE normalize_email(email) = normalized_email 
        AND id != exclude_user_id;
    END IF;
    
    RETURN existing_user_count = 0;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger to prevent duplicate emails at database level
CREATE OR REPLACE FUNCTION prevent_duplicate_emails()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT validate_email_uniqueness(NEW.email, COALESCE(OLD.id, NULL)) THEN
        RAISE EXCEPTION 'Email address already exists: %', NEW.email
            USING ERRCODE = '23505',
                  HINT = 'Email addresses must be unique across all user types';
    END IF;
    
    -- Normalize email before storage
    NEW.email := normalize_email(NEW.email);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for INSERT and UPDATE
DROP TRIGGER IF EXISTS prevent_duplicate_emails_insert ON users;
DROP TRIGGER IF EXISTS prevent_duplicate_emails_update ON users;

CREATE TRIGGER prevent_duplicate_emails_insert
    BEFORE INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION prevent_duplicate_emails();

CREATE TRIGGER prevent_duplicate_emails_update
    BEFORE UPDATE ON users
    FOR EACH ROW
    WHEN (OLD.email IS DISTINCT FROM NEW.email)
    EXECUTE FUNCTION prevent_duplicate_emails();

-- Step 6: Final verification
DO $$
BEGIN
    RAISE NOTICE 'Email security migration completed successfully.';
    RAISE NOTICE 'Database-level protections are now in place:';
    RAISE NOTICE '  - Unique constraint on email column';
    RAISE NOTICE '  - Email normalization function';
    RAISE NOTICE '  - Duplicate email validation function';
    RAISE NOTICE '  - Database triggers to prevent duplicates';
    
    -- Log completion
    INSERT INTO system_activity_logs (
        action,
        action_category,
        action_description,
        severity,
        is_system_action,
        details
    ) VALUES (
        'EMAIL_SECURITY_MIGRATION_COMPLETED',
        'system_admin',
        'Email uniqueness security migration completed successfully',
        'info',
        true,
        jsonb_build_object(
            'migration_script', 'fix-duplicate-emails.sql',
            'protections_added', ARRAY[
                'unique_constraint',
                'normalization_function', 
                'validation_function',
                'database_triggers'
            ],
            'completion_status', 'successful'
        )
    );
END $$;
