# BlueAssure Platform Integration Guide

## Updated BlueAssure Platform API v3.0.0 Integration

The platform now uses **BlueAssure Platform API v3.0.0** directly for identity verification with production credentials.

### Environment Variables

Set these in your `.env` file:

```bash
# BlueAssure Platform API Credentials (Production)
EVS_API_KEY="E27235-CE567A22-0D31-474A-B551-252882763208"  # Username for API
EVS_PASSWORD="8aeWPi0XV#AyS#I"                            # Password for API
EVS_ENVIRONMENT="production"
```

### Your BlueAssure Plans

✅ **AssureCard Plan**: IdentiFraud Card with KBA
- Features: Document validation, biometric matching, AssureID, KBA Questions, AssurePhone
- Use Case: Primary identity verification with document scanning

✅ **AssureID Plan**: Identifraud Consumer+ w/KBA  
- Features: Identity verification, KBA Questions, AssurePhone
- Use Case: Backup verification method using personal information

### Key Features

✅ **BlueAssure Platform API v3.0.0** - Official API integration
✅ **AssureCard Product** - Document verification with biometric matching
✅ **AssureID Product** - Identity verification with KBA questions
✅ **DirectImageUpload** - Real-time document processing
✅ **Biometric Face Matching** - Selfie to ID photo comparison
✅ **Document Data Extraction** - Name, DOB, address, document details
✅ **Workflow Engine** - Pass/Fail/Review decision making

### API Endpoints Used

**Primary Product - AssureCard:**
- **Endpoint**: `https://blueassure.evssolutions.com/WebServices/Integrated/Main/V300/AssureCard`
- **Method**: POST with JSON payload
- **Features**: Document validation, data extraction, biometric matching

**Backup Product - AssureID:**
- **Endpoint**: `https://blueassure.evssolutions.com/WebServices/Integrated/Main/V300/AssureId`
- **Method**: POST with JSON payload  
- **Features**: Identity verification, KBA questions, phone verification

### Request Format (BlueAssure API v3.0.0)

```json
{
  "meta": {
    "credentials": {
      "username": "E27235-CE567A22-0D31-474A-B551-252882763208",
      "password": "8aeWPi0XV#AyS#I"
    },
    "customerReference": "NOTARY_1234567890_user123"
  },
  "data": {
    "scanMode": "DirectImageUpload",
    "documentType": "DriversLicense",
    "frontImage": "base64_encoded_image_data",
    "backImage": "base64_encoded_image_data", 
    "portraitImage": "base64_encoded_selfie_data"
  }
}
```

### Response Format

```json
{
  "meta": {
    "transactionId": 134890,
    "transactionDate": "2023-12-05T22:53:17.823",
    "productName": "AssureCard",
    "productVersion": "3.0.0",
    "customerReference": "NOTARY_1234567890_user123"
  },
  "data": {
    "workflowOutcome": {
      "code": "P",
      "description": "Pass"
    },
    "assureCard": {
      "validationResult": {
        "code": "0",
        "description": "The document has passed the check."
      },
      "totalConfidence": 95,
      "documentInformation": {
        "licenseNumber": "P12345678",
        "expirationDate": "2100-01-31",
        "issueDate": "2010-01-31"
      },
      "documentName": {
        "firstName": "JOHN",
        "lastName": "TEST"
      }
    }
  }
}
```

### Verification Flow

1. **Document Upload**: User uploads ID documents (front, back) and selfie photo
2. **AssureCard Processing**: BlueAssure validates document authenticity and extracts data
3. **Biometric Matching**: Selfie photo compared to ID photo for face match
4. **Workflow Decision**: Pass (P), Fail (F), or Review (R) based on confidence scores
5. **Database Storage**: Results stored with comprehensive verification data
6. **User Status Update**: Verification status updated immediately

### Confidence Thresholds

Based on BlueAssure workflow outcomes:
- **Pass (P)**: High confidence verification - user approved
- **Fail (F)**: Low confidence verification - user denied  
- **Review (R)**: Medium confidence - manual review required

### Document Types Supported

- **DriversLicense**: Driver's license (front and back required)
- **PassportBook**: Passport book (front only)
- **State ID**: State-issued ID card (processed as driver's license)

### Integration Architecture

```
Frontend Component
       ↓ (upload images)
API Route (/api/verification/evs-verify)
       ↓ (process request)
EVS Service (evs-service.ts)
       ↓ (format BlueAssure request)
BlueAssure Platform API v3.0.0
       ↓ (return verification results)
Database Update (user verification status)
```

## API Credentials

Your BlueAssure Platform configuration:
- **Username (API Key)**: `E27235-CE567A22-0D31-474A-B551-252882763208`
- **Password**: `8aeWPi0XV#AyS#I`
- **Status**: Production Environment - Active
- **Products**: AssureCard, AssureID with KBA

## Environment Configuration

### 1. Production Configuration

```bash
# BlueAssure Platform Production
EVS_API_KEY="E27235-CE567A22-0D31-474A-B551-252882763208"
EVS_PASSWORD="8aeWPi0XV#AyS#I"
EVS_ENVIRONMENT="production"
```

### 2. Testing Configuration

For testing, BlueAssure provides special test data values that return canned responses:

**Test SSNs (for AssureID):**
- `222222222` - Returns "Pass" workflow outcome
- `333333333` - Returns "Fail" workflow outcome  
- `444444444` - Returns "Needs Further Review" outcome

**Test Images (for AssureCard):**
- Green Smile image - Returns "Pass" workflow outcome
- Red Smile image - Returns "Fail" workflow outcome
- Yellow Smile image - Returns "Review" workflow outcome

## Integration Features

### ✅ Implemented Features

1. **BlueAssure Platform API v3.0.0 Integration**
   - Uses official BlueAssure endpoints with proper JSON format
   - Supports both AssureCard and AssureID products
   - Handles meta/data request structure correctly

2. **Document Types Supported**
   - Driver's License (front and back scanning)
   - Passport Book (front scanning)
   - State ID Card (processed as driver's license)

3. **Verification Process**
   - DirectImageUpload mode for real-time processing
   - Document authenticity validation
   - Data extraction (name, DOB, address, document details)
   - Biometric face matching between selfie and ID photo
   - Workflow engine decisions (Pass/Fail/Review)

4. **Response Handling**
   - Success: User marked as verified with extracted data
   - Failure: User marked as failed with specific error details
   - Review: Pending status for manual review cases
   - Error: Proper error handling with detailed messages

### 🔧 Configuration Options

The EVS service automatically:
- Uses BlueAssure Platform API v3.0.0 format
- Handles username/password authentication in request body
- Processes workflow outcomes (P/F/R codes)
- Extracts document and biometric data
- Provides detailed error messages and troubleshooting

## Testing the Integration

### 1. Run Integration Tests
```bash
npm run evs:test
```

### 2. Test Individual Components
```bash
# Test configuration
npm run test:evs:config

# Test connectivity  
npm run test:evs:connection

# Test verification
npm run test:evs:verify
```

### 3. Production Testing
- Uses real BlueAssure Platform API
- Processes actual document images
- Returns live verification results
- Stores comprehensive data in database

## API Response Mapping

The system maps BlueAssure responses to our format:

### Successful Verification (AssureCard)
```json
{
  "success": true,
  "status": "approved",
  "confidence": 95,
  "transactionId": "134890",
  "document": {
    "type": "drivers_license",
    "extractedData": {
      "firstName": "JOHN",
      "lastName": "TEST", 
      "dateOfBirth": "1990-01-31",
      "documentNumber": "P12345678",
      "expirationDate": "2100-01-31",
      "address": "123 MAIN ST, FRANKFORT, KY, 40601"
    }
  },
  "biometric": {
    "faceMatch": true,
    "confidence": 95,
    "livenessScore": 95
  }
}
```

## Error Handling

### 1. API Configuration Errors
- Missing username (EVS_API_KEY)
- Missing password (EVS_PASSWORD)  
- Invalid credentials format
- Network connectivity issues

### 2. BlueAssure API Errors
- Authentication failures (401/403)
- Product access restrictions  
- Invalid request format
- Service unavailability

### 3. Document Processing Errors
- Poor image quality
- Unsupported document types
- Failed document validation
- Biometric matching failures

## Usage in the Application

### For Signers and Witnesses
1. User creates account
2. Dashboard shows "Verification Required" status
3. User clicks "Verify ID" button  
4. BlueAssure verification component loads
5. User uploads ID documents and takes selfie
6. BlueAssure processes verification through AssureCard API
7. Database updated with verification status and extracted data
8. User can join sessions once verified

### API Endpoints
- `POST /api/verification/evs-verify` - Main verification endpoint
- Uses BlueAssure Platform API v3.0.0 automatically
- Handles file uploads and processing
- Returns standardized responses

## Monitoring and Logs

### Verification Attempts
All verification attempts are logged with:
- User ID and role
- BlueAssure transaction ID
- Workflow outcome and confidence scores
- Document data and biometric results
- Error messages and troubleshooting details
- Timestamp and processing duration

### BlueAssure Service Logs
- API request/response logging with proper format
- Error tracking and detailed troubleshooting
- Performance monitoring and response times
- Configuration validation results

## Security Features

### Data Protection
- ID images processed but not permanently stored
- Secure transmission to BlueAssure Platform
- Encrypted HTTPS communications with TLS 1.2
- Compliance with privacy regulations

### Access Control
- Only signers and witnesses require verification
- Role-based verification enforcement
- Session access tied to verification status
- Audit trail for all verification attempts

## Support and Troubleshooting

### Common Issues

1. **"BlueAssure API authentication failed"**
   - Check username (EVS_API_KEY) and password in `.env` file
   - Verify credentials are for production environment
   - Contact BlueAssure support if credentials are correct

2. **"Document validation failed"**
   - Ensure good image quality (800x600px minimum)
   - Check document type is supported (DriversLicense, PassportBook)
   - Verify lighting and clarity of document images

3. **"Network error: Cannot reach BlueAssure servers"**
   - Check internet connectivity
   - Verify firewall allows access to blueassure.evssolutions.com
   - Ensure HTTPS traffic is not blocked

### Getting Help

1. **BlueAssure Platform Support**
   - Contact EVS Solutions for API issues
   - Verify account status and product access
   - Get technical support for integration problems

2. **Application Support** 
   - Check server logs for detailed errors
   - Verify database connectivity
   - Review verification attempt logs

## Next Steps

1. **Test the integration** with your BlueAssure credentials
2. **Verify products are active** (AssureCard and AssureID)
3. **Test verification flow** with real documents
4. **Monitor verification success rates**
5. **Enable production use** when ready

Your BlueAssure Platform integration is now ready to use with real identity verification using AssureCard and AssureID products!

## Configuration Validation

The system automatically validates your BlueAssure configuration on startup:
- ✅ Username (API key) present and valid format
- ✅ Password configured
- ✅ API endpoints accessible
- ✅ Environment setting valid
- ✅ Products available (AssureCard, AssureID)

Any configuration issues will be logged and reported during verification attempts. 