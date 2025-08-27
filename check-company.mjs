import pg from 'pg';
import 'dotenv/config';

const { Client } = pg;

async function checkCompany() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('🔍 Searching for hyder\'s Title company...');
    
    // Search for company
    const companyQuery = `
      SELECT id, company_name, primary_user_email, company_manager_id, status, created_at, approved_at
      FROM companies 
      WHERE LOWER(primary_user_email) = 't@plexi.ae' OR company_name ILIKE '%hyder%'
      LIMIT 5
    `;
    
    const companyResult = await client.query(companyQuery);
    
    if (companyResult.rows.length > 0) {
      console.log('✅ COMPANY(S) FOUND:');
      companyResult.rows.forEach((company, index) => {
        console.log(`\n📋 Company ${index + 1}:`);
        console.log('- ID:', company.id);
        console.log('- Company Name:', company.company_name);
        console.log('- Primary Email:', company.primary_user_email);
        console.log('- Manager ID:', company.company_manager_id);
        console.log('- Status:', company.status);
        console.log('- Created At:', company.created_at);
        console.log('- Approved At:', company.approved_at);
      });
      
      // Check if manager user exists for each company
      for (const company of companyResult.rows) {
        console.log(`\n🔍 Checking manager for company: ${company.company_name}`);
        
        if (company.company_manager_id) {
          const managerQuery = `
            SELECT id, email, role, company_id, approval_status, is_active
            FROM users 
            WHERE id = $1
          `;
          
          const managerResult = await client.query(managerQuery, [company.company_manager_id]);
          
          if (managerResult.rows.length > 0) {
            const manager = managerResult.rows[0];
            console.log('✅ Manager user found:');
            console.log('  - User ID:', manager.id);
            console.log('  - Email:', manager.email);
            console.log('  - Role:', manager.role);
            console.log('  - Company ID:', manager.company_id);
            console.log('  - Approval Status:', manager.approval_status);
            console.log('  - Is Active:', manager.is_active);
          } else {
            console.log('❌ Manager user NOT found!');
          }
        } else {
          console.log('⚠️ No manager ID set for this company');
          
          // Check if there's a user with this email
          const emailQuery = `
            SELECT id, email, role, company_id, approval_status, is_active
            FROM users 
            WHERE LOWER(email) = $1
          `;
          
          const emailResult = await client.query(emailQuery, [company.primary_user_email.toLowerCase()]);
          
          if (emailResult.rows.length > 0) {
            const user = emailResult.rows[0];
            console.log('✅ Found user with this email:');
            console.log('  - User ID:', user.id);
            console.log('  - Email:', user.email);
            console.log('  - Role:', user.role);
            console.log('  - Company ID:', user.company_id);
            console.log('  - Approval Status:', user.approval_status);
            console.log('  - Is Active:', user.is_active);
          } else {
            console.log('❌ No user found with email:', company.primary_user_email);
          }
        }
      }
    } else {
      console.log('❌ No companies found');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkCompany();
