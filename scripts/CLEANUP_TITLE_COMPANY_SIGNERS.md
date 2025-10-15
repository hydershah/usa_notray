# Title Company/Notary Signer Cleanup

## Problem

Previously, the `add-default-participants.ts` script would automatically add job creators as signers, even if they were title companies or notaries. This caused title companies and notaries to incorrectly appear in the signers list when they should only act in their primary role.

## Solution

Two-part fix:

### 1. Prevention (add-default-participants.ts)

**Modified:** `scripts/add-default-participants.ts`

The script now checks if a user is a title company or notary before auto-adding them as a signer. If they are, they're skipped and a placeholder signer is created instead.

**Changes:**
- Added role check at lines 117-126
- Title companies and notaries are no longer auto-added as signers
- Logs clearly indicate when a user is skipped

### 2. Cleanup (cleanup-title-company-signers.ts)

**Created:** `scripts/cleanup-title-company-signers.ts`

This script removes existing incorrect entries from the database where title companies or notaries were previously auto-added as signers.

## How It Works

The cleanup script:

1. **Finds all signers** who are title companies or notaries
2. **Checks for explicit invitation** by looking for `jobParticipants` entries with `jobSpecificRole = 'signer'` or `'witness'`
3. **Categorizes entries:**
   - ❌ **To Delete**: No explicit jobParticipants entry (incorrectly auto-added)
   - ✅ **To Keep**: Has explicit jobParticipants entry (legitimately invited as signer)
4. **Deletes incorrect entries** from:
   - `signers` table
   - `job_participants` table (only entries without explicit role)

## Running the Cleanup

### Prerequisites

1. Ensure database connection is configured in `.env`:
   ```
   DATABASE_URL=postgresql://user:password@host:port/database
   ```

2. Backup your database first (recommended):
   ```bash
   npm run backup-db
   ```

### Execute Cleanup

```bash
# Run the cleanup script
npx tsx scripts/cleanup-title-company-signers.ts
```

### What to Expect

The script will output:
- Total number of title company/notary signer entries found
- List of entries to DELETE (incorrectly auto-added)
- List of entries to KEEP (explicitly invited)
- Progress as each entry is processed
- Final summary of deleted/kept/failed entries

### Example Output

```
🔗 Connected to database
🧹 STARTING TITLE COMPANY/NOTARY SIGNER CLEANUP...

📊 Found 5 title company/notary signer entries:

❌ 3 entries to DELETE (no explicit jobParticipants entry):
   Job #42 - hyder99@hotmail.com (title_company) - Signer ID: 156
   Job #55 - notary@example.com (notary) - Signer ID: 201
   Job #78 - title@company.com (title_company) - Signer ID: 245

✅ 2 entries to KEEP (have explicit jobParticipants entry):
   Job #12 - invited-notary@example.com (notary) - Signer ID: 89
   Job #33 - invited-title@company.com (title_company) - Signer ID: 134

🗑️ Deleting incorrect signer entries...
   ✅ Deleted: Job #42 - hyder99@hotmail.com (title_company)
   ✅ Deleted: Job #55 - notary@example.com (notary)
   ✅ Deleted: Job #78 - title@company.com (title_company)

📊 CLEANUP SUMMARY:
   ✅ Successfully deleted: 3
   ❌ Failed: 0
   ℹ️ Kept (explicitly invited): 2

🎉 Cleanup complete!
```

## Verification

After running the cleanup, verify the results:

1. **Check the database:**
   ```sql
   -- Should return only title companies/notaries with explicit jobParticipants entries
   SELECT 
     s.job_id,
     s.signer_email,
     u.role,
     jp.job_specific_role
   FROM signers s
   INNER JOIN users u ON s.user_id = u.id
   LEFT JOIN job_participants jp ON jp.job_id = s.job_id AND jp.user_id = s.user_id
   WHERE u.role IN ('title_company', 'notary');
   ```

2. **Test in the application:**
   - Create a new job as a title company
   - Go to the signing interface
   - Verify the title company does NOT appear in the signers list on the left sidebar
   - Only explicitly invited signers should appear

## Session Service Integration

The session service has also been updated to handle this correctly:

**Files Modified:**
- `server/services/editor/SessionService.ts`
- `server/services/session/LiveSigningSessionService.ts`

These services now check if a signer is a title company/notary and verify they have an explicit `jobParticipants` entry before including them in the signers list.

## Expected Behavior After Fix

✅ **Title company creates a job** → Does NOT appear in signers list  
✅ **Notary assigned to a job** → Appears only as notary, not in signers list  
✅ **Title company explicitly invited as signer** → Appears ONLY in signers list with "(Title → Signer)" label  
✅ **Notary explicitly invited as signer** → Appears ONLY in signers list with "(Notary → Signer)" label  
✅ **Regular signers** → Continue to appear normally in signers list  

## Troubleshooting

### "No entries need to be deleted"

This means either:
- The cleanup was already run successfully
- All title companies/notaries in the signers table were legitimately invited

### Deletion Failures

If any deletions fail:
1. Check the error message
2. Verify database permissions
3. Check for foreign key constraints
4. Review database logs

### Still Seeing Title Companies as Signers

If title companies still appear as signers after cleanup:
1. Verify the cleanup script completed successfully
2. Check if there's a `jobParticipants` entry for that user
3. Clear browser cache and Redis cache
4. Restart the application server

## Related Files

- `scripts/add-default-participants.ts` - Prevention (modified)
- `scripts/cleanup-title-company-signers.ts` - Cleanup (new)
- `server/services/editor/SessionService.ts` - Session handling (modified)
- `server/services/session/LiveSigningSessionService.ts` - Live session handling (modified)

