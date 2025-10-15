# Two-Factor Authentication (2FA) User Guide

## What Was Fixed

The **"Enable 2FA" button** was not appearing due to duplicate route definitions in the backend. This has now been fixed!

## What You Should See Now

### Before the Fix ❌
```
Security
Two-Factor Authentication
Add an extra layer of security to your account

2FA Status: Your account is not protected by two-factor authentication
[Disabled]
(No button to enable)
```

### After the Fix ✅
```
Security
Two-Factor Authentication (2FA)
Add an extra layer of security to your account with time-based one-time passwords (TOTP)

2FA Status: Your account is not protected by two-factor authentication
[Disabled] [Enable 2FA] ← This button should now appear!

Compatible Apps: Google Authenticator, Authy, Microsoft Authenticator, 1Password...
```

## How to Enable 2FA

### Step 1: Access Settings
1. Login to your account
2. Click **"Profile & Signatures"** in the sidebar
3. Scroll down to the **"Security"** section

### Step 2: Start Setup
1. Click the **"Enable 2FA"** button (now visible!)
2. A dialog will open with a QR code

### Step 3: Scan QR Code
1. Open your authenticator app:
   - **Google Authenticator** (Android/iOS)
   - **Authy** (Android/iOS/Desktop)
   - **Microsoft Authenticator** (Android/iOS)
   - **1Password** (All platforms)
   - Any other TOTP app

2. Scan the QR code displayed on screen

3. **Alternative**: If scanning doesn't work, click "Show Manual Entry Key" and type the code into your app

### Step 4: Verify
1. Your authenticator app will show a 6-digit code that refreshes every 30 seconds
2. Enter this code in the verification field
3. Click **"Enable 2FA"**

### Step 5: Success!
✅ 2FA is now enabled on your account!

## Using 2FA to Login

### Login Process with 2FA Enabled
1. Enter your **email** and **password** as usual
2. Click **"Sign In"**
3. **New step**: Enter the 6-digit code from your authenticator app
4. Click **"Verify"** or press Enter
5. You're logged in!

## Disabling 2FA

If you need to disable 2FA:

### Option 1: Using Authenticator App
1. Go to Profile → Settings → Security
2. Click **"Disable 2FA"**
3. Choose **"Use 2FA Code"** tab
4. Enter the current 6-digit code from your authenticator app
5. Confirm

### Option 2: Using Password (If you lost access to your authenticator)
1. Go to Profile → Settings → Security
2. Click **"Disable 2FA"**
3. Choose **"Use Password"** tab
4. Enter your current account password
5. Confirm

## Troubleshooting

### "Enable 2FA" button still not showing?
1. **Hard refresh** your browser: Press `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
2. **Clear browser cache** and reload
3. **Restart the server**:
   ```bash
   pm2 restart all
   # or
   npm run dev
   ```

### QR Code not scanning?
1. Try the **manual entry key** option
2. Make sure your authenticator app is updated
3. Ensure good lighting if using camera

### Code not working during login?
1. Check that your **device time is synchronized** (authenticator apps use time-based codes)
2. Try the **next code** if one doesn't work (codes refresh every 30 seconds)
3. Make sure you're using the code from the correct account in your authenticator app

### Lost access to authenticator app?
1. Use the **password option** to disable 2FA
2. Then re-enable 2FA with a new setup

## Security Best Practices

✅ **DO:**
- Keep your authenticator app on a device you always have with you
- Enable 2FA on your most important accounts
- Back up your authenticator app (some support cloud backup)
- Use a password manager for your passwords

❌ **DON'T:**
- Share your 2FA codes with anyone
- Screenshot your QR codes (security risk)
- Use the same authenticator for multiple important accounts without backup
- Disable 2FA unless necessary

## Admin Features

If you're an admin, you can also:
- **Bulk enable/disable** 2FA for multiple users
- **View 2FA status** for all users
- **Toggle 2FA** for individual users

Access these features in **User Management** → Select users → Bulk Actions

---

**Need Help?**
If you still can't see the "Enable 2FA" button or encounter other issues, please contact support or check the server logs.

