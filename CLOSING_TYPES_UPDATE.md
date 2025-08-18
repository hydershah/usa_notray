# Closing Types Update

## Overview

This update modifies the default order entry type list to match the new requirements:

### New Default Closing Types

1. **Title Closing - Seller Side** ($120.00)
2. **Title Closing - Buyer w/Cash** ($145.00)
3. **Title Closing - Buyer w/Loan** ($120.00)
4. **Title Closing - Joint** ($150.00)
5. **1-4 Document** ($25.00)

## Changes Made

### 1. Updated `closing_types.json`
- Replaced existing closing types with the new default list
- Updated pricing to match requirements (stored in cents)
- Set appropriate durations and descriptions

### 2. Created Database Migration
- **File**: `migrations/update-closing-types.sql`
- Clears existing closing types and inserts new defaults
- Resets the ID sequence to start from 1

### 3. Created Node.js Migration Script
- **File**: `scripts/update-closing-types.cjs`
- Provides a programmatic way to update the database
- Includes validation and progress reporting

### 4. Enhanced Job Wizard UI
- **File**: `client/src/components/job/job-wizard.tsx`
- Updated closing type dropdown to display pricing
- Shows total price including travel fees if applicable

## How to Apply the Update

### Option 1: Using the Node.js Script (Recommended)

```bash
# Run the migration script
node scripts/update-closing-types.cjs
```

### Option 2: Using the SQL Migration

```bash
# Connect to your database and run the SQL migration
psql -d your_database_name -f migrations/update-closing-types.sql
```

### Option 3: Manual Database Update

1. Connect to your database
2. Clear existing closing types: `DELETE FROM closing_types;`
3. Reset the sequence: `ALTER SEQUENCE closing_types_id_seq RESTART WITH 1;`
4. Insert the new closing types using the data from `closing_types.json`

## Admin Management

The admin interface at `/closing-types` allows administrators to:

- ✅ **View all closing types** with pricing and details
- ✅ **Add new closing types** with custom pricing
- ✅ **Edit existing closing types** including pricing
- ✅ **Delete closing types** (with confirmation)
- ✅ **Activate/deactivate** closing types
- ✅ **Configure travel fees** and other options

### Admin Features

- **Pricing Management**: Set base prices and travel fees
- **Duration Configuration**: Set estimated session duration
- **Requirements Toggle**: Configure witness and travel requirements
- **Status Control**: Activate/deactivate closing types
- **Real-time Updates**: Changes are immediately reflected in the order creation process

## Verification

After running the migration, verify the update by:

1. **Check the database**:
   ```sql
   SELECT id, name, base_price, is_active FROM closing_types ORDER BY id;
   ```

2. **Test the admin interface**:
   - Navigate to `/closing-types`
   - Verify all 5 new closing types are displayed
   - Check that pricing is correct

3. **Test order creation**:
   - Create a new job
   - Verify closing type dropdown shows pricing
   - Confirm selected closing type has correct pricing

## Pricing Structure

All prices are stored in cents (1/100th of a dollar) for precision:

- **Title Closing - Seller Side**: 12000 cents = $120.00
- **Title Closing - Buyer w/Cash**: 14500 cents = $145.00
- **Title Closing - Buyer w/Loan**: 12000 cents = $120.00
- **Title Closing - Joint**: 15000 cents = $150.00
- **1-4 Document**: 2500 cents = $25.00

## Backward Compatibility

- ✅ Existing jobs with old closing types will continue to work
- ✅ Admin can still manage all closing types
- ✅ API endpoints remain unchanged
- ✅ Frontend components updated to show pricing

## Troubleshooting

### If the migration fails:

1. **Check database connection**: Ensure your database is accessible
2. **Verify permissions**: Ensure the database user has INSERT/DELETE permissions
3. **Check for foreign key constraints**: Ensure no jobs reference the closing types being deleted

### If pricing doesn't display:

1. **Clear browser cache**: Hard refresh the page (Ctrl+F5)
2. **Check API response**: Verify `/api/closing-types` returns the updated data
3. **Check console errors**: Look for JavaScript errors in browser developer tools

## Support

For issues or questions about this update:

1. Check the migration logs for errors
2. Verify database connectivity
3. Test the admin interface functionality
4. Contact the development team if problems persist 