#!/usr/bin/env npx tsx

import { db } from '../server/db.js';
import { participantRoles } from '../shared/schema.js';
import { asc } from 'drizzle-orm';

async function checkParticipantRoles() {
  try {
    console.log('🔍 Checking existing participant roles...\n');
    
    // Get all participant roles
    const allRoles = await db
      .select()
      .from(participantRoles)
      .orderBy(asc(participantRoles.sortOrder), asc(participantRoles.name));
    
    if (allRoles.length === 0) {
      console.log('❌ No participant roles found in database');
      console.log('\n💡 You may need to seed the database with default participant roles');
      return;
    }
    
    console.log(`✅ Found ${allRoles.length} participant roles:\n`);
    
    // Display all roles in a table format
    console.log('ID'.padEnd(4), 'Name'.padEnd(20), 'Display Name'.padEnd(30), 'Category'.padEnd(12), 'Signs'.padEnd(6), 'ID Ver'.padEnd(7), 'Active'.padEnd(7));
    console.log('---'.padEnd(4), '----'.padEnd(20), '------------'.padEnd(30), '--------'.padEnd(12), '-----'.padEnd(6), '------'.padEnd(7), '------'.padEnd(7));
    
    allRoles.forEach(role => {
      const signs = role.requiresSignature ? '✅' : '❌';
      const idVer = role.requiresIdVerification ? '✅' : '❌';
      const active = role.isActive ? '✅' : '❌';
      
      console.log(
        role.id.toString().padEnd(4),
        role.name.padEnd(20),
        role.displayName.padEnd(30),
        role.category.padEnd(12),
        signs.padEnd(6),
        idVer.padEnd(7),
        active.padEnd(7)
      );
    });
    
    console.log('\n📊 Summary by Category:');
    const categories = [...new Set(allRoles.map(r => r.category))];
    categories.forEach(category => {
      const categoryRoles = allRoles.filter(r => r.category === category);
      const activeCount = categoryRoles.filter(r => r.isActive).length;
      console.log(`   • ${category}: ${activeCount}/${categoryRoles.length} active`);
    });
    
    // Show details for each role
    console.log('\n📋 Detailed Information:');
    allRoles.forEach(role => {
      console.log(`\n🏷️  ${role.displayName} (${role.name})`);
      console.log(`   Category: ${role.category}`);
      console.log(`   Description: ${role.description || 'N/A'}`);
      console.log(`   Requires Signature: ${role.requiresSignature ? 'Yes' : 'No'}`);
      console.log(`   Requires ID Verification: ${role.requiresIdVerification ? 'Yes' : 'No'}`);
      console.log(`   Sort Order: ${role.sortOrder}`);
      console.log(`   Status: ${role.isActive ? 'Active' : 'Inactive'}`);
      console.log(`   Created: ${role.createdAt ? new Date(role.createdAt).toLocaleString() : 'N/A'}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking participant roles:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

checkParticipantRoles();
