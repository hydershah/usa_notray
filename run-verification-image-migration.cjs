const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/notary_app',
  });

  try {
    await client.connect();
    console.log('🔌 Connected to database');

    // Read the migration SQL file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migration-add-verification-image-urls.sql'),
      'utf8'
    );

    console.log('📄 Running verification image URL migration...');
    await client.query(migrationSQL);
    console.log('✅ Migration completed successfully!');

    // Verify the columns were added
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('verification_image_front_url', 'verification_image_back_url', 'verification_image_selfie_url')
    `);

    console.log('📊 Added columns:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

runMigration(); 