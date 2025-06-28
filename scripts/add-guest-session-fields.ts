import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function addGuestSessionFields() {
  console.log("Adding guest session fields to signers table...");
  
  try {
    // Add sessionToken field
    await db.execute(sql`
      ALTER TABLE signers 
      ADD COLUMN IF NOT EXISTS session_token TEXT
    `);
    console.log("✅ Added session_token field");

    // Add sessionExpiresAt field
    await db.execute(sql`
      ALTER TABLE signers 
      ADD COLUMN IF NOT EXISTS session_expires_at TIMESTAMP
    `);
    console.log("✅ Added session_expires_at field");

    // Add tempSignature field
    await db.execute(sql`
      ALTER TABLE signers 
      ADD COLUMN IF NOT EXISTS temp_signature TEXT
    `);
    console.log("✅ Added temp_signature field");

    // Add tempInitial field
    await db.execute(sql`
      ALTER TABLE signers 
      ADD COLUMN IF NOT EXISTS temp_initial TEXT
    `);
    console.log("✅ Added temp_initial field");

    console.log("✅ Successfully added all guest session fields!");
    
  } catch (error) {
    console.error("❌ Error adding guest session fields:", error);
  } finally {
    process.exit();
  }
}

addGuestSessionFields(); 