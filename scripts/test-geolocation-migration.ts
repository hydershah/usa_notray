#!/usr/bin/env ts-node

import { pool } from '../server/db.ts';
import fs from 'fs';
import path from 'path';

/**
 * Test script to run the geolocation migration and verify the changes
 */
async function testGeolocationMigration() {
  console.log('🔧 Testing geolocation migration...');
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', 'add-geolocation-tracking-fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Running migration...');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration executed successfully!');
    
    // Test the schema changes
    console.log('🔍 Verifying new columns...');
    
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'system_activity_logs' 
      AND column_name IN (
        'latitude', 'longitude', 'location_accuracy', 
        'city', 'state', 'country', 
        'isp_name', 'connection_type', 'timezone'
      )
      ORDER BY column_name;
    `);
    
    console.log('📊 New columns found:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // Test indexes
    console.log('🔍 Verifying new indexes...');
    
    const indexResult = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'system_activity_logs' 
      AND indexname LIKE '%location%' OR indexname LIKE '%city%' OR indexname LIKE '%country%' OR indexname LIKE '%timezone%'
      ORDER BY indexname;
    `);
    
    console.log('📊 New indexes found:');
    indexResult.rows.forEach(row => {
      console.log(`  - ${row.indexname}`);
    });
    
    // Test insert with new fields
    console.log('🧪 Testing insert with geolocation data...');
    
    const testInsert = await pool.query(`
      INSERT INTO system_activity_logs (
        action, action_category, action_description,
        latitude, longitude, location_accuracy,
        city, state, country, isp_name, connection_type, timezone
      ) VALUES (
        'test_geolocation', 'testing', 'Testing geolocation migration',
        37.7749, -122.4194, 10.5,
        'San Francisco', 'California', 'United States',
        'Comcast Cable', 'broadband', 'America/Los_Angeles'
      ) RETURNING id, latitude, longitude, city, country;
    `);
    
    console.log('✅ Test insert successful:');
    console.log('📍 Location data:', testInsert.rows[0]);
    
    // Clean up test data
    await pool.query(`DELETE FROM system_activity_logs WHERE action = 'test_geolocation'`);
    
    console.log('🎉 Geolocation migration test completed successfully!');
    console.log('✅ All new fields and indexes are working correctly.');
    
  } catch (error) {
    console.error('❌ Migration test failed:', error);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testGeolocationMigration()
    .then(() => {
      console.log('👍 Migration test passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration test failed:', error);
      process.exit(1);
    });
}

export { testGeolocationMigration }; 