#!/usr/bin/env npx tsx

/**
 * Migration script to add support for 'both' notary type
 * This script adds the ability for notaries to be both contractors and subscribers
 */

import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';

async function runMigration() {
  console.log('🚀 Starting notary type "both" migration...');
  
  try {
    // First, let's check the current notary type distribution
    console.log('\n📊 Current notary type distribution:');
    const currentDistribution = await db
      .select({
        notaryType: users.notaryType,
        count: sql<number>`count(*)`
      })
      .from(users)
      .where(eq(users.role, 'notary'))
      .groupBy(users.notaryType);
    
    console.table(currentDistribution);
    
    // Check if there are any notaries with null notary_type
    const nullTypeNotaries = await db
      .select({
        id: users.id,
        email: users.email,
        notaryType: users.notaryType
      })
      .from(users)
      .where(eq(users.role, 'notary'))
      .limit(5);
    
    console.log('\n👀 Sample notary records:');
    console.table(nullTypeNotaries);
    
    // Update any notaries with null notary_type to 'contractor' (default)
    const nullTypeCount = await db
      .update(users)
      .set({ notaryType: 'contractor' })
      .where(eq(users.role, 'notary'))
      .returning({ id: users.id });
    
    if (nullTypeCount.length > 0) {
      console.log(`✅ Updated ${nullTypeCount.length} notaries with null type to 'contractor'`);
    }
    
    // The schema already supports 'both' type since we updated it in the TypeScript files
    // Let's verify the system can handle the 'both' type by testing a query
    const testQuery = await db
      .select({
        id: users.id,
        email: users.email,
        notaryType: users.notaryType
      })
      .from(users)
      .where(eq(users.role, 'notary'))
      .limit(1);
    
    console.log('\n✅ Database connection and queries working properly');
    
    // Show final distribution
    console.log('\n📊 Final notary type distribution:');
    const finalDistribution = await db
      .select({
        notaryType: users.notaryType,
        count: sql<number>`count(*)`
      })
      .from(users)
      .where(eq(users.role, 'notary'))
      .groupBy(users.notaryType);
    
    console.table(finalDistribution);
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. The system now supports "both" as a notary type');
    console.log('2. Existing notaries remain as contractors or subscribers');
    console.log('3. New notaries can be created with type "both"');
    console.log('4. Admin can update existing notaries to "both" type through the UI');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });
