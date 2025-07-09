#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('📄 Ensuring PDF worker files are available...');

const sourceDir = path.join(__dirname, '../node_modules/pdfjs-dist/build');
const targetDir = path.join(__dirname, '../client/public');

// Ensure target directory exists
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// List of files to copy
const filesToCopy = [
  { src: 'pdf.worker.min.mjs', dest: 'pdf.worker.min.js' },
  { src: 'pdf.worker.mjs', dest: 'pdf.worker.js' }
];

let copiedCount = 0;

filesToCopy.forEach(({ src, dest }) => {
  const sourcePath = path.join(sourceDir, src);
  const destPath = path.join(targetDir, dest);
  
  try {
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`✅ Copied ${src} to ${dest}`);
      copiedCount++;
    } else {
      console.warn(`⚠️  Source file not found: ${sourcePath}`);
    }
  } catch (error) {
    console.error(`❌ Error copying ${src}:`, error.message);
  }
});

if (copiedCount === 0) {
  console.error('❌ No PDF worker files were copied!');
  process.exit(1);
} else {
  console.log(`✅ Successfully copied ${copiedCount} PDF worker file(s)`);
}

// Also copy to dist/public if it exists (for production builds)
const distPublicDir = path.join(__dirname, '../dist/public');
if (fs.existsSync(distPublicDir)) {
  console.log('\n📦 Copying to dist/public for production...');
  filesToCopy.forEach(({ src, dest }) => {
    const sourcePath = path.join(targetDir, dest);
    const distPath = path.join(distPublicDir, dest);
    
    try {
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, distPath);
        console.log(`✅ Copied ${dest} to dist/public`);
      }
    } catch (error) {
      console.error(`❌ Error copying to dist:`, error.message);
    }
  });
} 