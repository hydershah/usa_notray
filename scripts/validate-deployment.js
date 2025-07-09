#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🔍 Validating deployment configuration...\n');

const checks = [];

// Check if dist directory exists
const distPath = path.join(process.cwd(), 'dist');
checks.push({
  name: 'Dist directory exists',
  status: fs.existsSync(distPath),
  path: distPath
});

// Check if public directory exists in dist
const publicPath = path.join(distPath, 'public');
checks.push({
  name: 'Public directory exists in dist',
  status: fs.existsSync(publicPath),
  path: publicPath
});

// Check if index.html exists
const indexPath = path.join(publicPath, 'index.html');
checks.push({
  name: 'index.html exists',
  status: fs.existsSync(indexPath),
  path: indexPath
});

// Check if PDF worker files exist
const pdfWorkerPaths = [
  path.join(publicPath, 'pdf.worker.min.js'),
  path.join(publicPath, 'pdf.worker.js')
];

pdfWorkerPaths.forEach((workerPath, index) => {
  checks.push({
    name: `PDF worker file ${index + 1} exists`,
    status: fs.existsSync(workerPath),
    path: workerPath
  });
});

// Check if server build exists
const serverPath = path.join(distPath, 'index.js');
checks.push({
  name: 'Server build exists',
  status: fs.existsSync(serverPath),
  path: serverPath
});

// Check environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET'
];

requiredEnvVars.forEach(envVar => {
  checks.push({
    name: `Environment variable ${envVar}`,
    status: !!process.env[envVar],
    path: `process.env.${envVar}`
  });
});

// Display results
let allPassed = true;
checks.forEach(check => {
  const status = check.status ? '✅' : '❌';
  console.log(`${status} ${check.name}`);
  if (!check.status) {
    console.log(`   Path: ${check.path}`);
    allPassed = false;
  }
});

console.log('\n' + '='.repeat(50));

if (allPassed) {
  console.log('🎉 All deployment checks passed!');
  process.exit(0);
} else {
  console.log('⚠️  Some deployment checks failed. Please fix the issues above.');
  process.exit(1);
} 