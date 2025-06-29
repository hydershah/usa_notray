-- Migration: Participant Payments System
-- Description: Add participant_payments table to track compensation for signers, witnesses, and observers

-- Create Participant Payments Table
CREATE TABLE IF NOT EXISTS participant_payments (
  id SERIAL PRIMARY KEY,
  participant_id INTEGER REFERENCES users(id) NOT NULL,
  job_id INTEGER REFERENCES jobs(id) NOT NULL,
  session_id INTEGER, -- Reference to signing session if applicable
  participant_role TEXT NOT NULL, -- 'signer', 'witness', 'observer', 'primary_signer', 'co_signer'
  base_compensation INTEGER NOT NULL, -- Base amount for participation in cents
  session_duration INTEGER, -- Session duration in minutes
  bonus_amount INTEGER DEFAULT 0, -- Additional compensation for complex/long sessions
  total_amount INTEGER NOT NULL, -- Total compensation amount in cents
  payment_status TEXT DEFAULT 'pending' NOT NULL, -- 'pending', 'available', 'paid', 'failed'
  session_completed_date TIMESTAMP, -- When the signing session was completed
  available_for_payout_date TIMESTAMP, -- When payment becomes available (usually 24h after completion)
  paid_to_participant_date TIMESTAMP, -- When participant was actually paid
  stripe_transfer_id TEXT, -- Stripe transfer ID for participant payment
  payment_method TEXT, -- 'stripe_transfer', 'ach', 'check', etc.
  metadata JSONB, -- Additional payment details
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_participant_payments_participant_id ON participant_payments(participant_id);
CREATE INDEX IF NOT EXISTS idx_participant_payments_job_id ON participant_payments(job_id);
CREATE INDEX IF NOT EXISTS idx_participant_payments_status ON participant_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_participant_payments_role ON participant_payments(participant_role);
CREATE INDEX IF NOT EXISTS idx_participant_payments_session_completed ON participant_payments(session_completed_date);

-- Add some sample compensation configurations as comments for reference
-- Base Compensation Rates:
-- - Primary Signer: $15.00 (1500 cents)
-- - Co-Signer: $15.00 (1500 cents)  
-- - Witness: $10.00 (1000 cents)
-- - Observer: $5.00 (500 cents)
-- 
-- Bonus Structure:
-- - Sessions over 45 minutes: +$2.50 per 15-minute block (250 cents)
-- 
-- Payment Schedule:
-- - Payment created immediately upon session completion
-- - 24-hour hold period for quality review
-- - Automated payout after hold period expires 