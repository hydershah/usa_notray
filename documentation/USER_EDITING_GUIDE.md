# How To Edit User Information in Jobs

This guide explains how to fix user information (name, email, phone) when mistakes are made during job creation.

## Who Can Edit Users

- **Admin users**: Can edit any job's signers
- **Title Company users**: Can edit any job's signers  
- **Notary users**: Can edit any job's signers

## How To Edit a User's Information

### Step 1: Navigate to Job Details
1. Go to the Jobs page
2. Click on the specific job you want to edit
3. Navigate to the **Job Editor** or **Signers** section

### Step 2: Edit Signer Information
1. In the **Signers** section, find the user you need to edit
2. Click the **Edit button** (pencil icon) next to the signer's name
3. An "Edit Signer" dialog will appear

### Step 3: Update Information
In the edit dialog, you can modify:
- **Full Name**: Correct any spelling mistakes
- **Email Address**: Fix typos or update email
- **Phone Number**: Update contact information
- **Role**: Change the signer's role if needed

### Step 4: Save Changes
1. Click **"Update Signer"** to save your changes
2. You'll see a success notification
3. The table will automatically refresh with updated information

## Important Notes

### Email Address Changes
- **Unique Emails**: Each signer in a job must have a unique email address
- **Validation**: The system will prevent duplicate emails within the same job
- **Account Linking**: If the new email matches an existing user account, it will be automatically linked

### Signing Status Restrictions
- **Active Signers**: You cannot edit signers who have already started signing
- **Completed Signers**: You cannot edit signers who have completed signing
- **Safe Window**: Edit information before invitations are sent for best results

### Permission Restrictions
- **Admin**, **Title Company**, and **Notary** users can edit signer information
- Changes are logged for audit purposes

## Common Use Cases

### Fix Typos in Name
```
Original: "Jhon Smith"
Corrected: "John Smith"
```

### Update Email Address
```
Original: "john@gmial.com"
Corrected: "john@gmail.com"
```

### Change Phone Number
```
Original: "555-123-456"
Corrected: "555-123-4567"
```

### Update Signer Role
```
Original: "borrower"
Changed to: "co-borrower"
```

## Troubleshooting

### "Another signer with this email already exists"
- This means you're trying to use an email that's already assigned to a different signer in the same job
- Choose a different email address or edit the other signer first

### "You do not have permission to edit signers"
- Only Admin, Title Company, and Notary users can edit signers
- Contact your administrator if you need access

### Edit Button Not Visible
- Check that you're logged in with the correct role (Admin, Title Company, or Notary)
- Ensure the job is still in an editable state

## Technical Details

### API Endpoint
- **URL**: `PUT /api/jobs/:jobId/signers/:signerId`
- **Authentication**: Required (Bearer token)
- **Permissions**: Admin, Title Company, or Notary role

### Data Validation
- All fields (name, email, phone, role) are required
- Email format validation
- Unique email per job validation
- Phone number format validation

## Related Features

- [Job Creation Guide](JOB_CREATION_GUIDE.md)
- [Signer Management](SIGNER_MANAGEMENT_GUIDE.md)
- [Job Status Management](JOB_STATUS_GUIDE.md) 