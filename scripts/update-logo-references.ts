#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';

const OLD_LOGO_PATH = '/logo.jpeg';
const NEW_LOGO_PATH = '/sharpnote_-_blue_background.jpg';

// Simple file finder function
function findFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = [];
  
  function traverse(currentDir: string) {
    try {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.includes('node_modules') && !item.includes('dist') && !item.includes('build')) {
          traverse(fullPath);
        } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read directory ${dir}:`, error);
    }
  }
  
  traverse(dir);
  return files;
}

async function updateLogoReferences() {
  console.log('🔍 Searching for logo references...');
  
  // Find all TypeScript/TSX files that might contain logo references
  const files = findFiles('client/src', ['.ts', '.tsx']);
  
  let updatedFiles = 0;
  let totalReplacements = 0;
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check if file contains the old logo reference
      if (content.includes(OLD_LOGO_PATH)) {
        const newContent = content.replace(new RegExp(OLD_LOGO_PATH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), NEW_LOGO_PATH);
        
        if (newContent !== content) {
          fs.writeFileSync(file, newContent, 'utf8');
          const replacements = (content.match(new RegExp(OLD_LOGO_PATH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
          console.log(`✅ Updated ${file} (${replacements} replacements)`);
          updatedFiles++;
          totalReplacements += replacements;
        }
      }
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error);
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Files updated: ${updatedFiles}`);
  console.log(`   Total replacements: ${totalReplacements}`);
  console.log(`   Old logo path: ${OLD_LOGO_PATH}`);
  console.log(`   New logo path: ${NEW_LOGO_PATH}`);
  
  if (updatedFiles > 0) {
    console.log('\n🎉 Logo references updated successfully!');
    console.log('💡 Don\'t forget to:');
    console.log('   1. Add the new logo file to client/public/');
    console.log('   2. Test the application to ensure all logos display correctly');
    console.log('   3. Update any CSS that might reference the old logo');
  } else {
    console.log('\nℹ️  No logo references found to update.');
  }
}

// Also check for any CSS files that might reference the logo
async function updateCSSLogoReferences() {
  console.log('\n🔍 Checking CSS files for logo references...');
  
  const cssFiles = findFiles('client/src', ['.css', '.scss']);
  
  let updatedCSSFiles = 0;
  
  for (const file of cssFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      
      if (content.includes(OLD_LOGO_PATH)) {
        const newContent = content.replace(new RegExp(OLD_LOGO_PATH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), NEW_LOGO_PATH);
        
        if (newContent !== content) {
          fs.writeFileSync(file, newContent, 'utf8');
          console.log(`✅ Updated CSS file: ${file}`);
          updatedCSSFiles++;
        }
      }
    } catch (error) {
      console.error(`❌ Error processing CSS file ${file}:`, error);
    }
  }
  
  if (updatedCSSFiles > 0) {
    console.log(`📊 CSS files updated: ${updatedCSSFiles}`);
  } else {
    console.log('ℹ️  No CSS files found with logo references.');
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting logo reference update...\n');
  
  await updateLogoReferences();
  await updateCSSLogoReferences();
  
  console.log('\n✨ Logo update process completed!');
}

main().catch(console.error); 