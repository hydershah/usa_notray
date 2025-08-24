const { Pool } = require('pg');

// Database connection
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('supabase.co') ? { rejectUnauthorized: false } : false
});

async function testEnhancedAuditLogging() {
  console.log('🔍 Testing enhanced audit logging with location data...');
  
  try {
    // Test inserting a log entry with location data
    console.log('📝 Inserting test audit log with location data...');
    
    const testLogEntry = {
      action: 'test_location_tracking',
      action_category: 'testing',
      action_description: 'Testing enhanced audit logging with location data',
      
      // User info
      user_role: 'admin',
      user_email: 'test@example.com',
      user_name: 'Test User',
      
      // Request info
      request_method: 'POST',
      request_path: '/api/test',
      ip_address: '192.168.1.100',
      user_agent: 'Mozilla/5.0 (Test Browser)',
      
      // Location data (new fields)
      latitude: 37.7749,
      longitude: -122.4194,
      location_accuracy: 10.5,
      city: 'San Francisco',
      state: 'California',
      country: 'United States',
      timezone: 'America/Los_Angeles',
      isp_name: 'Test ISP',
      connection_type: 'broadband',
      
      // Status
      severity: 'info',
      is_system_action: false,
      is_successful: true
    };
    
    const insertQuery = `
      INSERT INTO system_activity_logs (
        action, action_category, action_description,
        user_role, user_email, user_name,
        request_method, request_path, ip_address, user_agent,
        latitude, longitude, location_accuracy,
        city, state, country, timezone, isp_name, connection_type,
        severity, is_system_action, is_successful
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19,
        $20, $21, $22
      ) RETURNING id, latitude, longitude, city, country, timezone;
    `;
    
    const values = [
      testLogEntry.action, testLogEntry.action_category, testLogEntry.action_description,
      testLogEntry.user_role, testLogEntry.user_email, testLogEntry.user_name,
      testLogEntry.request_method, testLogEntry.request_path, testLogEntry.ip_address, testLogEntry.user_agent,
      testLogEntry.latitude, testLogEntry.longitude, testLogEntry.location_accuracy,
      testLogEntry.city, testLogEntry.state, testLogEntry.country, testLogEntry.timezone, 
      testLogEntry.isp_name, testLogEntry.connection_type,
      testLogEntry.severity, testLogEntry.is_system_action, testLogEntry.is_successful
    ];
    
    const result = await pool.query(insertQuery, values);
    
    console.log('✅ Successfully inserted audit log with location data!');
    console.log('📍 Inserted record:', result.rows[0]);
    
    // Verify the data was inserted correctly
    console.log('🔍 Verifying inserted data...');
    
    const verifyQuery = `
      SELECT id, action, city, country, timezone, latitude, longitude, created_at
      FROM system_activity_logs 
      WHERE action = 'test_location_tracking'
      ORDER BY created_at DESC 
      LIMIT 1;
    `;
    
    const verifyResult = await pool.query(verifyQuery);
    
    if (verifyResult.rows.length > 0) {
      const record = verifyResult.rows[0];
      console.log('✅ Verification successful:');
      console.log(`  🆔 ID: ${record.id}`);
      console.log(`  📍 Location: ${record.city}, ${record.country}`);
      console.log(`  🌐 Coordinates: ${record.latitude}, ${record.longitude}`);
      console.log(`  ⏰ Timezone: ${record.timezone}`);
      console.log(`  📅 Created: ${record.created_at}`);
    } else {
      throw new Error('Verification failed - no record found');
    }
    
    // Clean up test data
    await pool.query(`DELETE FROM system_activity_logs WHERE action = 'test_location_tracking'`);
    console.log('🧹 Test data cleaned up');
    
    console.log('🎉 Enhanced audit logging test completed successfully!');
    
  } catch (error) {
    console.error('❌ Enhanced audit logging test failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the test
testEnhancedAuditLogging()
  .then(() => {
    console.log('👍 Enhanced audit logging test passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Enhanced audit logging test failed:', error);
    process.exit(1);
  }); 