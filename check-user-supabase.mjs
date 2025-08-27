import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Use service role key for admin access (you may need to add this to your .env)
// For now, let's try with the connection string directly using pg
import pg from 'pg';
const { Client } = pg;

async function checkUserWithPg() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('🔍 Searching for user: t@plexi.ae');
    
    // Search for user
    const userQuery = `
      SELECT id, email, role, company_id, approval_status, is_active, created_at
      FROM users 
      WHERE LOWER(email) = 't@plexi.ae'
      LIMIT 1
    `;
    
    const userResult = await client.query(userQuery);
    
    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      console.log('✅ USER FOUND:');
      console.log('- ID:', user.id);
      console.log('- Email:', user.email);
      console.log('- Role:', user.role);
      console.log('- Company ID:', user.company_id);
      console.log('- Approval Status:', user.approval_status);
      console.log('- Is Active:', user.is_active);
      console.log('- Created At:', user.created_at);
      
      if (user.company_id) {
        const companyQuery = `
          SELECT id, company_name, status, approved_at, approved_by, created_at
          FROM companies 
          WHERE id = $1
          LIMIT 1
        `;
        
        const companyResult = await client.query(companyQuery, [user.company_id]);
          
        if (companyResult.rows.length > 0) {
          const company = companyResult.rows[0];
          console.log('\n📋 COMPANY DETAILS:');
          console.log('- Company Name:', company.company_name);
          console.log('- Company Status:', company.status);
          console.log('- Approved At:', company.approved_at);
          console.log('- Approved By:', company.approved_by);
          console.log('- Created At:', company.created_at);
        }
      }
    } else {
      console.log('❌ USER NOT FOUND: t@plexi.ae');
      
      // Check if any similar emails exist
      const similarQuery = `
        SELECT email
        FROM users 
        WHERE email ILIKE '%plexi%'
        LIMIT 5
      `;
      
      const similarResult = await client.query(similarQuery);
        
      if (similarResult.rows.length > 0) {
        console.log('\n🔍 Found similar emails:');
        similarResult.rows.forEach(u => console.log('- ', u.email));
      } else {
        console.log('\n🔍 No similar emails found.');
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkUserWithPg();
