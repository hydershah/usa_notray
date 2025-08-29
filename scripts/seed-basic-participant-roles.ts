#!/usr/bin/env npx tsx

import { db } from '../server/db.js';
import { participantRoles } from '../shared/schema.js';

async function seedBasicParticipantRoles() {
  try {
    console.log('🌱 Seeding basic participant roles...\n');
    
    const rolesToAdd = [
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

    console.log(`📝 Adding ${rolesToAdd.length} basic participant roles...\n`);

    // First, clear existing roles to start fresh
    await db.delete(participantRoles);
    console.log('🗑️  Cleared existing participant roles\n');

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
        console.error(`❌ Error adding ${role.displayName}:`, error);
      }
    }

    console.log('\n🎉 Basic participant roles seeding completed!');
    console.log('\n📊 Added:');
    console.log('   • ✍️ Signer (signs documents, requires ID verification)');
    console.log('   • 👁️ Witness (observes, requires ID verification)');
    console.log('   • 👀 Observer (observes only, no ID verification required)');

  } catch (error) {
    console.error('❌ Error seeding participant roles:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seedBasicParticipantRoles();
