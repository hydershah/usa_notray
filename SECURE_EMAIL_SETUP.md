# 🔐 Secure Email Configuration Guide

## Overview
This guide will help you set up professional, secure email functionality for the USA Notary Services platform with proper anti-spam measures and security best practices.

## 🚨 Security First

**NEVER commit credentials to version control!** All sensitive information should be stored in environment variables or the admin dashboard.

## ⚙️ Configuration Options

### Option 1: Environment Variables (Recommended)
Create a `.env` file in your project root:

```bash
# Professional SMTP Configuration
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=465
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-secure-app-password
SMTP_SECURE=true

# Professional branding
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=USA Notary Services

# Application settings
CLIENT_URL=https://your-domain.com
NODE_ENV=production
```

### Option 2: Admin Dashboard
1. Log in as admin
2. Navigate to `/admin/email-settings`
3. Configure SMTP settings securely
4. Test configuration before deploying

## 📧 Email Provider Setup

### Hostinger Email (Recommended)
```bash
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-email-password
```

### Gmail (Development/Testing)
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=youremail@gmail.com
SMTP_PASS=your-app-password  # Use App Password, not regular password
```

**Gmail Setup:**
1. Enable 2-Step Verification
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use the 16-character app password

### SendGrid (High Volume)
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

### AWS SES (Enterprise)
```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-aws-access-key
SMTP_PASS=your-aws-secret-key
```

## 🛡️ Anti-Spam Best Practices

### Professional Email Features
✅ **Built-in Anti-Spam Headers**: Professional headers that establish legitimacy  
✅ **Professional Templates**: Mobile-responsive, branded email designs  
✅ **Rate Limiting**: 14 emails/second max to prevent blocking  
✅ **Connection Pooling**: Efficient SMTP connection management  
✅ **Proper From Headers**: Professional sender identification  
✅ **Unsubscribe Links**: Anti-spam compliance  

### Domain Authentication (Recommended)
Set up these DNS records for your domain:

**SPF Record:**
```
v=spf1 include:_spf.hostinger.com ~all
```

**DKIM Record:**
Contact your hosting provider for DKIM setup

**DMARC Record:**
```
v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com
```

## 📊 Email Types

### 1. Signer Invitations
- **Subject**: "🏛️ Secure Document Signing Required - [Company]"
- **Content**: Professional invitation with detailed instructions
- **Security**: Unique invitation tokens with 7-day expiration
- **Mobile**: Fully responsive design

### 2. User Registration
- **Subject**: "🏛️ Platform Access Invitation - [Role]"
- **Content**: Role-specific onboarding information
- **Security**: 48-hour token expiration

### 3. Password Reset
- **Subject**: "🔑 Password Reset - USA Notary Services"
- **Content**: Secure reset instructions
- **Security**: 1-hour token expiration

## 🧪 Testing Configuration

### 1. Command Line Test
```bash
# Test with environment variables
npm run test:email

# Test specific configuration
SMTP_HOST=smtp.hostinger.com npm run test:email
```

### 2. Admin Dashboard Test
1. Go to `/admin/email-settings`
2. Enter test email address
3. Click "Test Configuration"
4. Check inbox and spam folder

### 3. Script Testing
```bash
# Test SMTP connection
npx tsx scripts/test-email.ts

# Test detailed SMTP diagnostics
npx tsx scripts/test-smtp-detailed.ts

# Initialize email settings
npx tsx scripts/initialize-email-settings.ts
```

## 🚨 Troubleshooting

### Common Issues

**Authentication Failed**
- Verify email/password are correct
- Check if email account exists in hosting
- Use app passwords for Gmail
- Check DNS settings

**Connection Timeout**
- Try port 465 (SSL) instead of 587 (STARTTLS)
- Check firewall settings
- Verify hosting allows outbound SMTP

**Emails Going to Spam**
- Set up SPF/DKIM/DMARC records
- Use professional from addresses
- Avoid spammy subject lines
- Include unsubscribe links

**Rate Limiting**
- Built-in rate limiting (14/second)
- Use connection pooling
- Monitor sending volume

### Email Deliverability Checklist
- [ ] Professional from address (noreply@yourdomain.com)
- [ ] SPF record configured
- [ ] DKIM signing enabled
- [ ] DMARC policy set
- [ ] Unsubscribe links included
- [ ] Professional email templates
- [ ] Rate limiting enabled
- [ ] Monitor bounce rates

## 📋 Production Deployment

### 1. Environment Setup
```bash
# Production environment variables
NODE_ENV=production
CLIENT_URL=https://yourdomain.com
SMTP_HOST=smtp.yourdomain.com
SMTP_USER=noreply@yourdomain.com
# Add other variables via hosting dashboard
```

### 2. Security Checklist
- [ ] All credentials in environment variables
- [ ] No hardcoded passwords in code
- [ ] SSL/TLS encryption enabled
- [ ] Rate limiting configured
- [ ] Monitoring set up
- [ ] Backup email configuration

### 3. Monitoring
- Monitor email sending success rates
- Track bounce and complaint rates
- Set up alerts for failed sends
- Regular testing of email functionality

## 💡 Best Practices

### Development
- Use separate test email addresses
- Never use production credentials in development
- Test with multiple email providers
- Monitor email logs

### Production
- Use dedicated email accounts for notifications
- Set up proper DNS records
- Monitor deliverability metrics
- Have backup email providers

### Security
- Rotate passwords regularly
- Use strong, unique passwords
- Enable 2FA on email accounts
- Monitor for unauthorized access
- Audit email logs regularly

## 📞 Support

### Built-in Support
- Email templates include support contact information
- Professional error handling and logging
- Detailed test functionality
- Configuration validation

### Getting Help
1. Check server logs for detailed error messages
2. Use built-in testing tools
3. Verify DNS settings
4. Contact hosting provider for SMTP issues
5. Review email provider documentation

## 🔄 Migration from Old System

If migrating from an insecure email setup:

1. **Remove hardcoded credentials** from all files
2. **Set up environment variables** with proper values
3. **Initialize secure settings** using the script
4. **Test thoroughly** before going live
5. **Monitor email delivery** after deployment

```bash
# Clean migration steps
npx tsx scripts/initialize-email-settings.ts
npm run test:email your-test-email@domain.com
```

---

**Remember**: Email deliverability is crucial for notarization workflows. Invest time in proper setup for professional, reliable communication with signers and users. 