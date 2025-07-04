-- Migration: Create system_activity_logs table for comprehensive audit logging
-- Date: $(date)
-- Purpose: Add comprehensive activity logging for admin audit trail

-- Create the system_activity_logs table
CREATE TABLE IF NOT EXISTS system_activity_logs (
    id SERIAL PRIMARY KEY,
    
    -- User information
    user_id INTEGER REFERENCES users(id),
    user_role TEXT,
    user_email TEXT,
    user_name TEXT,
    
    -- Action details
    action TEXT NOT NULL,
    action_category TEXT NOT NULL,
    action_description TEXT NOT NULL,
    
    -- Context information
    target_type TEXT,
    target_id INTEGER,
    target_name TEXT,
    
    -- Related entities
    job_id INTEGER REFERENCES jobs(id),
    company_id INTEGER REFERENCES companies(id),
    
    -- Request/Response details
    request_method TEXT,
    request_path TEXT,
    request_body JSONB,
    response_status INTEGER,
    
    -- Additional metadata
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    session_id TEXT,
    
    -- Status and flags
    severity TEXT DEFAULT 'info' NOT NULL,
    is_system_action BOOLEAN DEFAULT false,
    is_successful BOOLEAN DEFAULT true,
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_activity_logs_user_id ON system_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_activity_logs_action ON system_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_system_activity_logs_category ON system_activity_logs(action_category);
CREATE INDEX IF NOT EXISTS idx_system_activity_logs_created_at ON system_activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_system_activity_logs_job_id ON system_activity_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_system_activity_logs_company_id ON system_activity_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_system_activity_logs_severity ON system_activity_logs(severity);

-- Add comments for documentation
COMMENT ON TABLE system_activity_logs IS 'Comprehensive audit log for all system activities';
COMMENT ON COLUMN system_activity_logs.user_id IS 'ID of the user who performed the action';
COMMENT ON COLUMN system_activity_logs.action IS 'The specific action performed (e.g., login, job_created)';
COMMENT ON COLUMN system_activity_logs.action_category IS 'Category of the action (e.g., authentication, job_management)';
COMMENT ON COLUMN system_activity_logs.severity IS 'Severity level: info, warning, error, critical';
COMMENT ON COLUMN system_activity_logs.details IS 'Additional structured data about the action';

-- Insert a test log entry to verify the table works
INSERT INTO system_activity_logs (
    action,
    action_category,
    action_description,
    severity,
    is_system_action,
    details
) VALUES (
    'table_created',
    'system_admin',
    'System activity logs table created successfully',
    'info',
    true,
    '{"migration": "system-activity-logs", "version": "1.0"}'
);

-- Show successful completion
SELECT 'System activity logs table created successfully!' as result; 