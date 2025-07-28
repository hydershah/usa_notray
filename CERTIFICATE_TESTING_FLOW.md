# Digital Certificate Attachment Testing Flow

## Overview
This document outlines the complete testing flow for digital certificate attachment during PDF signing in the USA Notary platform.

## Test Environment Setup

### Prerequisites
1. Server running with certificate services initialized
2. Redis cache operational
3. Database with test users (notary, signer, witness roles)
4. Test PDF documents available
5. Certificate Authority (CA) properly configured

### Test Data Requirements
- Test notary user (verified, active commission)
- Test signer users (ID verified)
- Test witness users (ID verified) 
- Sample PDF documents for signing
- Mock job data for signing sessions

## Test Flow 1: Certificate Generation

### 1.1 Notary Certificate Generation
**Endpoint**: `POST /api/certificates/generate/notary`
**Test Steps**:
1. Login as verified notary user
2. Request certificate generation
3. Verify certificate is created with:
   - Valid P12 file path
   - Correct expiry date (2 years)
   - Proper notary commission details
   - Active status in database

**Expected Results**:
```json
{
  "success": true,
  "certificateId": 123,
  "p12Path": "/certs/notary_123.p12",
  "p12Password": "generated_password"
}
```

### 1.2 Signer Certificate Generation
**Endpoint**: `POST /api/certificates/generate/signer`
**Test Steps**:
1. Login as verified signer user
2. Request certificate generation
3. Verify certificate created with:
   - 1-year validity period
   - "Document Signer" organizational unit
   - Proper user verification status

### 1.3 Certificate Validation
**Endpoint**: `GET /api/certificates/validate/:userId`
**Test Steps**:
1. Generate certificate for user
2. Validate certificate against CA
3. Check expiry status
4. Verify near-expiry warnings

## Test Flow 2: Certificate Status Management

### 2.1 Certificate Status Card Testing
**Component**: `CertificateStatusCard.tsx`
**Test Steps**:
1. Load job with multiple participants
2. Check certificate status for each participant:
   - ✅ Valid certificates show green checkmark
   - ❌ Missing certificates show red alert
   - ⚠️ Expired certificates show yellow warning
   - 📋 No certificate required shows gray icon

### 2.2 Certificate Generation UI
**Test Steps**:
1. Click "Generate Certificate" button
2. Verify loading state during generation
3. Check success message and status update
4. Confirm certificate details displayed correctly

## Test Flow 3: PDF Signing with Digital Certificates

### 3.1 Live Signing Session Setup
**Page**: `/live-signing?jobId=123`
**Test Steps**:
1. Start live signing session
2. Verify all participants have valid certificates
3. Check certificate status indicators
4. Confirm job can proceed only if all certificates valid

### 3.2 Digital Signature Application
**Service**: `DigitalSignatureService`
**Test Steps**:
1. Complete document tagging/filling
2. Trigger document completion
3. Verify digital signatures applied:
   - Each participant's certificate used
   - Signatures embedded in PDF
   - Signature metadata stored in database

**Expected Process**:
```typescript
// 1. Get signing participants
const participants = await getSigningParticipants(jobId);

// 2. Get certificates for participants  
const certificates = await getCertificatesForParticipants(participants);

// 3. Apply digital signatures to PDF
const signedPdf = await applyDigitalSignaturesToPDF(pdfBuffer, certificates);

// 4. Store signature records
await storeSignatureRecords(signatures, jobId, sessionId);
```

### 3.3 Signature Verification
**Endpoint**: `POST /api/digital-signatures/verify`
**Test Steps**:
1. Upload signed PDF
2. Verify signatures are valid
3. Check signature details match stored records
4. Confirm certificate chain validation

## Test Flow 4: End-to-End Certificate Flow

### 4.1 Complete Signing Session
**Test Scenario**: Notary + 2 Signers + 1 Witness
**Steps**:

1. **Setup Phase**:
   - Generate certificates for all participants
   - Verify certificate status shows "Valid" for all
   - Start live signing session

2. **Signing Phase**:
   - Complete document tagging
   - Fill all required fields
   - Apply signatures and notary seal
   - Complete session

3. **Verification Phase**:
   - Download completed PDF
   - Verify digital signatures present
   - Check signature details in database
   - Validate certificate chain

### 4.2 Certificate Expiry Handling
**Test Steps**:
1. Create certificate with near-expiry date
2. Verify warning displayed in UI
3. Test signing with expired certificate (should fail)
4. Generate new certificate and retry

### 4.3 Missing Certificate Handling
**Test Steps**:
1. Remove certificate for one participant
2. Verify job cannot start
3. Check error messages displayed
4. Generate missing certificate
5. Verify job can now proceed

## Test Flow 5: API Testing

### 5.1 Certificate Management Endpoints
```bash
# Get job signatures
GET /api/digital-signatures/job/:jobId

# Verify PDF signatures  
POST /api/digital-signatures/verify

# Generate notary certificate
POST /api/certificates/generate/notary

# Validate certificate
GET /api/certificates/validate/:userId
```

### 5.2 Error Handling Tests
**Test Scenarios**:
- Invalid user ID for certificate generation
- Unverified user attempting certificate generation
- Certificate generation for user with existing certificate
- PDF signing with invalid/expired certificates
- Signature verification with corrupted PDF

## Test Flow 6: Security Testing

### 6.1 Certificate Security
**Test Steps**:
1. Verify P12 files have strong passwords
2. Check certificate serial numbers are unique
3. Validate certificate chain against CA
4. Test certificate revocation (if implemented)

### 6.2 Signature Integrity
**Test Steps**:
1. Modify signed PDF and verify signatures become invalid
2. Test signature tampering detection
3. Verify signature timestamps
4. Check non-repudiation capabilities

## Success Criteria

### Certificate Generation
- ✅ All user roles can generate certificates when verified
- ✅ Certificates have appropriate validity periods
- ✅ Certificate details stored correctly in database
- ✅ P12 files created with secure passwords

### PDF Signing
- ✅ Digital signatures applied to completed PDFs
- ✅ All participant certificates included
- ✅ Signature metadata stored in database
- ✅ Signed PDFs pass signature verification

### UI/UX
- ✅ Certificate status clearly displayed
- ✅ Missing certificates prevent job start
- ✅ Certificate generation flows work smoothly
- ✅ Error states handled gracefully

### Security
- ✅ Certificates properly validated against CA
- ✅ Signature tampering detected
- ✅ Certificate expiry enforced
- ✅ Access controls respected

## Testing Commands

```bash
# Start test environment
npm run dev

# Run certificate service tests
npm run test:certificates

# Test PDF signing flow
npm run test:pdf-signing

# Verify digital signatures
npm run test:signature-verification
```

## Expected Test Results

After running all tests, you should see:
1. All participants can generate certificates when verified
2. Certificate status UI accurately reflects certificate states
3. PDF signing attaches digital signatures successfully
4. Signed PDFs pass signature verification
5. Security measures prevent unauthorized access and tampering

This comprehensive test flow ensures the digital certificate attachment system works correctly across all use cases and edge scenarios. 