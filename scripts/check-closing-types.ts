#!/usr/bin/env npx tsx

import { db } from '../server/db.js';
import { closingTypes } from '../shared/schema.js';
import { asc } from 'drizzle-orm';

async function checkClosingTypes() {
  try {
    console.log('🔍 Checking existing closing types...\n');
    
    // Get all closing types
    const allClosingTypes = await db
      .select()
      .from(closingTypes)
      .orderBy(asc(closingTypes.name));
    
    if (allClosingTypes.length === 0) {
      console.log('❌ No closing types found in database');
      console.log('\n💡 You may need to seed the database with default closing types');
      return;
    }
    
    console.log(`✅ Found ${allClosingTypes.length} closing types:\n`);
    
    // Display all closing types in a table format
    console.log('ID'.padEnd(4), 'Name'.padEnd(25), 'Base Price'.padEnd(12), 'Active'.padEnd(8), 'Duration'.padEnd(10), 'Witness'.padEnd(8), 'Travel'.padEnd(8));
    console.log('---'.padEnd(4), '----'.padEnd(25), '----------'.padEnd(12), '------'.padEnd(8), '--------'.padEnd(10), '-------'.padEnd(8), '------'.padEnd(8));
    
    allClosingTypes.forEach(ct => {
      const basePrice = ct.basePrice ? `$${(ct.basePrice / 100).toFixed(2)}` : 'N/A';
      const duration = ct.estimatedDuration ? `${ct.estimatedDuration}min` : 'N/A';
      const active = ct.isActive ? '✅' : '❌';
      const witness = ct.requiresWitness ? '✅' : '❌';
      const travel = ct.requiresNotaryTravel ? '✅' : '❌';
      
      console.log(
        ct.id.toString().padEnd(4),
        ct.name.padEnd(25),
        basePrice.padEnd(12),
        active.padEnd(8),
        duration.padEnd(10),
        witness.padEnd(8),
        travel.padEnd(8)
      );
    });
    
    console.log('\n📊 Summary:');
    const activeCount = allClosingTypes.filter(ct => ct.isActive).length;
    const inactiveCount = allClosingTypes.length - activeCount;
    console.log(`   • Active: ${activeCount}`);
    console.log(`   • Inactive: ${inactiveCount}`);
    console.log(`   • Total: ${allClosingTypes.length}`);
    
    // Show details for each closing type
    console.log('\n📋 Detailed Information:');
    allClosingTypes.forEach(ct => {
      console.log(`\n🏷️  ${ct.name} (ID: ${ct.id})`);
      console.log(`   Description: ${ct.description || 'N/A'}`);
      console.log(`   Base Price: $${ct.basePrice ? (ct.basePrice / 100).toFixed(2) : '0.00'}`);
      console.log(`   Estimated Duration: ${ct.estimatedDuration || 'N/A'} minutes`);
      console.log(`   Requires Witness: ${ct.requiresWitness ? 'Yes' : 'No'}`);
      console.log(`   Requires Travel: ${ct.requiresNotaryTravel ? 'Yes' : 'No'}`);
      console.log(`   Travel Fee: $${ct.travelFee ? (ct.travelFee / 100).toFixed(2) : '0.00'}`);
      console.log(`   Status: ${ct.isActive ? 'Active' : 'Inactive'}`);
      console.log(`   Created: ${ct.createdAt ? new Date(ct.createdAt).toLocaleString() : 'N/A'}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking closing types:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

checkClosingTypes();
