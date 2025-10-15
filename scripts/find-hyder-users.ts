import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function findHyderUsers() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    console.log('Searching for users with "hyder" in name or email...\n');
    
    const result = await client.query(`
      SELECT 
        id,
        email,
        first_name,
        last_name,
        role,
        username
      FROM users
      WHERE 
        LOWER(email) LIKE '%hyder%'
        OR LOWER(first_name) LIKE '%hyder%'
        OR LOWER(last_name) LIKE '%hyder%'
        OR LOWER(username) LIKE '%hyder%'
      ORDER BY role, id
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No users found with "hyder" in their details');
    } else {
      console.log(`✅ Found ${result.rows.length} user(s):\n`);
      result.rows.forEach(row => {
        console.log(`ID: ${row.id}`);
        console.log(`Email: ${row.email}`);
        console.log(`Name: ${row.first_name} ${row.last_name}`);
        console.log(`Username: ${row.username || 'N/A'}`);
        console.log(`Role: ${row.role}`);
        console.log('---');
      });
    }
    
    await client.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

findHyderUsers();
