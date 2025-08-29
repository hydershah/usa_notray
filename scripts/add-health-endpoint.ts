#!/usr/bin/env npx tsx

/**
 * Script to add health endpoint to server/index.ts
 * This ensures we have a health check endpoint for deployment
 */

import { readFileSync, writeFileSync } from 'fs';

async function addHealthEndpoint() {
  try {
    console.log('🔍 Adding health endpoint to server...');
    
    const serverPath = 'server/index.ts';
    let serverContent = readFileSync(serverPath, 'utf8');
    
    // Check if health endpoint already exists
    if (serverContent.includes('/health') || serverContent.includes('health')) {
      console.log('✅ Health endpoint already exists');
      return;
    }
    
    // Find a good place to add the health endpoint (after express setup)
    const healthEndpoint = `
// Health check endpoint for deployment
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});
`;
    
    // Add health endpoint after express setup but before other routes
    let insertPoint = serverContent.indexOf('app.use(express.json');
    if (insertPoint === -1) {
      insertPoint = serverContent.indexOf('app.listen') - 1;
    }
    
    if (insertPoint > 0) {
      const beforeInsert = serverContent.substring(0, insertPoint);
      const afterInsert = serverContent.substring(insertPoint);
      
      serverContent = beforeInsert + healthEndpoint + '\n' + afterInsert;
      
      writeFileSync(serverPath, serverContent);
      console.log('✅ Health endpoint added to server/index.ts');
    } else {
      console.log('⚠️  Could not find suitable insertion point. Please add health endpoint manually.');
      console.log('Add this code to your server/index.ts:');
      console.log(healthEndpoint);
    }
    
  } catch (error) {
    console.error('❌ Error adding health endpoint:', error.message);
    console.log('\n📋 Please add this health endpoint manually to your server/index.ts:');
    console.log(`
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});
    `);
  }
}

addHealthEndpoint();
