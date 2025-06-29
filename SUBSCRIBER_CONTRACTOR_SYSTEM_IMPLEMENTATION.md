# Subscriber vs Contractor System Implementation

## Overview

This implementation provides a comprehensive financial management system for the notary platform that differentiates between **Subscriber** and **Contractor** notaries according to the specific business requirements.

## Business Model Summary

### Subscriber Notaries
- **Use Case**: Notaries using the platform for their own client base
- **Payment Model**: Pay fees to USA Notary for platform usage
- **Account Requirement**: Must maintain minimum $25.00 balance
- **Fee Structure**: 
  - Base platform fee: $10.00 (includes 1 ID verification + 20 min session)
  - Additional ID verification: $2.00 each
  - Extended time: $5.00 per 10 minutes over 20 minutes
- **Revenue**: Keep whatever they charge their clients

### Contractor Notaries  
- **Use Case**: Complete notarizations for USA Notary clients
- **Payment Model**: Receive 55% of total fee charged to client
- **Account Requirement**: No minimum balance required
- **Payment Timing**: Often delayed until title company payment received
- **Assignment**: Jobs assigned by admin or automated system

## Implementation Components

### 1. Database Schema Extensions

#### New User Fields (`users` table)
```sql
-- Account Balance Management
account_balance INTEGER DEFAULT 0                    -- Balance in cents
minimum_balance INTEGER DEFAULT 2500                 -- $25.00 minimum for subscribers
available_balance INTEGER DEFAULT 0                  -- Available after minimum balance
pending_balance INTEGER DEFAULT 0                    -- Contractor pending payments
total_earnings INTEGER DEFAULT 0                     -- Lifetime earnings
total_spent INTEGER DEFAULT 0                        -- Lifetime spending  
stripe_customer_id TEXT                              -- Stripe customer ID
```

#### New Tables

**Fee Configurations** (`fee_configurations`)
- Stores all fee amounts from business requirements
- Pre-populated with exact amounts: $10.00 base, $2.00 additional ID, etc.
- Supports different fee types and role applicability

**Account Transactions** (`account_transactions`)
- Complete audit trail of all balance changes
- Tracks deposits, withdrawals, fee deductions, contractor payments
- Links to Stripe transaction IDs for reconciliation

**Contractor Payments** (`contractor_payments`)
- Tracks the 55% payments to contractors
- Manages delayed payment status and reasons
- Handles title company payment delays

**Job Fee Breakdowns** (`job_fee_breakdowns`)
- Detailed fee calculations for each job
- Links to subscriber notaries for fee deductions
- Stores session duration and additional fees

**Stripe Webhook Events** (`stripe_webhook_events`)
- Audit trail of all Stripe events
- Ensures proper processing of payments

### 2. Service Classes

#### FeeCalculationService
- **Purpose**: Calculate exact fees according to business requirements
- **Key Features**:
  - Subscriber fee calculation (platform fees)
  - Client fee calculation (title closing, documents)
  - Contractor payment calculation (55% of total)
  - Witness fee handling (excluded from contractor calculation)
  - Minimum balance validation

#### AccountBalanceService
- **Purpose**: Manage account balances and transactions
- **Key Features**:
  - Deposit/withdrawal processing
  - Fee deduction with minimum balance enforcement
  - Contractor payment processing
  - Pending balance management
  - Transaction history tracking

#### ContractorPaymentService
- **Purpose**: Handle contractor payments and delayed payment tracking
- **Key Features**:
  - 55% payment calculation
  - Delayed payment status management
  - Bulk payment processing
  - Payment history and summaries

### 3. Fee Structure Implementation

#### Subscriber Fees (Platform Usage)
```typescript
// Base fees from business requirements
Platform Base: $10.00          // Includes 1 ID + 20 min session
Additional ID: $2.00 each       // Per additional ID verification  
Extended Time: $5.00            // Per 10 minutes over 20
Witness (Provided): $10.00      // If USA Notary provides witness
Witness (Client): $5.00         // If client provides witness
```

#### Client Fees (USA Notary Services)
```typescript
// Title closing fees
Title Closing - Seller: $120.00
Title Closing - Buyer: $120.00
Title Closing - Buyer w/Loans: $145.00

// Document fees  
Single Document (up to 2): $25.00
Additional Document: $10.00 each
Additional Signer - Single: $5.00
Additional Signer - Title: $10.00
```

#### Contractor Compensation
- **Base**: 55% of total fee charged to client
- **Exclusion**: Witness charges NOT included in calculation
- **Timing**: Often delayed until title company payment received

### 4. Business Logic Implementation

#### Minimum Balance Enforcement
```typescript
// Subscribers must maintain $25.00 minimum
const minimumBalance = 2500; // cents
const availableBalance = accountBalance - minimumBalance;

// Validate before fee deduction
if (availableBalance < requiredFees) {
  throw new Error('Insufficient funds');
}
```

#### Automatic Fee Deduction
```typescript
// When subscriber completes a job
const feeBreakdown = await feeService.calculateSubscriberFees(input);
const deductionResult = await balanceService.deductFees(
  subscriberId, 
  feeBreakdown.totalFees,
  'Platform usage fees for job completion'
);
```

#### Contractor Payment Processing
```typescript
// When contractor completes a job for USA Notary client
const clientFees = await feeService.calculateClientFees(input);
const contractorAmount = feeService.calculateContractorPayment(clientFees); // 55%

// Create payment record (pending until client pays)
await contractorService.createContractorPayment(
  contractorId,
  jobId, 
  clientFees.totalFees,
  55 // percentage
);
```

### 5. Account Management Features

#### For Subscribers
- **Add Funds**: Deposit money via Stripe
- **Withdraw Funds**: Transfer money out (above minimum balance)
- **View Balance**: See available balance vs minimum requirement
- **Fee History**: Track all platform usage fees
- **Balance Alerts**: Notifications when balance gets low

#### For Contractors  
- **Pending Payments**: Track jobs completed but not yet paid
- **Payment History**: See all received payments
- **Payment Status**: Track payment delays and reasons
- **Earnings Summary**: View earnings by period

### 6. Integration Points

#### Job Creation (Subscribers)
- Pre-validate minimum balance before allowing job creation
- Calculate estimated fees upfront
- Deduct fees automatically upon job completion

#### Job Assignment (Contractors)
- Create payment record when job assigned
- Track 55% calculation based on client fee
- Handle delayed payment scenarios

#### Stripe Integration
- Customer creation for subscribers
- Payment processing for deposits/withdrawals
- Transfer handling for contractor payouts
- Webhook processing for reconciliation

## Migration Instructions

1. **Run Database Migration**:
   ```bash
   psql -d your_database -f migration-subscriber-contractor-system.sql
   ```

2. **Install Dependencies** (if needed):
   ```bash
   npm install stripe @stripe/stripe-js
   ```

3. **Environment Variables**:
   ```
   STRIPE_SECRET_KEY=sk_...
   STRIPE_PUBLISHABLE_KEY=pk_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

## Key Benefits

### For Subscribers
✅ **Transparent Pricing**: Know exact costs upfront  
✅ **Flexible Usage**: Pay only for what you use  
✅ **Account Control**: Manage funds with minimum balance protection  
✅ **Revenue Freedom**: Keep whatever you charge clients  

### For Contractors  
✅ **Fair Compensation**: Guaranteed 55% of client fees  
✅ **No Upfront Costs**: No balance requirements  
✅ **Payment Tracking**: Clear visibility into payment status  
✅ **Automated Payouts**: Streamlined payment processing  

### For Platform
✅ **Revenue Streams**: Subscriber fees + 45% of contractor jobs  
✅ **Financial Control**: Automated fee collection and payment processing  
✅ **Audit Trail**: Complete transaction history for all financial activity  
✅ **Scalability**: Supports growth in both subscriber and contractor segments  

## Next Steps

1. **Create UI Components**: Build account balance dashboards and payment forms
2. **Implement Stripe Integration**: Set up payment processing and webhooks  
3. **Add Notification System**: Alert users about balance and payment status
4. **Testing**: Comprehensive testing of all fee calculations and edge cases
5. **Documentation**: Create user guides for both subscriber and contractor workflows 