#!/usr/bin/env npx tsx

import { db } from '../server/db.js';
import { participantRoles } from '../shared/schema.js';

async function seedParticipantRoles() {
  try {
    console.log('🌱 Seeding participant roles...\n');
    
    const rolesToAdd = [
      // Core signer roles
      {
        name: 'signer',
        displayName: 'Signer',
        description: 'Primary document signer - signs and notarizes documents',
        category: 'signer',
        requiresSignature: true,
        requiresIdVerification: true,
        isActive: true,
        sortOrder: 1
      },
      {
        name: 'borrower',
        displayName: 'Borrower',
        description: 'Primary borrower in a loan transaction - signs loan documents',
        category: 'signer',
        requiresSignature: true,
        requiresIdVerification: true,
        isActive: true,
        sortOrder: 2
      },
      {
        name: 'co-borrower',
        displayName: 'Co-Borrower',
        description: 'Secondary borrower in a loan transaction - signs loan documents',
        category: 'signer',
        requiresSignature: true,
        requiresIdVerification: true,
        isActive: true,
        sortOrder: 3
      },
      {
        name: 'seller',
        displayName: 'Seller',
        description: 'Property seller in a real estate transaction',
        category: 'signer',
        requiresSignature: true,
        requiresIdVerification: true,
        isActive: true,
        sortOrder: 4
      },
      {
        name: 'buyer',
        displayName: 'Buyer',
        description: 'Property buyer in a real estate transaction',
        category: 'signer',
        requiresSignature: true,
        requiresIdVerification: true,
        isActive: true,
        sortOrder: 5
      },
      {
        name: 'spouse',
        displayName: 'Spouse',
        description: 'Spouse of primary signer - may need to sign certain documents',
        category: 'signer',
        requiresSignature: true,
        requiresIdVerification: true,
        isActive: true,
        sortOrder: 6
      },
      // Witness roles
      {
        name: 'witness',
        displayName: 'Witness',
        description: 'Document witness - observes signing process and may need to sign as witness',
        category: 'witness',
        requiresSignature: true,
        requiresIdVerification: true,
        isActive: true,
        sortOrder: 10
      },
      {
        name: 'credible-witness',
        displayName: 'Credible Witness',
        description: 'Credible witness who can verify signer identity when ID is not available',
        category: 'witness',
        requiresSignature: true,
        requiresIdVerification: true,
        isActive: true,
        sortOrder: 11
      },
      // Observer roles
      {
        name: 'observer',
        displayName: 'Observer',
        description: 'Session observer - can view but does not sign documents',
        category: 'observer',
        requiresSignature: false,
        requiresIdVerification: false,
        isActive: true,
        sortOrder: 20
      },
      {
        name: 'title-agent',
        displayName: 'Title Agent',
        description: 'Title company representative - observes closing process',
        category: 'observer',
        requiresSignature: false,
        requiresIdVerification: false,
        isActive: true,
        sortOrder: 21
      },
      {
        name: 'real-estate-agent',
        displayName: 'Real Estate Agent',
        description: 'Real estate agent representing buyer or seller',
        category: 'observer',
        requiresSignature: false,
        requiresIdVerification: false,
        isActive: true,
        sortOrder: 22
      },
      {
        name: 'attorney',
        displayName: 'Attorney',
        description: 'Legal counsel representing one of the parties',
        category: 'observer',
        requiresSignature: false,
        requiresIdVerification: false,
        isActive: true,
        sortOrder: 23
      },
      {
        name: 'lender-representative',
        displayName: 'Lender Representative',
        description: 'Representative from the lending institution',
        category: 'observer',
        requiresSignature: false,
        requiresIdVerification: false,
        isActive: true,
        sortOrder: 24
      }
    ];

    console.log(`📝 Adding ${rolesToAdd.length} participant roles...\n`);

    for (const role of rolesToAdd) {
      try {
        const [inserted] = await db
          .insert(participantRoles)
          .values(role)
          .returning();
        
        const categoryIcon = inserted.category === 'signer' ? '✍️' : 
                            inserted.category === 'witness' ? '👁️' : '👀';
        
        console.log(`✅ Added: ${categoryIcon} ${inserted.displayName} (${inserted.category})`);
      } catch (error) {
        // Handle duplicate entries gracefully
        if (error.code === '23505') { // PostgreSQL unique constraint violation
          console.log(`⚠️  Skipped: ${role.displayName} (already exists)`);
        } else {
          console.error(`❌ Error adding ${role.displayName}:`, error);
        }
      }
    }

    console.log('\n🎉 Participant roles seeding completed!');
    console.log('\n📊 Summary:');
    console.log('   • Signer roles: 6 (Signer, Borrower, Co-Borrower, Seller, Buyer, Spouse)');
    console.log('   • Witness roles: 2 (Witness, Credible Witness)');
    console.log('   • Observer roles: 5 (Observer, Title Agent, Real Estate Agent, Attorney, Lender Rep)');
    console.log('\n📋 Use "npx tsx scripts/check-participant-roles.ts" to verify the results');

  } catch (error) {
    console.error('❌ Error seeding participant roles:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seedParticipantRoles();
