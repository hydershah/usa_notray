-- Migration: Update Closing Types with new default values
-- Date: 2025-01-07
-- Description: Update closing types to match the new default list with correct pricing

-- First, clear existing closing types
DELETE FROM closing_types;

-- Reset the sequence to start from 1
ALTER SEQUENCE closing_types_id_seq RESTART WITH 1;

-- Insert new default closing types
INSERT INTO closing_types (
  name,
  description,
  base_price,
  is_active,
  estimated_duration,
  requires_witness,
  requires_notary_travel,
  travel_fee,
  created_at,
  updated_at
) VALUES 
  (
    'Title Closing - Seller Side',
    'Standard title closing service for seller side transactions',
    12000, -- $120.00 in cents
    true,
    60, -- 60 minutes
    false,
    false,
    0,
    NOW(),
    NOW()
  ),
  (
    'Title Closing - Buyer w/Cash',
    'Title closing service for buyer side transactions with cash payment',
    14500, -- $145.00 in cents
    true,
    75, -- 75 minutes
    false,
    false,
    0,
    NOW(),
    NOW()
  ),
  (
    'Title Closing - Buyer w/Loan',
    'Title closing service for buyer side transactions with loan financing',
    12000, -- $120.00 in cents
    true,
    90, -- 90 minutes
    false,
    false,
    0,
    NOW(),
    NOW()
  ),
  (
    'Title Closing - Joint',
    'Title closing service for joint transactions involving multiple parties',
    15000, -- $150.00 in cents
    true,
    120, -- 120 minutes
    false,
    false,
    0,
    NOW(),
    NOW()
  ),
  (
    '1-4 Document',
    'Standard document notarization service for 1-4 documents',
    2500, -- $25.00 in cents
    true,
    30, -- 30 minutes
    false,
    false,
    0,
    NOW(),
    NOW()
  );

-- Verify the migration
SELECT 
  id,
  name,
  base_price,
  estimated_duration,
  is_active
FROM closing_types 
ORDER BY id; 