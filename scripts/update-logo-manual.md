# Manual Logo Update Guide

## Step 1: Add the New Logo File

1. Copy `sharpnote_-_blue_background.jpg` to the `client/public/` directory
2. Ensure the file is named exactly: `sharpnote_-_blue_background.jpg`

## Step 2: Update Logo References

The following files need to be updated to use the new logo:

### 1. Login Page (`client/src/pages/login.tsx`)
- **Line 356**: Change `src="/logo.jpeg"` to `src="/sharpnote_-_blue_background.jpg"`
- **Line 416**: Change `src="/logo.jpeg"` to `src="/sharpnote_-_blue_background.jpg"`

### 2. Verify Email Page (`client/src/pages/verify-email.tsx`)
- **Line 248**: Change `src="/logo.jpeg"` to `src="/sharpnote_-_blue_background.jpg"`
- **Line 284**: Change `src="/logo.jpeg"` to `src="/sharpnote_-_blue_background.jpg"`

### 3. Company Registration Page (`client/src/pages/company-registration.tsx`)
- **Line 134**: Change `src="/logo.jpeg"` to `src="/sharpnote_-_blue_background.jpg"`
- **Line 181**: Change `src="/logo.jpeg"` to `src="/sharpnote_-_blue_background.jpg"`

### 4. Register User Page (`client/src/pages/register-user.tsx`)
- **Line 166**: Change `src="/logo.jpeg"` to `src="/sharpnote_-_blue_background.jpg"`
- **Line 202**: Change `src="/logo.jpeg"` to `src="/sharpnote_-_blue_background.jpg"`

### 5. Header Component (`client/src/components/layout/header.tsx`)
- **Line 100**: Change `src="/logo.jpeg"` to `src="/sharpnote_-_blue_background.jpg"`

## Step 3: Test the Changes

1. Start the development server: `npm run dev`
2. Navigate to the login page to verify the logo displays correctly
3. Check other pages that use the logo
4. Verify the logo appears properly in the header

## Step 4: Optional - Run Automated Script

If you prefer to use the automated script:

```bash
npx tsx scripts/update-logo-references.ts
```

This will automatically update all logo references across the site.

## Notes

- The new logo file should be in JPG format
- Make sure the file size is reasonable for web use (under 100KB recommended)
- Test on different screen sizes to ensure the logo scales properly
- Consider updating any CSS that might reference the old logo file 