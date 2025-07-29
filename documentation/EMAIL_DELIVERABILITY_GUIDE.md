# Email Deliverability Guide for USA Notary

## Why Emails Go to Spam

When using `mail@digitalexpert.agency` to send emails, they might go to spam because:

1. **New Domain Reputation**: The domain hasn't built trust with email providers yet
2. **Missing SPF/DKIM Records**: Email authentication isn't properly configured
3. **Generic Content**: Emails might look like automated spam

## How to Improve Email Deliverability

### 1. Add SPF Record to Your Domain

Add this TXT record to your domain's DNS:
```
v=spf1 include:_spf.hostinger.com ~all
```

### 2. Configure DKIM

Contact Hostinger support to enable DKIM for your domain. This adds a digital signature to your emails.

### 3. Add DMARC Record

Add this TXT record to `_dmarc.digitalexpert.agency`:
```
v=DMARC1; p=none; rua=mailto:mail@digitalexpert.agency
```

### 4. Warm Up Your Domain

- Start by sending emails to people you know
- Ask them to mark emails as "Not Spam"
- Gradually increase email volume

### 5. Email Best Practices

- Always include unsubscribe links
- Avoid spam trigger words
- Use a recognizable "From" name
- Keep a good text-to-image ratio

## Testing Email Deliverability

Use these free tools to test your email setup:
- https://www.mail-tester.com/
- https://mxtoolbox.com/emailhealth
- https://www.gmass.co/smtp-test

## Quick Fix for Current Signers

While you improve deliverability, signers can:

1. **Add to Contacts**: Add `mail@digitalexpert.agency` to their contacts
2. **Whitelist Domain**: Add `digitalexpert.agency` to their email whitelist
3. **Use Direct Links**: Share the signing link directly instead of relying on email

## Alternative Solutions

If email issues persist:

1. **Use SMS**: Send signing links via SMS instead
2. **Use WhatsApp**: Share links through WhatsApp Business
3. **Portal Access**: Create a portal where signers can log in to see pending documents
4. **Use Established Email Service**: Consider using SendGrid, AWS SES, or similar services with better reputation

## Monitoring Email Performance

Track these metrics:
- **Delivery Rate**: How many emails reach the server
- **Open Rate**: How many recipients open the email
- **Bounce Rate**: How many emails fail to deliver
- **Spam Complaints**: How many mark as spam

Keep bounce rate below 2% and spam complaints below 0.1% for good reputation. 