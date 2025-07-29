# Supabase Self-Signed Certificate Setup Guide

This guide will help you set up the self-signed certificates table in your Supabase database to enable automatic certificate generation for verified signers and witnesses.

## 🎯 What This Does

- **Automatic Certificate Generation**: When signers/witnesses complete ID verification, a self-signed X.509 certificate is automatically generated
- **Certificate Management**: Users can download their certificates, admins can view all certificates
- **Audit Trail**: Complete tracking of certificate issuance, expiration, and revocation
- **Security**: Certificates are locally saved and stored in the database for compliance

## 📋 Prerequisites

1. ✅ **Supabase Project**: You must have a Supabase project set up
2. ✅ **Database Access**: Your `DATABASE_URL` environment variable should be configured
3. ✅ **Existing Users Table**: The `users` table must exist (required for foreign key relationship)
4. ✅ **Node.js**: Required to run the migration script

## 🚀 Quick Setup (Recommended)

### Option 1: Run Migration Script

```bash
# Run the automated migration script
node run-supabase-certificates-migration.js
```

This script will:
- Connect to your Supabase database
- Create the `self_signed_certificates` table
- Set up indexes and constraints
- Verify the setup

### Option 2: Manual SQL Execution

1. **Open Supabase Dashboard**
   - Go to your project dashboard
   - Navigate to "Database" → "SQL Editor"

2. **Copy and Paste Migration**
   - Open `migration-self-signed-certificates.sql`
   - Copy the entire contents
   - Paste into Supabase SQL Editor
   - Click "Run"

3. **Verify Creation**
   - Go to "Database" → "Tables"
   - Look for `self_signed_certificates` table

## 📊 Table Structure

The `self_signed_certificates` table includes:

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `user_id` | INTEGER | Reference to users table |
| `certificate_id` | VARCHAR(255) | Unique certificate identifier |
| `common_name` | VARCHAR(255) | Certificate common name |
| `certificate_content` | TEXT | PEM-formatted X.509 certificate |
| `private_key` | TEXT | PEM-formatted private key |
| `public_key` | TEXT | PEM-formatted public key |
| `certificate_path` | VARCHAR(500) | Local file path (optional) |
| `private_key_path` | VARCHAR(500) | Local private key path (optional) |
| `public_key_path` | VARCHAR(500) | Local public key path (optional) |
| `issued_at` | TIMESTAMP | When certificate was issued |
| `expires_at` | TIMESTAMP | When certificate expires |
| `status` | VARCHAR(50) | Certificate status (active/expired/revoked) |
| `user_role` | VARCHAR(50) | User role when issued |
| `user_email` | VARCHAR(255) | User email when issued |
| `revoked_at` | TIMESTAMP | When revoked (if applicable) |
| `revocation_reason` | TEXT | Revocation reason |
| `created_at` | TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | Last update time |

## 🔒 Security Considerations

### Row Level Security (RLS)

Consider enabling RLS policies for enhanced security:

```sql
-- Enable RLS
ALTER TABLE self_signed_certificates ENABLE ROW LEVEL SECURITY;

-- Users can view their own certificates
CREATE POLICY "Users can view own certificates" ON self_signed_certificates
    FOR SELECT USING (auth.uid()::text = user_id::text);

-- Service role can manage all certificates
CREATE POLICY "Service role full access" ON self_signed_certificates
    FOR ALL USING (auth.role() = 'service_role');
```

### Environment Variables

Ensure these are set for certificate generation:

```bash
# Required for certificate generation
OPENSSL_PATH=/usr/bin/openssl  # Path to OpenSSL binary
CERT_STORAGE_PATH=./certificates/user-certificates  # Local storage path

# Supabase connection
DATABASE_URL=postgresql://user:pass@host:port/db
```

## 🧪 Testing the Setup

### 1. Verify Table Creation

```sql
-- Check if table exists
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'self_signed_certificates'
ORDER BY ordinal_position;
```

### 2. Test Certificate Generation

1. **Create Test Signer**:
   ```sql
   INSERT INTO users (username, email, password, role, first_name, last_name, is_verified)
   VALUES ('testsigner', 'test@example.com', 'hashedpass', 'signer', 'Test', 'Signer', true);
   ```

2. **Trigger Certificate Generation**:
   - Complete ID verification for the test user
   - Check the API endpoint: `/api/user/certificate`
   - Verify certificate appears in database

### 3. Check Generated Certificate

```sql
-- View generated certificates
SELECT 
    id, 
    certificate_id, 
    common_name, 
    user_role, 
    status, 
    issued_at, 
    expires_at 
FROM self_signed_certificates 
ORDER BY created_at DESC;
```

## 📱 User Experience

### For Signers/Witnesses

1. **Complete ID Verification** → Certificate automatically generated
2. **View Certificate Status** → Dashboard shows certificate info
3. **Download Certificate** → PEM file download available

### For Admins

1. **View All Certificates** → Admin dashboard lists all certificates
2. **Download Any Certificate** → Admin can download user certificates
3. **Revoke Certificates** → Admin can revoke if needed
4. **Audit Trail** → Complete certificate lifecycle tracking

## 🔧 API Endpoints Available

After setup, these endpoints become available:

```
GET /api/user/certificate              # Get user's certificate info
GET /api/user/certificate/download     # Download user's certificate
POST /api/user/certificate/generate    # Manual certificate generation

GET /api/admin/certificates            # List all certificates (admin)
GET /api/admin/users/:id/certificate   # Get user certificate (admin)
GET /api/admin/users/:id/certificate/download  # Download user cert (admin)
POST /api/admin/users/:id/certificate/revoke   # Revoke certificate (admin)
```

## 🚨 Troubleshooting

### Common Issues

1. **Foreign Key Error**
   ```
   ERROR: relation "users" does not exist
   ```
   **Solution**: Ensure the `users` table exists before running migration

2. **Permission Denied**
   ```
   ERROR: permission denied to create table
   ```
   **Solution**: Use a database user with CREATE privileges

3. **Certificate Generation Fails**
   ```
   Error: OpenSSL not found
   ```
   **Solution**: Install OpenSSL and set correct `OPENSSL_PATH`

### Verification Commands

```bash
# Check table exists
node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }});
client.connect().then(() => {
  return client.query(\"SELECT COUNT(*) FROM self_signed_certificates\");
}).then(result => {
  console.log('✅ Table accessible, records:', result.rows[0].count);
}).catch(console.error).finally(() => client.end());
"

# Test certificate generation
curl -X POST http://localhost:3001/api/user/certificate/generate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

## 📞 Support

If you encounter issues:

1. Check Supabase dashboard for error logs
2. Verify all environment variables are set
3. Ensure the `users` table has the required columns
4. Test database connectivity with the verification commands above

---

## ✅ Success Checklist

- [ ] Migration script runs without errors
- [ ] Table appears in Supabase dashboard
- [ ] Certificate generation works after ID verification
- [ ] Users can download their certificates
- [ ] Admin can view all certificates
- [ ] API endpoints respond correctly

**🎉 Once complete, your platform will automatically generate self-signed certificates for verified users!** 