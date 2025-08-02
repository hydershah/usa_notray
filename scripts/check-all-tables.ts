import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function checkAllTables() {
  try {
    console.log('🔍 Checking all tables...');
    
    // Get all tables
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%job%' OR table_name LIKE '%request%'
      ORDER BY table_name;
    `);
    
    console.log('Tables found:', tables.rows);
    
    // Check each table's structure
    for (const table of tables.rows) {
      const tableName = table.table_name;
      console.log(`\n📋 Table: ${tableName}`);
      
      const columns = await db.execute(sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = ${tableName}
        ORDER BY ordinal_position;
      `);
      
      console.log('Columns:', columns.rows.map(col => col.column_name));
    }
    
  } catch (error) {
    console.error('❌ Error checking tables:', error);
  }
}

checkAllTables()
  .then(() => {
    console.log('✅ Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Check failed:', error);
    process.exit(1);
  }); 