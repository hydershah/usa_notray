#!/usr/bin/env tsx

import { Client } from 'pg';
import { config } from 'dotenv';

config();

async function simplifyParticipantRoles() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');
    console.log('🔄 Simplifying participant roles...');

    // First, backup existing roles
    const backupTable = `participant_roles_backup_${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${backupTable} AS 
      SELECT * FROM participant_roles
    `);
    console.log(`✅ Backed up existing roles to ${backupTable}`);

    // Get count of existing roles before deletion
    const beforeCount = await client.query('SELECT COUNT(*) FROM participant_roles');
    console.log(`📊 Found ${beforeCount.rows[0].count} existing roles`);

    // Clear existing roles
    await client.query('DELETE FROM participant_roles');
    console.log('🗑️ Cleared existing roles');

    // Insert simplified roles
    await client.query(`
      INSERT INTO participant_roles (name, display_name, description, category, requires_signature, requires_id_verification, is_active, sort_order, created_at, updated_at)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()),
        ($9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW()),
        ($17, $18, $19, $20, $21, $22, $23, $24, NOW(), NOW())
    `, [
      // Signer
      'signer', 'Signer', 'Signs documents (ID verification required)', 'signer', true, true, true, 1,
      // Witness  
      'witness', 'Witness', 'Observes signing (ID verification required)', 'witness', false, true, true, 2,
      // Observer
      'observer', 'Observer', 'Can view but cannot sign (no ID verification)', 'observer', false, false, true, 3
    ]);
    console.log('✅ Inserted 3 simplified roles');

    // Update existing signers table
    const signerUpdateResult = await client.query(`
      UPDATE signers 
      SET signer_role = CASE 
        WHEN signer_role IN ('borrower', 'co-borrower', 'seller', 'buyer', 'power_of_attorney', 'trust_beneficiary', 'other') THEN 'signer'
        WHEN signer_role = 'witness' THEN 'witness'
        ELSE 'observer'
      END
      WHERE signer_role IS NOT NULL
    `);
    console.log(`🔄 Updated ${signerUpdateResult.rowCount} records in signers table`);

    // Update existing job_participants table
    const participantUpdateResult = await client.query(`
      UPDATE job_participants 
      SET role = CASE 
        WHEN role IN ('borrower', 'co-borrower', 'seller', 'buyer', 'power_of_attorney', 'trust_beneficiary', 'other') THEN 'signer'
        WHEN role = 'witness' THEN 'witness'
        ELSE 'observer'
      END
      WHERE role IS NOT NULL
    `);
    console.log(`🔄 Updated ${participantUpdateResult.rowCount} records in job_participants table`);

    // Verify the final state
    const finalRoles = await client.query(`
      SELECT name, display_name, category, requires_signature, requires_id_verification, sort_order 
      FROM participant_roles 
      ORDER BY sort_order
    `);
    
    console.log('\n📋 Final participant roles:');
    finalRoles.rows.forEach(role => {
      console.log(`   ${role.sort_order}. ${role.display_name} (${role.name})`);
      console.log(`      Category: ${role.category}, Signs: ${role.requires_signature}, ID Verification: ${role.requires_id_verification}`);
    });

    console.log('\n🎉 Participant roles successfully simplified!');
    console.log('\n🔧 Role mapping applied:');
    console.log('   • borrower, co-borrower, seller, buyer, power_of_attorney, trust_beneficiary, other → signer');
    console.log('   • witness → witness');
    console.log('   • everything else → observer');

  } catch (error) {
    console.error('💥 Error simplifying participant roles:', error);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

// Run the script
simplifyParticipantRoles()
  .then(() => {
    console.log('\n✅ Participant role simplification completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Participant role simplification failed:', error);
    process.exit(1);
  });