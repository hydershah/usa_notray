import pg from 'pg';
import bcrypt from 'bcrypt';
import 'dotenv/config';

const { Client } = pg;

async function createMissingUser() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('🔧 Creating missing user account for t@plexi.ae...');
    
    // Company details
    const companyId = 13;
    const email = 't@plexi.ae';
    const username = email;
    const fullName = 'hyder';
    const password = 'temporary123'; // User should change this
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const createUserQuery = `
      INSERT INTO users (
        username, email, password, role, company_id, company_role,
        full_name, approval_status, is_active, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()
      ) RETURNING id, email, role
    `;
    
    const userResult = await client.query(createUserQuery, [
      username,           // $1
      email,             // $2  
      hashedPassword,    // $3
      'company_manager', // $4
      companyId,         // $5
      'manager',         // $6
      fullName,          // $7
      'approved',        // $8
      true              // $9
    ]);
    
    const newUser = userResult.rows[0];
    console.log('✅ User created successfully:');
    console.log('- User ID:', newUser.id);
    console.log('- Email:', newUser.email);
    console.log('- Role:', newUser.role);
    console.log('- Temporary Password:', password);
    
    // Update company to link the manager
    const updateCompanyQuery = `
      UPDATE companies 
      SET company_manager_id = $1, last_modified_by = $1
      WHERE id = $2
      RETURNING company_name, company_manager_id
    `;
    
    const companyResult = await client.query(updateCompanyQuery, [newUser.id, companyId]);
    const updatedCompany = companyResult.rows[0];
    
    console.log('✅ Company updated successfully:');
    console.log('- Company:', updatedCompany.company_name);
    console.log('- Manager ID:', updatedCompany.company_manager_id);
    
    console.log('\n🎉 SUCCESS! The user can now login with:');
    console.log('- Email:', email);
    console.log('- Password:', password);
    console.log('\n⚠️  IMPORTANT: Ask the user to change their password after first login!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === '23505') {
      console.log('💡 User might already exist. Let me check...');
      
      const checkUserQuery = `SELECT id, email FROM users WHERE LOWER(email) = $1`;
      const existingUser = await client.query(checkUserQuery, [email.toLowerCase()]);
      
      if (existingUser.rows.length > 0) {
        console.log('✅ User already exists:', existingUser.rows[0]);
      }
    }
  } finally {
    await client.end();
  }
}

createMissingUser();
