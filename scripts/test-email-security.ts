#!/usr/bin/env tsx

/**
 * Email Security Test Suite
 * 
 * This script tests the email uniqueness security fix by attempting various 
 * registration scenarios that should be blocked.
 * 
 * Usage: npm run test:email-security
 */

import { db } from '../server/db';
import { users } from '../shared/schema';
import { storage } from '../server/storage';
import { eq } from 'drizzle-orm';

interface TestResult {
  testName: string;
  passed: boolean;
  details: string;
  error?: string;
}

class EmailSecurityTester {
  private results: TestResult[] = [];
  private testEmails: string[] = [];

  async runAllTests(): Promise<void> {
    console.log('🔒 Starting Email Security Test Suite\n');
    
    try {
      await this.testDatabaseConstraint();
      await this.testStorageLayerValidation();
      await this.testCaseVariations();
      await this.testWhitespaceVariations();
      await this.testCrossRoleAttempts();
      await this.testBulkRegistrationAttempts();
      
      this.printResults();
      await this.cleanup();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      await this.cleanup();
      process.exit(1);
    }
  }

  private async testDatabaseConstraint(): Promise<void> {
    const testEmail = 'db-constraint-test@example.com';
    this.testEmails.push(testEmail);
    
    try {
      // Create first user
      await db.insert(users).values({
        username: 'user1',
        email: testEmail,
        password: 'hashedpassword',
        role: 'client',
        firstName: 'Test',
        lastName: 'User1'
      });

      // Attempt to create second user with same email - should fail
      try {
        await db.insert(users).values({
          username: 'user2',
          email: testEmail,
          password: 'hashedpassword',
          role: 'notary',
          firstName: 'Test',
          lastName: 'User2'
        });
        
        this.addResult('Database Constraint Test', false, 'Database allowed duplicate email insertion');
      } catch (dbError: any) {
        if (dbError.code === '23505') {
          this.addResult('Database Constraint Test', true, 'Database correctly rejected duplicate email');
        } else {
          this.addResult('Database Constraint Test', false, `Unexpected database error: ${dbError.message}`);
        }
      }
    } catch (error: any) {
      this.addResult('Database Constraint Test', false, `Test setup failed: ${error.message}`);
    }
  }

  private async testStorageLayerValidation(): Promise<void> {
    const testEmail = 'storage-test@example.com';
    this.testEmails.push(testEmail);
    
    try {
      // Create first user through storage layer
      await storage.createUser({
        username: 'storageuser1',
        email: testEmail,
        password: 'password123',
        role: 'client',
        firstName: 'Storage',
        lastName: 'User1'
      });

      // Attempt to create second user - should fail at storage layer
      try {
        await storage.createUser({
          username: 'storageuser2',
          email: testEmail,
          password: 'password123',
          role: 'notary',
          firstName: 'Storage',
          lastName: 'User2'
        });
        
        this.addResult('Storage Layer Validation', false, 'Storage layer allowed duplicate email');
      } catch (storageError: any) {
        if (storageError.message.includes('SECURITY_VIOLATION')) {
          this.addResult('Storage Layer Validation', true, 'Storage layer correctly rejected duplicate email');
        } else {
          this.addResult('Storage Layer Validation', false, `Unexpected storage error: ${storageError.message}`);
        }
      }
    } catch (error: any) {
      this.addResult('Storage Layer Validation', false, `Test setup failed: ${error.message}`);
    }
  }

  private async testCaseVariations(): Promise<void> {
    const baseEmail = 'case-test@example.com';
    const variations = [
      'case-test@example.com',
      'CASE-TEST@EXAMPLE.COM',
      'Case-Test@Example.Com',
      'cAsE-tEsT@eXaMpLe.CoM'
    ];
    
    this.testEmails.push(baseEmail);
    
    try {
      // Create user with lowercase email
      await storage.createUser({
        username: 'caseuser1',
        email: baseEmail,
        password: 'password123',
        role: 'client',
        firstName: 'Case',
        lastName: 'User1'
      });

      let rejectedCount = 0;
      
      // Try to create users with case variations
      for (let i = 1; i < variations.length; i++) {
        try {
          await storage.createUser({
            username: `caseuser${i + 1}`,
            email: variations[i],
            password: 'password123',
            role: 'notary',
            firstName: 'Case',
            lastName: `User${i + 1}`
          });
        } catch (error: any) {
          if (error.message.includes('SECURITY_VIOLATION')) {
            rejectedCount++;
          }
        }
      }
      
      if (rejectedCount === variations.length - 1) {
        this.addResult('Case Variation Test', true, `All ${rejectedCount} case variations correctly rejected`);
      } else {
        this.addResult('Case Variation Test', false, `Only ${rejectedCount}/${variations.length - 1} case variations were rejected`);
      }
    } catch (error: any) {
      this.addResult('Case Variation Test', false, `Test failed: ${error.message}`);
    }
  }

  private async testWhitespaceVariations(): Promise<void> {
    const baseEmail = 'whitespace-test@example.com';
    const variations = [
      'whitespace-test@example.com',
      ' whitespace-test@example.com',
      'whitespace-test@example.com ',
      ' whitespace-test@example.com ',
      '\twhitespace-test@example.com\t',
      '\nwhitespace-test@example.com\n'
    ];
    
    this.testEmails.push(baseEmail.trim());
    
    try {
      // Create user with clean email
      await storage.createUser({
        username: 'wsuser1',
        email: baseEmail,
        password: 'password123',
        role: 'client',
        firstName: 'Whitespace',
        lastName: 'User1'
      });

      let rejectedCount = 0;
      
      // Try to create users with whitespace variations
      for (let i = 1; i < variations.length; i++) {
        try {
          await storage.createUser({
            username: `wsuser${i + 1}`,
            email: variations[i],
            password: 'password123',
            role: 'notary',
            firstName: 'Whitespace',
            lastName: `User${i + 1}`
          });
        } catch (error: any) {
          if (error.message.includes('SECURITY_VIOLATION')) {
            rejectedCount++;
          }
        }
      }
      
      if (rejectedCount === variations.length - 1) {
        this.addResult('Whitespace Variation Test', true, `All ${rejectedCount} whitespace variations correctly rejected`);
      } else {
        this.addResult('Whitespace Variation Test', false, `Only ${rejectedCount}/${variations.length - 1} whitespace variations were rejected`);
      }
    } catch (error: any) {
      this.addResult('Whitespace Variation Test', false, `Test failed: ${error.message}`);
    }
  }

  private async testCrossRoleAttempts(): Promise<void> {
    const testEmail = 'cross-role-test@example.com';
    const roles = ['client', 'notary', 'admin', 'title_company', 'company_manager', 'signer', 'witness'];
    
    this.testEmails.push(testEmail);
    
    try {
      // Create user with first role
      await storage.createUser({
        username: 'crossrole1',
        email: testEmail,
        password: 'password123',
        role: roles[0],
        firstName: 'Cross',
        lastName: 'Role1'
      });

      let rejectedCount = 0;
      
      // Try to create users with different roles
      for (let i = 1; i < roles.length; i++) {
        try {
          await storage.createUser({
            username: `crossrole${i + 1}`,
            email: testEmail,
            password: 'password123',
            role: roles[i],
            firstName: 'Cross',
            lastName: `Role${i + 1}`
          });
        } catch (error: any) {
          if (error.message.includes('SECURITY_VIOLATION')) {
            rejectedCount++;
          }
        }
      }
      
      if (rejectedCount === roles.length - 1) {
        this.addResult('Cross-Role Attempt Test', true, `All ${rejectedCount} cross-role attempts correctly rejected`);
      } else {
        this.addResult('Cross-Role Attempt Test', false, `Only ${rejectedCount}/${roles.length - 1} cross-role attempts were rejected`);
      }
    } catch (error: any) {
      this.addResult('Cross-Role Attempt Test', false, `Test failed: ${error.message}`);
    }
  }

  private async testBulkRegistrationAttempts(): Promise<void> {
    const testEmail = 'bulk-test@example.com';
    this.testEmails.push(testEmail);
    
    try {
      // Create first user
      await storage.createUser({
        username: 'bulkuser1',
        email: testEmail,
        password: 'password123',
        role: 'client',
        firstName: 'Bulk',
        lastName: 'User1'
      });

      // Attempt rapid duplicate registrations
      const attempts = 10;
      let rejectedCount = 0;
      
      const promises = [];
      for (let i = 2; i <= attempts; i++) {
        promises.push(
          storage.createUser({
            username: `bulkuser${i}`,
            email: testEmail,
            password: 'password123',
            role: 'notary',
            firstName: 'Bulk',
            lastName: `User${i}`
          }).catch((error: any) => {
            if (error.message.includes('SECURITY_VIOLATION')) {
              rejectedCount++;
            }
            return null;
          })
        );
      }
      
      await Promise.all(promises);
      
      if (rejectedCount === attempts - 1) {
        this.addResult('Bulk Registration Test', true, `All ${rejectedCount} bulk attempts correctly rejected`);
      } else {
        this.addResult('Bulk Registration Test', false, `Only ${rejectedCount}/${attempts - 1} bulk attempts were rejected`);
      }
    } catch (error: any) {
      this.addResult('Bulk Registration Test', false, `Test failed: ${error.message}`);
    }
  }

  private addResult(testName: string, passed: boolean, details: string, error?: string): void {
    this.results.push({ testName, passed, details, error });
  }

  private printResults(): void {
    console.log('\n📊 Test Results:');
    console.log('================\n');
    
    let passed = 0;
    let failed = 0;
    
    this.results.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.testName}`);
      console.log(`   ${result.details}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      console.log();
      
      if (result.passed) passed++;
      else failed++;
    });
    
    console.log(`📈 Summary: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
      console.log('🎉 All email security tests passed! The system is secure.');
    } else {
      console.log('⚠️  Some tests failed. Manual review required.');
      process.exit(1);
    }
  }

  private async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up test data...');
    
    for (const email of this.testEmails) {
      try {
        await db.delete(users).where(eq(users.email, email.toLowerCase().trim()));
      } catch (error) {
        console.log(`   Could not clean up ${email}: ${error}`);
      }
    }
    
    console.log('✨ Cleanup completed');
  }
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new EmailSecurityTester();
  tester.runAllTests().catch(console.error);
}

export { EmailSecurityTester };
