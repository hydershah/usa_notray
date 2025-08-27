import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import 'dotenv/config';

// Create database connection using the same approach as your app
const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

async function checkUser() {
  try {
    console.log('🔍 Searching for user: t@plexi.ae');
    
    // Use raw SQL query since we don't have schema imports easily available
    const users = await client`
      SELECT id, email, role, "companyId", "approvalStatus", "isActive", "createdAt"
      FROM users 
      WHERE LOWER(email) = 't@plexi.ae'
      LIMIT 1
    `;
    
    if (users.length > 0) {
      const user = users[0];
      console.log('✅ USER FOUND:');
      console.log('- ID:', user.id);
      console.log('- Email:', user.email);
      console.log('- Role:', user.role);
      console.log('- Company ID:', user.companyId);
      console.log('- Approval Status:', user.approvalStatus);
      console.log('- Is Active:', user.isActive);
      console.log('- Created At:', user.createdAt);
      
      if (user.companyId) {
        const companies = await client`
          SELECT id, "companyName", status, "approvedAt", "approvedBy", "createdAt"
          FROM companies 
          WHERE id = ${user.companyId}
          LIMIT 1
        `;
          
        if (companies.length > 0) {
          const company = companies[0];
          console.log('\n📋 COMPANY DETAILS:');
          console.log('- Company Name:', company.companyName);
          console.log('- Company Status:', company.status);
          console.log('- Approved At:', company.approvedAt);
          console.log('- Approved By:', company.approvedBy);
          console.log('- Created At:', company.createdAt);
        }
      }
    } else {
      console.log('❌ USER NOT FOUND: t@plexi.ae');
      
      // Check if any similar emails exist
      const similarUsers = await client`
        SELECT email
        FROM users 
        WHERE email ILIKE '%plexi%'
        LIMIT 5
      `;
        
      if (similarUsers.length > 0) {
        console.log('\n🔍 Found similar emails:');
        similarUsers.forEach(u => console.log('- ', u.email));
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

checkUser();
