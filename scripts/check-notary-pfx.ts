import 'dotenv/config';
import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { cloudStorage } from '../server/lib/cloud-storage-service';
import { DigitalSignatureService } from '../server/services/digital-signature-service';

async function main() {
  try {
    const userIdArg = process.argv[2];
    const userId = userIdArg ? parseInt(userIdArg, 10) : 1;

    console.log(`\n🔎 Checking notary PFX for userId=${userId}`);

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }

    if (user.role !== 'notary') {
      console.log(`⚠️ User ${user.email} is role='${user.role}', not 'notary'`);
    }

    const fileKey = user.publicCertificateFile;
    const passwordRaw = (user as any).publicCertificatePassword || '';

    console.log(`📧 User: ${user.email}`);
    console.log(`📂 publicCertificateFile: ${fileKey || 'None'}`);
    console.log(`🔑 password length: ${passwordRaw ? passwordRaw.length : 0}`);

    if (!fileKey) {
      console.log('❌ No uploaded PFX file found for this user');
      process.exit(1);
    }

    // Download PFX
    const p12Buffer = await cloudStorage.downloadFile(fileKey);
    console.log(`✅ Downloaded PFX size: ${p12Buffer.length} bytes`);

    const dss = DigitalSignatureService.getInstance();

    // Try raw password
    console.log(`\n🧪 Parse with RAW password (length ${passwordRaw.length})...`);
    try {
      const result = await (dss as any).validateP12Certificate(p12Buffer, passwordRaw);
      console.log(result.success ? '✅ RAW password works' : `❌ RAW password failed: ${result.error}`);
    } catch (err: any) {
      console.log(`❌ RAW password exception: ${err?.message || err}`);
    }

    // Try trimmed password
    const passwordTrimmed = typeof passwordRaw === 'string' ? passwordRaw.trim() : passwordRaw;
    if (passwordTrimmed !== passwordRaw) {
      console.log(`\n🧪 Parse with TRIMMED password (length ${passwordTrimmed.length})...`);
      try {
        const result = await (dss as any).validateP12Certificate(p12Buffer, passwordTrimmed);
        console.log(result.success ? '✅ TRIMMED password works' : `❌ TRIMMED password failed: ${result.error}`);
      } catch (err: any) {
        console.log(`❌ TRIMMED password exception: ${err?.message || err}`);
      }
    } else {
      console.log('\nℹ️ Trimmed password is identical to raw; skipping duplicate test');
    }

    console.log('\n✔️ Done');
    process.exit(0);
  } catch (error: any) {
    console.error('Fatal error:', error?.message || error);
    process.exit(1);
  }
}

main(); 