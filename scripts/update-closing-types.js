#!/usr/bin/env node

/**
 * Script to update closing types with new default values
 * Run with: node scripts/update-closing-types.js
 */

const { Client } = require('pg');

// Database connection configuration
const dbConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/notary_platform',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

async function updateClosingTypes() {
  const client = new Client(dbConfig);
  
  try {
    console.log('🔄 Starting closing types update...');
    console.log('🔗 Connecting to database...');
    
    await client.connect();
    console.log('✅ Database connected successfully!');

    // Clear existing closing types
    console.log('🗑️  Clearing existing closing types...');
    await client.query('DELETE FROM closing_types');
    console.log('✅ Existing closing types cleared');

    // Reset the sequence
    console.log('🔄 Resetting ID sequence...');
    await client.query('ALTER SEQUENCE closing_types_id_seq RESTART WITH 1');
    console.log('✅ ID sequence reset');

    // Define new closing types
    const newClosingTypes = [
      {
        name: 'Title Closing - Seller Side',
        description: 'Standard title closing service for seller side transactions',
        basePrice: 12000, // $120.00 in cents
        isActive: true,
        estimatedDuration: 60, // 60 minutes
        requiresWitness: false,
        requiresNotaryTravel: false,
        travelFee: 0,
      },
      {
        name: 'Title Closing - Buyer w/Cash',
        description: 'Title closing service for buyer side transactions with cash payment',
        basePrice: 14500, // $145.00 in cents
        isActive: true,
        estimatedDuration: 75, // 75 minutes
        requiresWitness: false,
        requiresNotaryTravel: false,
        travelFee: 0,
      },
      {
        name: 'Title Closing - Buyer w/Loan',
        description: 'Title closing service for buyer side transactions with loan financing',
        basePrice: 12000, // $120.00 in cents
        isActive: true,
        estimatedDuration: 90, // 90 minutes
        requiresWitness: false,
        requiresNotaryTravel: false,
        travelFee: 0,
      },
      {
        name: 'Title Closing - Joint',
        description: 'Title closing service for joint transactions involving multiple parties',
        basePrice: 15000, // $150.00 in cents
        isActive: true,
        estimatedDuration: 120, // 120 minutes
        requiresWitness: false,
        requiresNotaryTravel: false,
        travelFee: 0,
      },
      {
        name: '1-4 Document',
        description: 'Standard document notarization service for 1-4 documents',
        basePrice: 2500, // $25.00 in cents
        isActive: true,
        estimatedDuration: 30, // 30 minutes
        requiresWitness: false,
        requiresNotaryTravel: false,
        travelFee: 0,
      },
    ];

    // Insert new closing types
    console.log('📝 Inserting new closing types...');
    
    for (const closingType of newClosingTypes) {
      const query = `
        INSERT INTO closing_types (
          name, description, base_price, is_active, 
          estimated_duration, requires_witness, 
          requires_notary_travel, travel_fee, 
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      `;
      
      const values = [
        closingType.name,
        closingType.description,
        closingType.basePrice,
        closingType.isActive,
        closingType.estimatedDuration,
        closingType.requiresWitness,
        closingType.requiresNotaryTravel,
        closingType.travelFee,
      ];
      
      await client.query(query, values);
    }
    
    console.log(`✅ Successfully inserted ${newClosingTypes.length} closing types`);

    // Verify the results
    console.log('🔍 Verifying results...');
    const result = await client.query('SELECT id, name, base_price, is_active FROM closing_types ORDER BY id');
    
    // Display the results
    console.log('\n📋 Updated Closing Types:');
    console.log('='.repeat(60));
    result.rows.forEach((type, index) => {
      const price = (type.base_price / 100).toFixed(2);
      console.log(`${index + 1}. ${type.name} - $${price}`);
    });
    console.log('='.repeat(60));

    console.log('\n✅ Closing types update completed successfully!');
    console.log('\n💡 Admin can now manage these types through the admin interface at:');
    console.log('   /closing-types');

  } catch (error) {
    console.error('❌ Error updating closing types:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the update
updateClosingTypes().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}); 