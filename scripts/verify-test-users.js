import { db } from '../server/db.ts';
import { users } from '@shared/schema';

async function verifyTestUsers() {
  console.log('🔍 Verifying test users...');

  const testEmails = [
    'Chris_yon38@yahoo.com',
    'ryon341@gmail.com',
    'ryon341+1@gmail.com',
    'Admin@usanotary.net',
    'support@notaryschedule.net'
  ];

  console.log('\n📋 Test User Verification Results:');
  console.log('=====================================');

  for (const email of testEmails) {
    try {
      const user = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.email, email)
      });

      if (user) {
        console.log(`✅ ${email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Active: ${user.isActive ? 'Yes' : 'No'}`);
        console.log(`   Approval Status: ${user.approvalStatus}`);
        if (user.notaryType) {
          console.log(`   Notary Type: ${user.notaryType}`);
        }
        if (user.privileges && user.privileges.length > 0) {
          console.log(`   Privileges: ${user.privileges.join(', ')}`);
        }
        console.log(`   ID: ${user.id}`);
        console.log('');
      } else {
        console.log(`❌ ${email} - NOT FOUND`);
        console.log('');
      }
    } catch (error) {
      console.error(`❌ Error checking user ${email}:`, error.message);
    }
  }

  console.log('🎉 Verification complete!');
  console.log('\n📝 Login Information:');
  console.log('All users have password: TestPassword123!');
  console.log('\n🔐 Expected Roles:');
  console.log('- Chris_yon38@yahoo.com → Notary (Contractor)');
  console.log('- ryon341@gmail.com → Client/Signer');
  console.log('- ryon341+1@gmail.com → Title Company');
  console.log('- Admin@usanotary.net → Admin');
  console.log('- support@notaryschedule.net → Notary (Contractor)');
}

// Run the verification
verifyTestUsers()
  .then(() => {
    console.log('✅ Verification completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error during verification:', error);
    process.exit(1);
  }); 