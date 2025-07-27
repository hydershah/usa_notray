-- Add digital signatures table for tracking PDF cryptographic signatures
CREATE TABLE IF NOT EXISTS digital_signatures (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  session_id VARCHAR(255),
  document_id INTEGER REFERENCES job_documents(id) ON DELETE SET NULL,
  signer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signer_name VARCHAR(255) NOT NULL,
  signer_email VARCHAR(255) NOT NULL,
  signature_type VARCHAR(50) NOT NULL CHECK (signature_type IN ('user', 'notary')),
  certificate_id VARCHAR(255) NOT NULL,
  signature_hash VARCHAR(255) NOT NULL,
  signature_data TEXT, -- Base64 encoded signature
  signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  is_valid BOOLEAN DEFAULT true NOT NULL,
  verification_status VARCHAR(50) DEFAULT 'pending' NOT NULL CHECK (verification_status IN ('pending', 'verified', 'failed')),
  verified_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB, -- Additional signature metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_digital_signatures_job_id ON digital_signatures(job_id);
CREATE INDEX IF NOT EXISTS idx_digital_signatures_signer_id ON digital_signatures(signer_id);
CREATE INDEX IF NOT EXISTS idx_digital_signatures_session_id ON digital_signatures(session_id);
CREATE INDEX IF NOT EXISTS idx_digital_signatures_signature_hash ON digital_signatures(signature_hash);

-- Update trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_digital_signatures_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER digital_signatures_updated_at_trigger
  BEFORE UPDATE ON digital_signatures
  FOR EACH ROW
  EXECUTE FUNCTION update_digital_signatures_updated_at(); 