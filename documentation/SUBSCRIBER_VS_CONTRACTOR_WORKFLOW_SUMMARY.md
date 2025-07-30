# Subscriber vs Contractor Notary Workflow System

## Overview

The platform now fully supports two distinct types of notaries with different business models and workflows:

1. **Contractor Notaries** - Work for USA Notary clients, get assigned jobs
2. **Subscriber Notaries** - Bring their own clients, rent the platform

## Business Model Differentiation

### 🟢 Contractor Notaries
- **Role**: Complete notarizations for USA Notary's clients  
- **Assignment**: Jobs assigned by admin, title companies, or automated system
- **Payment Model**: Receive 55% of client fees (delayed until title company pays)
- **Job Types**: Title company jobs only
- **Access**: Cannot create jobs, only accept assigned jobs
- **Approval**: Must approve assigned jobs before proceeding

### 🔵 Subscriber Notaries  
- **Role**: Use platform for their own personal client base
- **Assignment**: Self-assign (automatically assigned to their own jobs)
- **Payment Model**: Pay platform fees ($10 base + additional services)
- **Job Types**: Personal client jobs only (not title company jobs)
- **Access**: Can create jobs for their personal clients
- **Approval**: Auto-approved (since it's their own job)

## Technical Implementation

### Database Schema Updates

#### Jobs Table
```sql
-- New field to distinguish job types
job_type TEXT DEFAULT 'title_company' -- 'title_company', 'subscriber_personal'
```

#### Assignment Types  
```sql
-- Updated assignment types in notary_assignment_log
assignment_type: 'manual', 'random', 'preferred', 'subscriber_self'
```

### Workflow Logic

#### Title Company Job Creation (Admin/Title Company Users)
```
1. Admin/Title Company creates job
2. System marks as jobType: 'title_company'
3. Notary assignment options:
   - Preferred notary (if set by title company)
   - Auto assignment (random contractor selection)
   - Manual assignment (admin picks contractor)
4. Selected notary must be 'contractor' type
5. Job requires notary approval before proceeding
6. Contractor gets paid from client fees
```

#### Subscriber Personal Job Creation (Subscriber Notaries)
```
1. Subscriber notary creates job
2. System marks as jobType: 'subscriber_personal'  
3. Notary assignment:
   - Automatically assigns creator as notary
   - Assignment type: 'subscriber_self'
   - Status: Auto-approved (no approval needed)
4. Platform fees deducted from subscriber account
5. Signers notified immediately (no approval delay)
```

### User Interface Enhancements

#### Job Creation Wizard
- **Different messaging** based on user type
- **Subscriber view**: "Create job for your personal clients"
- **Admin/Title Company view**: "Create title company job"
- **Notary assignment step**: Hidden for subscribers (they're auto-assigned)

#### Visual Indicators
- **Blue theme** for subscriber personal jobs
- **Green theme** for title company jobs
- **Clear messaging** about billing and assignment

## API Endpoints

### Job Creation
```typescript
POST /api/jobs
// Permission check:
userCanCreateJob = 
  req.user.role === 'admin' ||
  req.user.role === 'title_company' ||
  (req.user.role === 'notary' && req.user.notaryType === 'subscriber')
```

### Response Enhancement
```json
{
  "jobType": "subscriber_personal" | "title_company",
  "assignedNotary": {
    "id": number,
    "name": string,
    "notaryType": "contractor" | "subscriber"
  }
}
```

## Billing Differentiation

### Title Company Jobs
- Client pays USA Notary
- Contractor notary receives 55% of total fee
- Platform keeps 45% + witness fees
- Payment often delayed until title company pays

### Subscriber Personal Jobs  
- Subscriber pays platform fees:
  - Base: $10.00 (includes 1 ID verification + 20 min session)
  - Additional ID: $2.00 each
  - Extended time: $5.00 per 10 minutes over 20
- Subscriber keeps whatever they charge their clients
- Fees deducted immediately upon job completion

## Migration Required

Run the migration to add the new database fields:

```bash
# Run against your database
psql -f migration-add-job-type-field.sql
```

## Benefits

### For Contractor Notaries
- ✅ Clear workflow - only get assigned jobs
- ✅ No job creation confusion
- ✅ Approval process maintains quality control
- ✅ Payment from client fees (no personal expense)

### For Subscriber Notaries
- ✅ Can bring their own business to platform
- ✅ Simple self-assignment workflow
- ✅ Immediate job processing (no approval delays)
- ✅ Transparent fee structure

### For Title Companies
- ✅ Only contractor notaries available for assignment
- ✅ Quality control through approval process
- ✅ Preferred notary system works as expected

### For Platform
- ✅ Clear revenue streams from both models
- ✅ Proper workflow separation prevents conflicts
- ✅ Scalable system supports growth in both segments

## Example Workflows

### Contractor Workflow
```
Title Company → Creates Job → System assigns Contractor → 
Contractor approves → Signers notified → Job completed → 
Contractor paid 55% of client fee
```

### Subscriber Workflow  
```
Subscriber → Creates personal job → Auto-assigned to self →
Signers immediately notified → Job completed →
Platform fees deducted from subscriber account
```

This implementation ensures clear separation between the two business models while maintaining a unified platform experience. 