import bcrypt from 'bcrypt';
import { db } from '../server/db.ts';
import { users } from '@shared/schema';

async function setupTestUsers() {
  console.log('🚀 Setting up test users...');

  const testUsers = [
    {
      email: 'Chris_yon38@yahoo.com',
      role: 'notary',
      fullName: 'Chris Yon',
      phoneNumber: '555-0001',
      password: 'TestPassword123!',
      notaryType: 'contractor',
      isActive: true,
      approvalStatus: 'approved',
      address1: '123 Notary St',
      city: 'Test City',
      state: 'TX',
      zipCode: '12345',
      commissionNumber: 'TX123456',
      commissionExpiration: '2025-12-31',
      county: 'Test County',
      isNotificationsEnabled: true,
      mfaEnabled: false,
      foreignLanguages: []
    },
    {
      email: 'ryon341@gmail.com',
      role: 'client',
      fullName: 'Ryan Test',
      phoneNumber: '555-0002',
      password: 'TestPassword123!',
      isActive: true,
      approvalStatus: 'approved',
      address1: '456 Signer Ave',
      city: 'Test City',
      state: 'TX',
      zipCode: '12345',
      isNotificationsEnabled: true,
      mfaEnabled: false,
      foreignLanguages: []
    },
    {
      email: 'ryon341+1@gmail.com',
      role: 'title_company',
      fullName: 'Ryan Title Agent',
      phoneNumber: '555-0003',
      password: 'TestPassword123!',
      isActive: true,
      approvalStatus: 'approved',
      address1: '789 Title Blvd',
      city: 'Test City',
      state: 'TX',
      zipCode: '12345',
      isNotificationsEnabled: true,
      mfaEnabled: false,
      foreignLanguages: []
    },
    {
      email: 'Admin@usanotary.net',
      role: 'admin',
      fullName: 'System Admin',
      phoneNumber: '555-0004',
      password: 'TestPassword123!',
      isActive: true,
      approvalStatus: 'approved',
      address1: '321 Admin Way',
      city: 'Test City',
      state: 'TX',
      zipCode: '12345',
      isNotificationsEnabled: true,
      mfaEnabled: false,
      foreignLanguages: []
    },
    {
      email: 'support@notaryschedule.net',
      role: 'notary',
      fullName: 'Support Multi-Role',
      phoneNumber: '555-0005',
      password: 'TestPassword123!',
      notaryType: 'contractor',
      isActive: true,
      approvalStatus: 'approved',
      address1: '654 Support Dr',
      city: 'Test City',
      state: 'TX',
      zipCode: '12345',
      commissionNumber: 'TX789012',
      commissionExpiration: '2025-12-31',
      county: 'Test County',
      isNotificationsEnabled: true,
      mfaEnabled: false,
      foreignLanguages: []
    }
  ];

  for (const userData of testUsers) {
    try {
      // Check if user already exists
      const existingUser = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.email, userData.email)
      });

      if (existingUser) {
        console.log(`⚠️  User ${userData.email} already exists, skipping...`);
        continue;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Create user
      const [newUser] = await db.insert(users).values({
        username: userData.email,
        email: userData.email,
        password: hashedPassword,
        role: userData.role,
        firstName: userData.fullName.split(' ')[0] || '',
        lastName: userData.fullName.split(' ').slice(1).join(' ') || '',
        fullName: userData.fullName,
        phoneNumber: userData.phoneNumber,
        address1: userData.address1,
        city: userData.city,
        state: userData.state,
        zipCode: userData.zipCode,
        notaryType: userData.notaryType,
        isActive: userData.isActive,
        approvalStatus: userData.approvalStatus,
        commissionNumber: userData.commissionNumber,
        commissionExpiration: userData.commissionExpiration,
        county: userData.county,
        isNotificationsEnabled: userData.isNotificationsEnabled,
        mfaEnabled: userData.mfaEnabled,
        foreignLanguages: userData.foreignLanguages,
        privileges: getDefaultPrivileges(userData.role, userData.notaryType)
      }).returning();

      console.log(`✅ Created user: ${newUser.email} (ID: ${newUser.id}) as ${newUser.role}`);
    } catch (error) {
      console.error(`❌ Error creating user ${userData.email}:`, error.message);
    }
  }

  console.log('🎉 Test users setup complete!');
  console.log('\n📋 Test User Summary:');
  console.log('Chris_yon38@yahoo.com - Notary (Contractor)');
  console.log('ryon341@gmail.com - Signer/Basic User');
  console.log('ryon341+1@gmail.com - Title Agent');
  console.log('Admin@usanotary.net - Admin');
  console.log('support@notaryschedule.net - Notary (Contractor)');
  console.log('\n🔑 All users have password: TestPassword123!');
}

function getDefaultPrivileges(role, notaryType) {
  switch (role) {
    case 'admin':
      return ['dashboard', 'users', 'companies', 'jobs', 'create_job', 'notarization_logs', 'system_settings', 'admin_panel'];
    case 'title_company':
      return ['dashboard', 'jobs', 'create_job', 'manage_signers'];
    case 'notary':
      if (notaryType === 'subscriber') {
        return ['dashboard', 'jobs', 'create_job', 'notarization_logs', 'manage_own_clients'];
      } else {
        return ['dashboard', 'jobs', 'notarization_logs'];
      }
    case 'client':
      return ['dashboard', 'view_assigned_jobs', 'sign_documents'];
    default:
      return [];
  }
}

// Run the setup
setupTestUsers()
  .then(() => {
    console.log('✅ Test users setup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error setting up test users:', error);
    process.exit(1);
  }); 