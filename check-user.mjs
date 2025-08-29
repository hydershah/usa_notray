import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

async function checkUser() {
  try {
    console.log('🔍 Searching for user: t@plexi.ae');
    
    // Search for user
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .ilike('email', 't@plexi.ae')
      .limit(1);
    
    if (userError) {
      console.error('❌ Error fetching user:', userError.message);
      return;
    }
    
    if (users && users.length > 0) {
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
        const { data: companies, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', user.companyId)
          .limit(1);
          
        if (companyError) {
          console.error('❌ Error fetching company:', companyError.message);
        } else if (companies && companies.length > 0) {
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
      const { data: similarUsers, error: similarError } = await supabase
        .from('users')
        .select('email')
        .ilike('email', '%plexi%')
        .limit(5);
        
      if (similarError) {
        console.error('❌ Error searching similar users:', similarError.message);
      } else if (similarUsers && similarUsers.length > 0) {
        console.log('\n🔍 Found similar emails:');
        similarUsers.forEach(u => console.log('- ', u.email));
      } else {
        console.log('\n🔍 No similar emails found.');
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkUser();
