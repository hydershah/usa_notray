import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '.data', 'sqlite.db');
const db = new Database(dbPath);

const userId = 8; // Andrew Yon

console.log(`\n🔍 Checking signatures for user ${userId}...\n`);

// Check users table
const user = db.prepare('SELECT id, email, firstName, lastName, signature_image as signatureImage, initials_image as initialsImage FROM users WHERE id = ?').get(userId);
console.log('User info:', user);

// Check user_signatures table
const signatures = db.prepare('SELECT * FROM user_signatures WHERE userId = ?').all(userId);
console.log(`\nFound ${signatures.length} signatures in user_signatures table:`);
signatures.forEach(sig => {
  console.log(`  - ID: ${sig.id}, Type: ${sig.signatureType}, IsDefault: ${sig.isDefault}`);
  console.log(`    ImageURL length: ${sig.imageUrl?.length || 0}`);
  console.log(`    Starts with data:image/: ${sig.imageUrl?.startsWith('data:image/') ? 'YES ✅' : 'NO ❌'}`);
  if (sig.imageUrl && !sig.imageUrl.startsWith('data:image/')) {
    console.log(`    URL preview: ${sig.imageUrl.substring(0, 100)}...`);
  }
});

db.close();
