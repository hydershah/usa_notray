# Railway Environment Setup for USA Notray

## Required Environment Variables for Railway

Add these environment variables to your Railway project:

### Database & SSL
```bash
DATABASE_URL=postgresql://postgres:ylQMriYJJoERklUWGEBmudTyioGRzmWC@nozomi.proxy.rlwy.net:32381/railway?sslmode=require
NODE_TLS_REJECT_UNAUTHORIZED=0
```

### Application Settings
```bash
NODE_ENV=production
PORT=3000
CLIENT_URL=https://your-app-name.railway.app
SERVER_URL=https://your-app-name.railway.app
FRONTEND_URL=https://your-app-name.railway.app
BACKEND_URL=https://your-app-name.railway.app
API_URL=https://your-app-name.railway.app/api
```

### Security
```bash
JWT_SECRET=your-production-jwt-secret-change-this
SESSION_SECRET=your-production-session-secret-change-this
```

### Email Configuration (Resend SMTP)
```bash
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=resend
SMTP_PASS=re_7ve51boJ_7kvD5iCp5PJonw6Mi8Y7UsuY
EMAIL_FROM=Sharp Note <noreply@sharpnote.net>
FROM_EMAIL=noreply@sharpnote.net
FROM_NAME=Sharp Note
```

### File Storage (Vultr)
```bash
VULTR_ACCESS_KEY=GE8MIGK9HAH7L26SPN51
VULTR_SECRET_KEY=F4kBLWvvM6CSL3nDtdp7ROdynGmc5A1Fxy1IH20e
VULTR_REGION=ewr1
VULTR_BUCKET_NAME=usanotary
VULTR_ENDPOINT=https://ewr1.vultrobjects.com
```

### Video Conferencing
```bash
WHEREBY_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmFwcGVhci5pbiIsImF1ZCI6Imh0dHBzOi8vYXBpLmFwcGVhci5pbi92MSIsImV4cCI6OTAwNzE5OTI1NDc0MDk5MSwiaWF0IjoxNzUyMzA1MTI2LCJvcmdhbml6YXRpb25JZCI6MTg5MDgxLCJqdGkiOiJmZTQwOGVmYi1mYjAwLTRjZjUtYjJmMi0xZmQyYjczNDJjNTUifQ.iKEgegCdpHyTZWL1v6CSkQ-bDMN_I8dE1Q4eR6JV11I
DAILY_API_KEY=da48a4d3b10e1baded3b0cf71f68a6522925d0a10260f0e09202f25506759e64
DAILY_DOMAIN=usanotray.daily.co
```

### Identity Verification (EVS)
```bash
EVS_API_KEY=E27235-CE567A22-0D31-474A-B551-252882763208
EVS_PASSWORD=8aeWPi0XV#AyS#I
EVS_ENVIRONMENT=production
KBA_PROVIDER=evs
KBA_API_KEY=E27235-CE567A22-0D31-474A-B551-252882763208
KBA_PASSWORD=8aeWPi0XV#AyS#I
KBA_ENVIRONMENT=production
```

### Optional
```bash
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=true
PERFORMANCE_MONITORING=true
MAX_FILE_SIZE_MB=500
ALLOWED_FILE_TYPES=pdf,doc,docx,jpg,jpeg,png
```

## Steps to Deploy on Railway

1. **Set Environment Variables**:
   - Go to your Railway project dashboard
   - Click on your service
   - Navigate to "Variables" tab
   - Add all the environment variables listed above
   - **IMPORTANT**: Make sure to set `NODE_TLS_REJECT_UNAUTHORIZED=0` for Railway PostgreSQL SSL

2. **Update URLs**:
   - Replace `https://your-app-name.railway.app` with your actual Railway app URL
   - You'll get this URL after your first deployment

3. **Deploy**:
   - Connect your GitHub repository to Railway
   - Railway will automatically detect your Node.js app and deploy it
   - The build process will use the environment variables you set

## SSL Certificate Fix

The key fix for the SSL certificate error is setting:
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0
```

This allows your application to connect to Railway's PostgreSQL database which uses self-signed certificates.

## Production Considerations

- Change `JWT_SECRET` and `SESSION_SECRET` to strong, unique values
- Consider using Railway's built-in PostgreSQL service for better integration
- Monitor logs via Railway dashboard for any deployment issues
- Test all functionality after deployment, especially email and file uploads
