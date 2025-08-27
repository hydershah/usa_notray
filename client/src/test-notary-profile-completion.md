# Notary Profile Completion Testing Guide

## Overview
This document outlines the testing steps for the new notary profile completion overlay functionality.

## Implementation Summary

### Components Created:
1. **NotaryProfileCompletionOverlay** - Multi-step overlay for notary profile completion
2. **useNotaryProfileCompletion** - Hook to manage notary profile completion status
3. **Enhanced AccountCompletionWrapper** - Updated to handle both signer and notary overlays

### Backend Changes:
1. **Enhanced profile validation** - Added notary-specific profile completion checking
2. **Role-based requirements** - Different completion criteria for notaries vs signers/witnesses

## Test Cases

### Test Case 1: New Notary Registration Flow
1. Create a new notary account
2. Log in as the notary
3. Verify the notary profile completion overlay appears immediately
4. Fill out all required fields in the 3-step process:
   - Personal Information
   - Notary Credentials 
   - Document Upload
5. Submit the profile
6. Verify the profile is marked as submitted and pending approval

### Test Case 2: Existing Notary with Incomplete Profile
1. Log in as an existing notary with incomplete profile
2. Verify the overlay appears
3. Pre-populated fields should show existing data
4. Complete missing fields
5. Submit and verify completion

### Test Case 3: Notary Profile Completion Progress Persistence
1. Start filling out the overlay
2. Close browser/logout mid-completion
3. Log back in
4. Verify the overlay shows with previously entered data
5. Complete the remaining steps

### Test Case 4: Non-Notary Users (Control Test)
1. Log in as signer/witness with incomplete profile
2. Verify the standard AccountCompletionOverlay appears (not notary overlay)
3. Complete signer profile
4. Verify completion works as before

### Test Case 5: Admin Users with Notary Role
1. Log in as admin user who also has notary privileges
2. Verify appropriate overlay appears based on primary role
3. Test completion flow

### Test Case 6: Dashboard Access Prevention
1. Log in as notary with incomplete profile
2. Try to access dashboard directly via URL
3. Verify overlay prevents access to dashboard
4. Complete profile and verify dashboard access is granted

## Required Test Data

### Notary Test Account:
- Username: notary1
- Email: notary1@test.com
- Role: notary
- Incomplete profile (missing required notary fields)

### Expected Required Fields:
- Personal: firstName, lastName, phoneNumber, address1, city, state, zipCode
- Notary: nameOnCommission, commissionNumber, commissionExpiration, commissionState
- Documents: commissionFile, eoInsuranceFile, digitalCertificateFile, bondFile

## API Endpoints to Test

### Profile Status Check:
```
GET /api/notary/profile/status
```
Should return profile completion status and missing fields.

### Profile Update:
```
PUT /api/users/:id/profile
```
Should update profile and set accountSetupComplete for notaries when all required fields are present.

### Document Upload:
```
POST /api/notary/profile/upload-documents
```
Should handle file uploads for notary documents.

### Profile Completion:
```
POST /api/notary/profile/complete
```
Should finalize notary profile and mark as submitted.

## Success Criteria

### Frontend:
- ✅ Overlay appears for notaries with incomplete profiles
- ✅ Multi-step form with validation works correctly
- ✅ File upload functionality works
- ✅ Progress persistence across sessions
- ✅ Dashboard access properly blocked until completion
- ✅ No interference with signer/witness completion flow

### Backend:
- ✅ Role-based profile completion validation
- ✅ Proper accountSetupComplete flag setting
- ✅ Profile submission tracking
- ✅ Document upload handling

## Verification Steps

1. **Database Verification:**
   - Check `accountSetupComplete` flag is set to `true` after completion
   - Check `profileSubmitted` flag is set to `true` for notaries
   - Verify all profile fields are saved correctly
   - Verify document file paths are stored

2. **User Experience Verification:**
   - Smooth transition between overlay steps
   - Clear validation messages
   - Proper loading states during submission
   - Successful completion feedback

3. **Security Verification:**
   - Only notary users see notary overlay
   - Profile data is properly validated server-side
   - File uploads are secure and validated
   - Proper authentication required for all endpoints

## Potential Issues to Watch For

1. **Case Sensitivity:** Database field names vs frontend form field names
2. **Date Formatting:** Commission expiration date format consistency
3. **File Upload:** Proper handling of file size limits and types
4. **State Management:** Overlay state management across route changes
5. **Role Conflicts:** Users with multiple roles (admin + notary)

## Notes

- The overlay should be non-dismissible for notaries until profile is complete
- File uploads use Vultr cloud storage
- Profile completion is required before accessing notary dashboard
- Admin approval is still required after profile completion
