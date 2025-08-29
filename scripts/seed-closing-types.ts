#!/usr/bin/env npx tsx

import { db } from '../server/db.js';
import { closingTypes } from '../shared/schema.js';

async function seedClosingTypes() {
  try {
    console.log('🌱 Seeding closing types...\n');
    
    const closingTypesToAdd = [
      {
        name: '1-4 Document',
        description: 'Standard document notarization service for 1-4 documents',
        basePrice: 2500, // $25.00 in cents
        isActive: true,
        estimatedDuration: 30, // 30 minutes
        requiresWitness: false,
        requiresNotaryTravel: false,
        travelFee: 0
      },
      {
        name: 'Title Closing - Buyer w/Cash',
        description: 'Title closing service for buyer side transactions with cash payment',
        basePrice: 14500, // $145.00 in cents
        isActive: true,
        estimatedDuration: 75, // 1h 15m = 75 minutes
        requiresWitness: false,
        requiresNotaryTravel: false,
        travelFee: 0
      },
      {
        name: 'Title Closing - Buyer w/Loan',
        description: 'Title closing service for buyer side transactions with loan financing',
        basePrice: 12000, // $120.00 in cents
        isActive: true,
        estimatedDuration: 90, // 1h 30m = 90 minutes
        requiresWitness: false,
        requiresNotaryTravel: false,
        travelFee: 0
      },
      {
        name: 'Title Closing - Joint',
        description: 'Title closing service for joint transactions involving multiple parties',
        basePrice: 15000, // $150.00 in cents
        isActive: true,
        estimatedDuration: 120, // 2h = 120 minutes
        requiresWitness: false,
        requiresNotaryTravel: false,
        travelFee: 0
      },
      {
        name: 'Title Closing - Seller Side',
        description: 'Standard title closing service for seller side transactions',
        basePrice: 12000, // $120.00 in cents
        isActive: true,
        estimatedDuration: 60, // 1h = 60 minutes
        requiresWitness: false,
        requiresNotaryTravel: false,
        travelFee: 0
      }
    ];

    console.log(`📝 Adding ${closingTypesToAdd.length} closing types...\n`);

    for (const closingType of closingTypesToAdd) {
      try {
        const [inserted] = await db
          .insert(closingTypes)
          .values(closingType)
          .returning();
        
        console.log(`✅ Added: ${inserted.name} - $${(inserted.basePrice / 100).toFixed(2)} (${inserted.estimatedDuration}min)`);
      } catch (error) {
        // Handle duplicate entries gracefully
        if (error.code === '23505') { // PostgreSQL unique constraint violation
          console.log(`⚠️  Skipped: ${closingType.name} (already exists)`);
        } else {
          console.error(`❌ Error adding ${closingType.name}:`, error);
        }
      }
    }

    console.log('\n🎉 Closing types seeding completed!');
    console.log('\n📋 Use "npx tsx scripts/check-closing-types.ts" to verify the results');

  } catch (error) {
    console.error('❌ Error seeding closing types:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seedClosingTypes();
