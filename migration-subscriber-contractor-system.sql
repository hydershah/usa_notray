-- Migration to implement comprehensive Subscriber vs Contractor system
-- This migration adds account balance management, fee configurations, and payment tracking

-- Add account balance and financial management fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_balance INTEGER DEFAULT 0; -- Balance in cents
ALTER TABLE users ADD COLUMN IF NOT EXISTS minimum_balance INTEGER DEFAULT 2500; -- $25.00 minimum for subscribers in cents
ALTER TABLE users ADD COLUMN IF NOT EXISTS available_balance INTEGER DEFAULT 0; -- Available balance after pending transactions
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_balance INTEGER DEFAULT 0; -- Contractor pending payments in cents
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_earnings INTEGER DEFAULT 0; -- Total lifetime earnings in cents
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_spent INTEGER DEFAULT 0; -- Total lifetime spending in cents
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT; -- Stripe customer ID for payment processing

-- Create Fee Configuration Table
CREATE TABLE IF NOT EXISTS fee_configurations (
  id SERIAL PRIMARY KEY,
  fee_type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'USD' NOT NULL,
  description TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  applicable_to_role TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Insert default fee structure from business requirements
INSERT INTO fee_configurations (fee_type, amount, description, applicable_to_role) VALUES 
('platform_base', 1000, 'Base platform fee for signing session (includes 1 ID verification and 20 minute session)', 'subscriber'),
('additional_id', 200, 'Additional ID verification fee', 'subscriber'),
('extended_time', 500, 'Extended time fee per 10 minutes over 20 minutes', 'subscriber'),
('title_closing_seller', 12000, 'Title Closing - Seller Side', 'both'),
('title_closing_buyer', 12000, 'Title Closing - Buyer Side', 'both'),
('title_closing_buyer_loans', 14500, 'Title Closing - Buyer Side with Loans', 'both'),
('single_document', 2500, 'Single Document (Up to 2 documents)', 'both'),
('additional_document', 1000, 'Additional document (over 2)', 'both'),
('additional_signer_single', 500, 'Additional Signer - Single Document', 'both'),
('additional_signer_title', 1000, 'Additional Signer - Title Documents', 'both'),
('witness_provided', 1000, 'Witness fee when USA Notary provides witness', 'both'),
('witness_client_provided', 500, 'Witness fee when client provides witness (ID verification only)', 'both');

-- Create Account Transactions Table
CREATE TABLE IF NOT EXISTS account_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) NOT NULL,
  transaction_type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT NOT NULL,
  job_id INTEGER REFERENCES jobs(id),
  payment_method TEXT,
  stripe_transaction_id TEXT,
  status TEXT DEFAULT 'pending' NOT NULL,
  metadata JSONB,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create Contractor Payments Table
CREATE TABLE IF NOT EXISTS contractor_payments (
  id SERIAL PRIMARY KEY,
  contractor_id INTEGER REFERENCES users(id) NOT NULL,
  job_id INTEGER REFERENCES jobs(id) NOT NULL,
  total_job_fee INTEGER NOT NULL,
  contractor_percentage INTEGER DEFAULT 55 NOT NULL,
  contractor_amount INTEGER NOT NULL,
  platform_fee INTEGER NOT NULL,
  payment_status TEXT DEFAULT 'pending' NOT NULL,
  client_payment_date TIMESTAMP,
  available_for_payout_date TIMESTAMP,
  paid_to_contractor_date TIMESTAMP,
  stripe_transfer_id TEXT,
  delay_reason TEXT,
  estimated_payout_date TIMESTAMP,
  invoice_number TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create Job Fee Breakdown Table
CREATE TABLE IF NOT EXISTS job_fee_breakdowns (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES jobs(id) NOT NULL,
  subscriber_notary_id INTEGER REFERENCES users(id),
  base_platform_fee INTEGER DEFAULT 1000,
  id_verification_count INTEGER DEFAULT 1,
  additional_id_fees INTEGER DEFAULT 0,
  session_duration INTEGER,
  extended_time_fees INTEGER DEFAULT 0,
  total_subscriber_fees INTEGER NOT NULL,
  witness_provided BOOLEAN DEFAULT false,
  witness_fee INTEGER DEFAULT 0,
  fee_breakdown JSONB,
  deducted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create Stripe Webhook Events Table
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id SERIAL PRIMARY KEY,
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  processed BOOLEAN DEFAULT false,
  user_id INTEGER REFERENCES users(id),
  transaction_id INTEGER REFERENCES account_transactions(id),
  event_data JSONB NOT NULL,
  processing_error TEXT,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_account_balance ON users(account_balance);
CREATE INDEX IF NOT EXISTS idx_users_notary_type_balance ON users(notary_type, account_balance) WHERE role = 'notary';
CREATE INDEX IF NOT EXISTS idx_fee_configurations_type ON fee_configurations(fee_type);
CREATE INDEX IF NOT EXISTS idx_fee_configurations_active ON fee_configurations(is_active);
CREATE INDEX IF NOT EXISTS idx_account_transactions_user ON account_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_account_transactions_type ON account_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_account_transactions_status ON account_transactions(status);
CREATE INDEX IF NOT EXISTS idx_account_transactions_job ON account_transactions(job_id);
CREATE INDEX IF NOT EXISTS idx_contractor_payments_contractor ON contractor_payments(contractor_id);
CREATE INDEX IF NOT EXISTS idx_contractor_payments_job ON contractor_payments(job_id);
CREATE INDEX IF NOT EXISTS idx_contractor_payments_status ON contractor_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_job_fee_breakdowns_job ON job_fee_breakdowns(job_id);
CREATE INDEX IF NOT EXISTS idx_job_fee_breakdowns_subscriber ON job_fee_breakdowns(subscriber_notary_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_stripe_id ON stripe_webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed ON stripe_webhook_events(processed);

-- Add constraints
ALTER TABLE account_transactions ADD CONSTRAINT check_transaction_type 
  CHECK (transaction_type IN ('deposit', 'withdrawal', 'fee_deduction', 'contractor_payment', 'platform_fee', 'refund'));

ALTER TABLE account_transactions ADD CONSTRAINT check_transaction_status 
  CHECK (status IN ('pending', 'completed', 'failed', 'cancelled'));

ALTER TABLE contractor_payments ADD CONSTRAINT check_payment_status 
  CHECK (payment_status IN ('pending', 'paid_by_client', 'available_for_payout', 'paid_to_contractor', 'failed'));

ALTER TABLE contractor_payments ADD CONSTRAINT check_contractor_percentage 
  CHECK (contractor_percentage >= 0 AND contractor_percentage <= 100);

ALTER TABLE fee_configurations ADD CONSTRAINT check_applicable_to_role 
  CHECK (applicable_to_role IS NULL OR applicable_to_role IN ('subscriber', 'contractor', 'both'));

-- Set minimum balance to $25 for all existing subscriber notaries
UPDATE users 
SET minimum_balance = 2500 
WHERE role = 'notary' AND notary_type = 'subscriber' AND minimum_balance = 0;

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS update_fee_configurations_updated_at ON fee_configurations;
CREATE TRIGGER update_fee_configurations_updated_at BEFORE UPDATE ON fee_configurations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_account_transactions_updated_at ON account_transactions;
CREATE TRIGGER update_account_transactions_updated_at BEFORE UPDATE ON account_transactions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contractor_payments_updated_at ON contractor_payments;
CREATE TRIGGER update_contractor_payments_updated_at BEFORE UPDATE ON contractor_payments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_job_fee_breakdowns_updated_at ON job_fee_breakdowns;
CREATE TRIGGER update_job_fee_breakdowns_updated_at BEFORE UPDATE ON job_fee_breakdowns 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migration completed - subscriber/contractor system ready 