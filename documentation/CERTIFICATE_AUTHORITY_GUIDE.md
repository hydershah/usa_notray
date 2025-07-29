# Certificate Authority & Digital Certificate System

## Overview

The USA Notary Platform includes a complete Certificate Authority (CA) and digital certificate management system that enables secure digital document signing and notarization. This system generates, manages, and validates X.509 digital certificates for notary users.

## 🔧 System Architecture

### Components

1. **Certificate Authority (CA)** - Self-signed root CA for issuing user certificates
2. **Certificate Service** - High-level service for certificate management
3. **Certificate Routes** - RESTful API endpoints for certificate operations
4. **Certificate Manager UI** - React component for user interface
5. **Database Integration** - Certificate storage and tracking

### Technology Stack

- **OpenSSL** - Certificate generation and cryptographic operations
- **X.509 Standard** - Digital certificate format
- **PKCS#12** - Certificate packaging for easy installation
- **Node.js/TypeScript** - Backend implementation
- **React/TypeScript** - Frontend interface
- **PostgreSQL** - Certificate metadata storage

## 🚀 Setup & Installation

### Prerequisites

1. **OpenSSL** must be installed and accessible in PATH
   ```bash
   # macOS
   brew install openssl
   
   # Ubuntu/Debian
   sudo apt-get install openssl
   
   # Windows
   # Download from https://slproweb.com/products/Win32OpenSSL.html
   ```

2. **Node.js** and **npm** installed
3. **PostgreSQL** database configured

### Initial Setup

1. **Run the setup script:**
   ```bash
   npm run setup-certificates
   # or
   npx ts-node scripts/setup-certificates.ts
   ```

   This script will:
   - Check OpenSSL availability
   - Create the `certs/` directory
   - Initialize the Certificate Authority
   - Create database tables
   - Generate CA private key and certificate
   - Test certificate generation (if approved notaries exist)

2. **Verify setup:**
   ```bash
   ls -la certs/
   # Should show:
   # ca-key.pem (CA private key)
   # ca-cert.pem (CA certificate)
   ```

## 📋 API Reference

### Authentication
All endpoints require JWT authentication via the `Authorization: Bearer <token>` header.

### Endpoints

#### Generate Certificate (Self-Service)
```http
POST /api/certificates/generate-self
Authorization: Bearer <token>
```
**Purpose:** Allows approved notaries to generate their own certificates
**Access:** Notary users only
**Returns:**
```json
{
  "success": true,
  "message": "Certificate generated successfully",
  "certificateId": 123,
  "downloadUrl": "/api/certificates/download/456",
  "password": "abc123"
}
```

#### Generate Certificate (Admin)
```http
POST /api/certificates/generate/:userId
Authorization: Bearer <token>
```
**Purpose:** Allows admins to generate certificates for any notary
**Access:** Admin only

#### Validate Certificate
```http
GET /api/certificates/validate/:userId
Authorization: Bearer <token>
```
**Purpose:** Validates a user's certificate against the CA
**Access:** Self or Admin
**Returns:**
```json
{
  "valid": true,
  "expired": false,
  "nearExpiry": false,
  "daysRemaining": 1095,
  "details": {
    "subject": "CN=John Doe,OU=Notary,O=USA Notary Platform...",
    "issuer": "CN=USA Notary CA,OU=Digital Notary Services...",
    "serialNumber": "ABC123",
    "validFrom": "Jan 1 00:00:00 2024 GMT",
    "validTo": "Jan 1 00:00:00 2027 GMT"
  }
}
```

#### Download Certificate
```http
GET /api/certificates/download/:userId?type=p12
Authorization: Bearer <token>
```
**Purpose:** Downloads the certificate file
**Access:** Self or Admin
**Parameters:**
- `type`: `p12` (default) or `pem`
**Returns:** File download with password in headers (for P12)

#### Get Certificate Status
```http
GET /api/certificates/status
Authorization: Bearer <token>
```
**Purpose:** Gets current user's certificate status
**Access:** Authenticated users
**Returns:**
```json
{
  "success": true,
  "hasCertificate": true,
  "valid": true,
  "expired": false,
  "nearExpiry": false,
  "daysRemaining": 1095
}
```

#### Certificate Statistics
```http
GET /api/certificates/stats
Authorization: Bearer <token>
```
**Purpose:** Gets certificate system statistics
**Access:** Admin only
**Returns:**
```json
{
  "success": true,
  "stats": {
    "total": 50,
    "active": 45,
    "expired": 3,
    "revoked": 2,
    "nearExpiry": 5
  }
}
```

## 🎨 Frontend Integration

### Certificate Manager Component

The `CertificateManager` React component provides a complete user interface for certificate management:

```tsx
import CertificateManager from '@/components/user/CertificateManager';

function NotaryDashboard() {
  return (
    <div>
      <h1>Notary Dashboard</h1>
      <CertificateManager />
    </div>
  );
}
```

### Features

- **Certificate Status Display** - Shows current certificate status with visual indicators
- **Certificate Generation** - One-click certificate generation for approved notaries
- **Certificate Download** - Download certificates in P12 or PEM format
- **Installation Guide** - Step-by-step installation instructions
- **Password Display** - Secure display of P12 passwords
- **Expiry Tracking** - Visual progress bar for certificate validity

## 🔐 Security Features

### Certificate Authority Security

1. **Self-Signed Root CA** - Platform maintains its own trusted root
2. **Strong Key Sizes** - 4096-bit RSA keys for CA, 2048-bit for users
3. **Secure Storage** - Private keys stored securely on server
4. **Unique Serial Numbers** - Each certificate has a unique identifier

### Certificate Features

1. **X.509 Extensions** - Proper key usage and extended key usage
2. **Notary-Specific OIDs** - Custom extensions for notary information
3. **3-Year Validity** - Reasonable validity period with renewal process
4. **Revocation Support** - Certificate Revocation List (CRL) support

### Access Control

1. **Role-Based Access** - Different permissions for admin/notary/user
2. **Self-Service Restrictions** - Users can only manage their own certificates
3. **Approval Required** - Only approved notaries can generate certificates
4. **Audit Trail** - All certificate operations are logged

## 📊 Database Schema

### Certificates Table
```sql
CREATE TABLE certificates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  serial_number VARCHAR(20) NOT NULL UNIQUE,
  certificate_path TEXT NOT NULL,
  private_key_path TEXT NOT NULL,
  p12_path TEXT NOT NULL,
  p12_password TEXT NOT NULL,
  issue_date TIMESTAMP NOT NULL,
  expiry_date TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 🔄 Certificate Lifecycle

### 1. Generation
1. User requests certificate (self-service or admin)
2. System validates user is approved notary
3. OpenSSL generates private key and CSR
4. CA signs CSR with notary-specific extensions
5. PKCS#12 file created with password
6. Certificate stored in database
7. User record updated with certificate info

### 2. Usage
1. User downloads P12 file
2. Installs certificate in browser/system
3. Uses certificate for document signing
4. Certificate validates against CA

### 3. Validation
1. System checks certificate against CA
2. Verifies signature and chain of trust
3. Checks expiry and revocation status
4. Returns validation results

### 4. Expiry Management
1. System monitors certificate expiry dates
2. Notifies users of approaching expiry
3. Automatically marks expired certificates
4. Allows renewal process

### 5. Revocation
1. Admin or user requests revocation
2. Certificate added to CRL
3. Status updated in database
4. Certificate marked as invalid

## 🛠️ Certificate File Structure

```
certs/
├── ca-key.pem              # CA private key (SECURE - backup!)
├── ca-cert.pem             # CA certificate (public)
├── ca-crl.pem              # Certificate Revocation List
├── user-{serial}-key.pem   # User private keys
├── user-{serial}-cert.pem  # User certificates
└── user-{serial}.p12       # User PKCS#12 files
```

## 🔧 Configuration

### Environment Variables
```bash
# Optional - CA configuration
CA_COUNTRY=US
CA_STATE=California
CA_CITY=San Francisco
CA_ORGANIZATION=USA Notary Platform
CA_EMAIL=ca@usanotary.com

# Security
JWT_SECRET=your-secret-key
```

### Default Configuration
- **CA Validity:** 10 years
- **User Certificate Validity:** 3 years
- **Key Size:** 2048-bit RSA for users, 4096-bit for CA
- **Certificate Format:** X.509 v3 with extensions

## 📈 Monitoring & Maintenance

### Regular Tasks

1. **Certificate Expiry Check**
   ```bash
   curl -X POST http://localhost:3000/api/certificates/check-expiry \
     -H "Authorization: Bearer <admin-token>"
   ```

2. **Backup CA Files**
   ```bash
   # CRITICAL: Backup CA private key securely
   cp certs/ca-key.pem /secure/backup/location/
   cp certs/ca-cert.pem /secure/backup/location/
   ```

3. **Monitor Certificate Statistics**
   ```bash
   curl -X GET http://localhost:3000/api/certificates/stats \
     -H "Authorization: Bearer <admin-token>"
   ```

### Alerts & Notifications

- **Expiry Warnings:** 30 days before expiration
- **Failed Generations:** Immediate admin notification
- **Revocation Events:** Audit log entries
- **System Errors:** Error monitoring integration

## 🐛 Troubleshooting

### Common Issues

#### OpenSSL Not Found
```bash
# Check if OpenSSL is installed
openssl version

# Install if missing (macOS)
brew install openssl

# Install if missing (Ubuntu)
sudo apt-get install openssl
```

#### Permission Errors
```bash
# Ensure certs directory is writable
chmod 755 certs/
chown $USER:$USER certs/
```

#### Certificate Generation Fails
1. Check OpenSSL is accessible
2. Verify database connection
3. Ensure user is approved notary
4. Check disk space in certs/ directory

#### Browser Certificate Errors
1. Install CA certificate in browser
2. Verify certificate is not expired
3. Check certificate chain
4. Clear browser certificate cache

### Debug Commands

```bash
# Verify CA certificate
openssl x509 -in certs/ca-cert.pem -text -noout

# Verify user certificate
openssl x509 -in certs/user-{serial}-cert.pem -text -noout

# Check certificate chain
openssl verify -CAfile certs/ca-cert.pem certs/user-{serial}-cert.pem

# View P12 contents
openssl pkcs12 -in certs/user-{serial}.p12 -noout -info
```

This certificate system provides a robust foundation for digital notarization with enterprise-grade security and management capabilities. Based on best practices from [SSL/TLS certificate creation guides](https://dev.to/techschoolguru/how-to-create-sign-ssl-tls-certificates-2aai). 