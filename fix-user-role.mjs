import pg from 'pg';
import 'dotenv/config';

const { Client } = pg;

async function fixUserRole() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('🔧 Updating user role from company_manager to title_company...');
    
    const email = 't@plexi.ae';
    
    // Update user role
    const updateQuery = `
      UPDATE users 
      SET role = 'title_company'
      WHERE LOWER(email) = $1
      RETURNING id, email, role, company_id
    `;
    
    const result = await client.query(updateQuery, [email.toLowerCase()]);
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('✅ User role updated successfully:');
      console.log('- User ID:', user.id);
      console.log('- Email:', user.email);
      console.log('- New Role:', user.role);
      console.log('- Company ID:', user.company_id);
      
      console.log('\n🎉 SUCCESS! You now have the title_company role.');
      console.log('💡 Please refresh your browser or logout/login to see the Title Company Dashboard.');
    } else {
      console.log('❌ User not found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

fixUserRole();
