const { storage } = await import('./server/storage.js');

async function debugUser() {
  try {
    console.log('Testing user 3...');
    const user = await storage.getUser(3);
    console.log('User data:', JSON.stringify(user, null, 2));
    
    if (user?.companyId) {
      console.log('User has companyId:', user.companyId, 'Type:', typeof user.companyId);
      
      // Test what happens when we try to get the company
      try {
        const company = await storage.getCompany(user.companyId);
        console.log('Company data:', company ? 'Found' : 'Not found');
      } catch (error) {
        console.log('Error getting company:', error.message);
      }
    } else {
      console.log('User has no companyId');
    }
  } catch (error) {
    console.error('Error getting user:', error);
  }
  
  process.exit(0);
}

debugUser();
