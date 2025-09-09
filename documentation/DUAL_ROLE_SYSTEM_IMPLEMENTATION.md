# Dual Role System Implementation

## Overview

The dual role system allows users to have different roles within different jobs while maintaining their primary system role. This solves the problem where a user with a primary role (like 'notary' or 'title_company') also needs to act as a 'signer' for a specific job, which requires ID verification.

## Problem Statement

Previously, users had a single fixed role in the system:
- **Notaries** had role 'notary' - no ID verification required
- **Title Company employees** had role 'title_company' - no ID verification required  
- **Signers** had role 'signer' - ID verification required

**The Issue**: When a notary or title company employee needed to sign documents (act as a signer), they couldn't do so because:
1. They didn't have ID verification (not required for their primary role)
2. The system didn't support users having multiple roles

## Solution: Job-Specific Role Assignment

### Key Concepts

1. **Primary Role**: User's main role in the system (e.g., 'notary', 'title_company', 'client')
2. **Job-Specific Role**: User's role for a particular job (e.g., 'signer', 'witness', 'observer')
3. **Dual Role**: When a user's job-specific role differs from their primary role
4. **Job-Specific Verification**: Verification requirements based on the job-specific role, not the primary role

### Architecture

```
User (Primary Role: notary) 
├── Job A: Role = notary (no verification needed)
├── Job B: Role = signer (verification required)
└── Job C: Role = witness (verification required)
```

## Database Schema Changes

### Enhanced Tables

#### 1. `job_participants` Table
```sql
-- New fields added:
job_specific_role text,           -- Role for this specific job
primary_role text,                -- User's primary system role  
requires_id_verification boolean, -- Whether this participant needs verification
id_verification_completed boolean,-- Whether verification is completed
id_verification_completed_at timestamp,
id_verification_bypass_reason text,
id_verification_bypassed_by integer REFERENCES users(id),
id_verification_bypassed_at timestamp
```

#### 2. `signers` Table
```sql
-- New fields added:
primary_user_role text,           -- User's primary system role
requires_id_verification boolean, -- Whether this signer needs verification
id_verification_completed boolean,-- Whether verification is completed
id_verification_completed_at timestamp,
id_verification_method text       -- 'evs', 'admin_bypass', 'notary_bypass'
```

### Migration Script
- Location: `migrations/add-job-specific-roles.sql`
- Automatically updates existing records with appropriate defaults
- Creates helpful views for querying participant roles

## Core Components

### 1. Verification Middleware (`server/middleware/dual-role-verification.ts`)

**Key Functions:**
- `checkJobSpecificVerificationNeeded()`: Determines if verification is needed based on job-specific role
- `requireJobSpecificVerification()`: Middleware to enforce verification requirements
- `getJobSpecificVerificationStatus()`: Get verification status for UI display

**Usage:**
```typescript
// Check if user needs verification for their role in a specific job
const verificationCheck = await checkJobSpecificVerificationNeeded(
  userId, 
  jobId, 
  'signer' // job-specific role
);

if (verificationCheck.needsVerification && !verificationCheck.isVerified) {
  // User needs to complete verification
}
```

### 2. Verification Service (`server/services/dual-role-verification-service.ts`)

**Key Methods:**
- `getVerificationRequirements()`: Get complete verification info for a user/job
- `updateVerificationStatus()`: Update verification status with bypass options
- `canAccessSession()`: Check if user can access signing sessions
- `getJobParticipantsWithVerification()`: Get all participants with verification status

### 3. Enhanced UI Components

#### `EnhancedJobSignersManager` (`client/src/components/job/EnhancedJobSignersManager.tsx`)

**Features:**
- Role selection for job-specific roles (signer, witness, observer)
- Automatic user lookup by email
- Dual role visualization with badges
- Verification status indicators
- Admin bypass options

**Job-Specific Roles:**
- **Signer**: Signs documents - requires ID verification
- **Witness**: Witnesses signatures - requires ID verification  
- **Observer**: Observes session - no verification required

### 4. API Routes (`server/routes/enhanced-participant-routes.ts`)

**New Endpoints:**
- `GET /api/jobs/:jobId/participants/enhanced` - Get participants with dual role info
- `POST /api/jobs/:jobId/participants/enhanced` - Add participant with role assignment
- `PUT /api/jobs/:jobId/participants/:id/enhanced` - Update participant role
- `GET /api/jobs/:jobId/users/:userId/verification-status` - Get verification status
- `GET /api/users/lookup` - User lookup for participant assignment

## Verification Logic Flow

### 1. Role-Based Verification Requirements

```typescript
const ROLES_REQUIRING_VERIFICATION = ['signer', 'witness'];

// Check if job-specific role requires verification
const needsVerification = ROLES_REQUIRING_VERIFICATION.includes(jobSpecificRole);
```

### 2. Verification Status Hierarchy

1. **Job-Specific Verification** (highest priority)
   - Tracked in `job_participants.id_verification_completed`
   - Specific to the user's role in that job

2. **User-Level Verification** (fallback)
   - EVS verification (`users.is_verified`)
   - Admin bypass (`users.is_verification_bypassed`)
   - Notary bypass (`users.notary_verification_bypassed`)

### 3. Session Access Logic

```typescript
// Updated session access check in storage.ts
const jobSpecificRole = participant.jobSpecificRole || user.role;
const requiresVerification = ['signer', 'witness'].includes(jobSpecificRole);

if (requiresVerification) {
  const isJobSpecificVerified = participant.id_verification_completed;
  const isUserLevelVerified = user.is_verified || user.is_verification_bypassed;
  
  if (!isJobSpecificVerified && !isUserLevelVerified) {
    return false; // Access denied
  }
}
```

## Usage Examples

### Example 1: Notary as Signer

**Scenario**: A notary needs to sign documents in a job

**Implementation:**
1. Add notary to job with job-specific role "signer"
2. System detects dual role (primary: notary, job: signer)
3. Verification required because job role is "signer"
4. Notary completes ID verification or gets admin bypass
5. Notary can now access signing session

**Database State:**
```sql
-- job_participants table
job_id: 123
user_id: 456
primary_role: 'notary'
job_specific_role: 'signer'
requires_id_verification: true
id_verification_completed: true
```

### Example 2: Title Company Employee as Witness

**Scenario**: Title company employee needs to witness signatures

**Implementation:**
1. Add employee with job-specific role "witness"
2. System requires verification for witness role
3. Admin can bypass verification with reason
4. Employee can access session as witness

### Example 3: Regular Signer (No Dual Role)

**Scenario**: Regular signer (primary role = signer)

**Implementation:**
1. Add user with job-specific role "signer"
2. No dual role (primary = job role)
3. Uses existing verification flow
4. Backward compatible with current system

## UI/UX Enhancements

### 1. Role Selection Interface

- **Job-Specific Role Selector**: Choose signer, witness, or observer
- **Traditional Role Selector**: For signers, choose borrower, seller, etc.
- **Verification Indicator**: Shows if verification is required
- **Dual Role Badge**: Highlights when roles differ

### 2. Verification Status Display

```typescript
// Verification status badges
const getVerificationStatusBadge = (participant) => {
  switch (participant.verificationStatus) {
    case 'verified': return <Badge>✓ Verified</Badge>;
    case 'verification_required': return <Badge>⚠ Verification Required</Badge>;
    case 'no_verification_needed': return <Badge>ℹ No Verification Needed</Badge>;
  }
};
```

### 3. User Lookup and Auto-Population

- **Email-based lookup**: Find existing users by email
- **Auto-populate**: Fill in user details automatically
- **Role detection**: Show user's primary role
- **Dual role warning**: Alert when assigning different job role

## Migration Strategy

### Phase 1: Database Migration
1. Run `migrations/add-job-specific-roles.sql`
2. Existing records automatically updated with defaults
3. New fields populated based on current roles

### Phase 2: Gradual UI Rollout
1. Feature flag: `showDualRoleOptions` in components
2. Existing job management continues to work
3. New enhanced components available for testing

### Phase 3: Full Integration
1. Update all job creation flows
2. Enable enhanced participant management
3. Train users on new dual role features

## Security Considerations

### 1. Verification Bypass Controls

- **Admin Only**: Only admins can bypass verification requirements
- **Audit Trail**: All bypasses logged with reason and timestamp
- **Job-Specific**: Bypasses are specific to job roles, not global

### 2. Role Assignment Permissions

- **Restricted Access**: Only admins, notaries, and title companies can assign roles
- **Self-Assignment Prevention**: Users cannot assign roles to themselves
- **Verification Enforcement**: System enforces verification based on job role

### 3. Session Access Controls

- **Dual Verification**: Checks both job-specific and user-level verification
- **Role-Based Access**: Access permissions based on job-specific role
- **Profile Completion**: Ensures users complete required profile setup

## Testing Strategy

### 1. Unit Tests
- Verification logic functions
- Role assignment validation
- Session access controls

### 2. Integration Tests
- End-to-end job creation with dual roles
- Verification workflow testing
- API endpoint testing

### 3. User Acceptance Testing
- Notary-as-signer scenarios
- Title company employee workflows
- Admin bypass procedures

## Performance Considerations

### 1. Database Queries
- Indexed fields for role lookups
- Efficient joins between users and participants
- Cached verification status where appropriate

### 2. UI Performance  
- Lazy loading of participant lists
- Debounced user lookup
- Optimistic UI updates

### 3. Memory Usage
- Minimal additional data structures
- Efficient role checking algorithms
- Cleanup of unused verification records

## Monitoring and Analytics

### 1. Metrics to Track
- Dual role usage frequency
- Verification completion rates
- Bypass usage patterns
- Session access failures

### 2. Alerts
- High verification failure rates
- Unusual bypass activity
- Session access errors

### 3. Reporting
- Dual role adoption rates
- Verification method preferences
- User experience feedback

## Future Enhancements

### 1. Advanced Role Management
- Custom role definitions
- Role templates for common scenarios
- Bulk role assignments

### 2. Enhanced Verification
- Role-specific verification methods
- Progressive verification levels
- Automated verification routing

### 3. Workflow Integration
- Approval workflows for role assignments
- Automated role suggestions
- Integration with external verification services

## Troubleshooting

### Common Issues

#### 1. User Cannot Access Session
**Symptoms**: "Verification required" error
**Check**: 
- User's job-specific role in `job_participants`
- Verification status for that role
- Profile completion status

**Solution**: Complete verification or admin bypass

#### 2. Dual Role Not Showing
**Symptoms**: User shows same role everywhere
**Check**:
- `job_participants.job_specific_role` vs `primary_role`
- Feature flag `showDualRoleOptions`
- Component props

**Solution**: Update role assignment or enable feature flag

#### 3. Verification Bypass Not Working
**Symptoms**: Still requires verification after bypass
**Check**:
- `id_verification_completed` in job_participants
- Admin permissions for user performing bypass
- Bypass reason and timestamp

**Solution**: Re-run bypass with proper admin credentials

### Debug Tools

#### 1. Verification Status API
```bash
GET /api/jobs/{jobId}/users/{userId}/verification-status
```

#### 2. Participant Role Summary
```bash  
GET /api/jobs/{jobId}/participants/enhanced
```

#### 3. Database Views
```sql
SELECT * FROM participant_role_summary WHERE job_id = 123;
```

## Support and Documentation

### 1. User Guides
- How to add participants with different roles
- Understanding verification requirements
- Using admin bypass features

### 2. Developer Documentation
- API reference for dual role endpoints
- Integration guide for new components
- Database schema documentation

### 3. Training Materials
- Video tutorials for common scenarios
- Best practices for role assignment
- Troubleshooting guide for support staff
