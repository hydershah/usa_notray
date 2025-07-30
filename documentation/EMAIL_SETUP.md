# Email Configuration Setup Guide

## Hostinger SMTP Configuration

To set up email functionality with Hostinger hosting, you need to configure the following environment variables.

### Required Environment Variables

Create a `.env` file in the project root with these settings:

```bash
# Professional SMTP Configuration (SSL - Recommended)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=your-email@yourdomain.com
SMTP_PASS=your-secure-password

# Alternative SMTP (STARTTLS)
# SMTP_HOST=mail.hostinger.com
# SMTP_PORT=587
# SMTP_USER=your-email@yourdomain.com
# SMTP_PASS=your-secure-password

# Professional branding
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=Your Company Name
```

### Step-by-Step Setup

1. **Create Email Account in Hostinger**
   - Log into your Hostinger control panel
   - Go to Email > Email Accounts
   - Create a new email account (e.g., `noreply@yourdomain.com`)
   - Set a strong password

2. **Create .env File**
   ```bash
   # Copy this configuration to your .env file
   SMTP_HOST=mail.hostinger.com
   SMTP_PORT=587
   SMTP_USER=noreply@yourdomain.com
   SMTP_PASS=your-actual-password
   
   # Other required variables
   NODE_ENV=development
   CLIENT_URL=http://localhost:3000
   JWT_SECRET=your-super-secret-jwt-key
   DATABASE_URL=your-neon-database-url
   ```

3. **Replace Placeholder Values**
   - `yourdomain.com` → Your actual domain
   - `your-actual-password` → The password for your email account
   - `your-super-secret-jwt-key` → A secure random string
   - `your-neon-database-url` → Your Neon database connection string

### Email Features

The system will automatically send emails for:
- **Guest Signer Invitations** - When jobs are created with signers
- **User Registration Invitations** - When admins invite new users
- **Password Reset Emails** - When passwords are reset

### Alternative Email Providers

#### Gmail
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password  # Use App Password, not regular password
```

#### Outlook/Hotmail
```bash
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

#### Custom SMTP Server
```bash
SMTP_HOST=mail.yourcompany.com
SMTP_PORT=587
SMTP_USER=notifications@yourcompany.com
SMTP_PASS=your-password
```

### Troubleshooting

#### Common Issues:

1. **Authentication Failed**
   - Verify email and password are correct
   - Check if email account is active in Hostinger
   - Ensure domain DNS is properly configured

2. **Connection Timeout**
   - Try port 465 with SSL instead of 587 with STARTTLS
   - Check firewall settings

3. **Invalid Certificate**
   - The system is configured to accept self-signed certificates in development
   - In production, ensure proper SSL certificates are configured

#### Test Email Configuration

1. Start the application: `npm run dev`
2. Create a job with signers
3. Check server logs for email sending status
4. Verify emails are received in signer's inbox

### Security Notes

- **Never commit .env files to version control**
- **Use strong passwords for email accounts**
- **Consider using dedicated email accounts for notifications**
- **Enable 2FA on your hosting account**

### Production Deployment

For production deployment:
1. Set environment variables in your hosting platform
2. Update `NODE_ENV=production`
3. Use production domain in `CLIENT_URL`
4. Ensure SSL certificates are properly configured 