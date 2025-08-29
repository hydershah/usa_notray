#!/usr/bin/env npx tsx

/**
 * Seed Essential Data for Production
 * Seeds closing types, participant roles, and admin user
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { closingTypes, participantRoles, users } from '../shared/schema.js';
import { sql } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import * as schema from '../shared/schema.js';

async function seedEssentialData() {
  let pool: Pool | null = null;
  
  try {
    console.log('🌱 Seeding Essential Data for Production\n');

    // Get database URL from environment
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 5,
    });

    const db = drizzle({ client: pool, schema });

    console.log('🔗 Connected to production database');

    // 1. Seed Closing Types
    console.log('🏷️  Seeding Closing Types...');
    const closingTypesData = [
      {
        name: '1-4 Document',
        description: 'Standard document notarization service for 1-4 documents',
        basePrice: 2500, // $25.00
        isActive: true,
        estimatedDuration: 30,
        requiresWitness: false,
        requiresNotaryTravel: false,
        travelFee: 0
      },
      {
        name: 'Title Closing - Buyer w/Cash',
        description: 'Title closing service for buyer side transactions with cash payment',
        basePrice: 14500, // $145.00
        isActive: true,
        estimatedDuration: 75,
        requiresWitness: false,
        requiresNotaryTravel: false,
        travelFee: 0
      },
      {
        name: 'Title Closing - Buyer w/Loan',
        description: 'Title closing service for buyer side transactions with loan financing',
        basePrice: 12000, // $120.00
        isActive: true,
        estimatedDuration: 90,
        requiresWitness: false,
        requiresNotaryTravel: false,
        travelFee: 0
      },
      {
        name: 'Title Closing - Joint',
        description: 'Title closing service for joint transactions involving multiple parties',
        basePrice: 15000, // $150.00
        isActive: true,
        estimatedDuration: 120,
        requiresWitness: false,
        requiresNotaryTravel: false,
        travelFee: 0
      },
      {
        name: 'Title Closing - Seller Side',
        description: 'Standard title closing service for seller side transactions',
        basePrice: 12000, // $120.00
        isActive: true,
        estimatedDuration: 60,
        requiresWitness: false,
        requiresNotaryTravel: false,
        travelFee: 0
      }
    ];

    for (const closingType of closingTypesData) {
      try {
        await db.insert(closingTypes).values(closingType).onConflictDoNothing();
        console.log(`   ✅ ${closingType.name} - $${(closingType.basePrice / 100).toFixed(2)}`);
      } catch (error) {
        console.log(`   ⚠️  ${closingType.name} - already exists or error: ${error.message}`);
      }
    }

    // 2. Seed Participant Roles
    console.log('\n👥 Seeding Participant Roles...');
    const rolesData = [
      {
        name: 'signer',
        displayName: 'Signer',
        description: 'Document signer - signs and notarizes documents',
        category: 'signer',
        requiresSignature: true,
        requiresIdVerification: true,
        isActive: true,
        sortOrder: 1
      },
      {
        name: 'witness',
        displayName: 'Witness',
        description: 'Document witness - observes signing process',
        category: 'witness',
        requiresSignature: false,
        requiresIdVerification: true,
        isActive: true,
        sortOrder: 2
      },
      {
        name: 'observer',
        displayName: 'Observer',
        description: 'Session observer - can view but does not sign documents',
        category: 'observer',
        requiresSignature: false,
        requiresIdVerification: false,
        isActive: true,
        sortOrder: 3
      }
    ];

    for (const role of rolesData) {
      try {
        await db.insert(participantRoles).values(role).onConflictDoNothing();
        console.log(`   ✅ ${role.displayName} (${role.category})`);
      } catch (error) {
        console.log(`   ⚠️  ${role.displayName} - already exists or error: ${error.message}`);
      }
    }

    // 3. Create Default Admin User
    console.log('\n👤 Creating Default Admin User...');
    const adminPassword = await bcrypt.hash('admin123', 10);
    
    try {
      await db.insert(users).values({
        username: 'admin',
        email: 'admin@usanotary.net',
        password: adminPassword,
        role: 'admin',
        firstName: 'System',
        lastName: 'Administrator',
        fullName: 'System Administrator',
        isActive: true,
        emailVerified: true,
        profileComplete: true,
        accountSetupComplete: true
      }).onConflictDoNothing();
      
      console.log('   ✅ Default admin user created: admin@usanotary.net / admin123');
      
    } catch (error) {
      console.log('   ⚠️  Admin user already exists or error:', error.message);
    }

    // 4. Verify Data
    console.log('\n🔍 Verifying seeded data...');
    
    const closingTypeCount = await db.execute(sql`SELECT COUNT(*) as count FROM closing_types WHERE is_active = true;`);
    const rolesCount = await db.execute(sql`SELECT COUNT(*) as count FROM participant_roles WHERE is_active = true;`);
    const usersCount = await db.execute(sql`SELECT COUNT(*) as count FROM users WHERE is_active = true;`);
    
    console.log(`   📊 Closing Types: ${closingTypeCount.rows[0].count}`);
    console.log(`   👥 Participant Roles: ${rolesCount.rows[0].count}`);
    console.log(`   👤 Active Users: ${usersCount.rows[0].count}`);

    console.log('\n🎉 Essential Data Seeding Complete!');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedEssentialData();
}

export default seedEssentialData;
