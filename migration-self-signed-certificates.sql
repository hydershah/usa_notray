-- Migration: Create self_signed_certificates table for signer/witness certificates
-- Description: This table stores self-signed X.509 certificates generated for verified signers and witnesses
-- Created: 2024-01-14

-- Create the self_signed_certificates table
CREATE TABLE IF NOT EXISTS self_signed_certificates (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    certificate_id VARCHAR(255) NOT NULL UNIQUE,
    common_name VARCHAR(255) NOT NULL,
    certificate_content TEXT NOT NULL,
    private_key TEXT NOT NULL,
    public_key TEXT NOT NULL,
    certificate_path VARCHAR(500),
    private_key_path VARCHAR(500),
    public_key_path VARCHAR(500),
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'active' NOT NULL,
    user_role VARCHAR(50),
    user_email VARCHAR(255),
    revoked_at TIMESTAMP WITH TIME ZONE,
    revocation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_self_signed_certificates_user_id ON self_signed_certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_self_signed_certificates_certificate_id ON self_signed_certificates(certificate_id);
CREATE INDEX IF NOT EXISTS idx_self_signed_certificates_status ON self_signed_certificates(status);
CREATE INDEX IF NOT EXISTS idx_self_signed_certificates_user_email ON self_signed_certificates(user_email);
CREATE INDEX IF NOT EXISTS idx_self_signed_certificates_expires_at ON self_signed_certificates(expires_at);

-- Add constraints
ALTER TABLE self_signed_certificates 
ADD CONSTRAINT chk_certificate_status 
CHECK (status IN ('active', 'expired', 'revoked'));

ALTER TABLE self_signed_certificates 
ADD CONSTRAINT chk_user_role 
CHECK (user_role IN ('signer', 'witness', 'notary') OR user_role IS NULL);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at column
DROP TRIGGER IF EXISTS update_self_signed_certificates_updated_at ON self_signed_certificates;
CREATE TRIGGER update_self_signed_certificates_updated_at
    BEFORE UPDATE ON self_signed_certificates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE self_signed_certificates IS 'Stores self-signed X.509 certificates for verified signers and witnesses';
COMMENT ON COLUMN self_signed_certificates.user_id IS 'Reference to the user who owns this certificate';
COMMENT ON COLUMN self_signed_certificates.certificate_id IS 'Unique identifier for the certificate (e.g., user-123-1641234567890)';
COMMENT ON COLUMN self_signed_certificates.common_name IS 'Certificate common name (e.g., "John Doe (Verified Signer)")';
COMMENT ON COLUMN self_signed_certificates.certificate_content IS 'PEM-formatted X.509 certificate content';
COMMENT ON COLUMN self_signed_certificates.private_key IS 'PEM-formatted private key';
COMMENT ON COLUMN self_signed_certificates.public_key IS 'PEM-formatted public key';
COMMENT ON COLUMN self_signed_certificates.certificate_path IS 'Local file path to certificate file';
COMMENT ON COLUMN self_signed_certificates.private_key_path IS 'Local file path to private key file';
COMMENT ON COLUMN self_signed_certificates.public_key_path IS 'Local file path to public key file';
COMMENT ON COLUMN self_signed_certificates.issued_at IS 'When the certificate was issued';
COMMENT ON COLUMN self_signed_certificates.expires_at IS 'When the certificate expires (typically 1 year from issued_at)';
COMMENT ON COLUMN self_signed_certificates.status IS 'Certificate status: active, expired, or revoked';
COMMENT ON COLUMN self_signed_certificates.user_role IS 'Role of the user when certificate was generated';
COMMENT ON COLUMN self_signed_certificates.user_email IS 'Email of the user when certificate was generated';
COMMENT ON COLUMN self_signed_certificates.revoked_at IS 'When the certificate was revoked (if applicable)';
COMMENT ON COLUMN self_signed_certificates.revocation_reason IS 'Reason for certificate revocation';

-- Grant permissions (adjust based on your RLS policies)
-- These permissions should be configured through Supabase RLS policies instead
-- GRANT SELECT, INSERT, UPDATE ON self_signed_certificates TO authenticated;
-- GRANT DELETE ON self_signed_certificates TO service_role;

-- Example RLS policies (uncomment and adjust as needed)
-- ALTER TABLE self_signed_certificates ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own certificates
-- CREATE POLICY "Users can view their own certificates" ON self_signed_certificates
--     FOR SELECT USING (auth.uid()::text = user_id::text);

-- Policy: Users can insert their own certificates (through application logic)
-- CREATE POLICY "Users can insert their own certificates" ON self_signed_certificates
--     FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Policy: Only service role can update certificates
-- CREATE POLICY "Only service role can update certificates" ON self_signed_certificates
--     FOR UPDATE USING (auth.role() = 'service_role');

-- Policy: Only service role can delete certificates
-- CREATE POLICY "Only service role can delete certificates" ON self_signed_certificates
--     FOR DELETE USING (auth.role() = 'service_role');

-- Verify the table was created successfully
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'self_signed_certificates') THEN
        RAISE NOTICE 'Table self_signed_certificates created successfully!';
        RAISE NOTICE 'Ready for automatic certificate generation after ID verification.';
    ELSE
        RAISE EXCEPTION 'Failed to create self_signed_certificates table!';
    END IF;
END $$; 