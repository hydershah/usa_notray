import { CertificateAuthority, UserCertConfig } from './certificate-authority';
import { storage } from './storage';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { db } from './db';
import { eq } from 'drizzle-orm';

interface CertificateRecord {
  userId: number;
  serialNumber: string;
  certificatePath: string;
  privateKeyPath: string;
  p12Path: string;
  issueDate: string;
  expiryDate: string;
  status: 'active' | 'expired' | 'revoked';
  p12Password: string;
}

class CertificateService {
  private ca: CertificateAuthority;
  private initialized: boolean = false;

  constructor() {
    this.ca = new CertificateAuthority('./certs');
  }

  /**
   * Initialize the Certificate Service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('🔧 Initializing Certificate Service...');
      
      // Initialize Certificate Authority
      await this.ca.initializeCA();
      
      // Create certificates table if it doesn't exist
      await this.createCertificatesTable();
      
      this.initialized = true;
      console.log('✅ Certificate Service initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Certificate Service:', error);
      throw error;
    }
  }

  /**
   * Ensure the service is initialized before any operation
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Generate certificate for a notary user
   */
  async generateNotaryCertificate(userId: number): Promise<{
    success: boolean;
    certificateId?: number;
    p12Path?: string;
    p12Password?: string;
    error?: string;
  }> {
    await this.ensureInitialized();
    try {

      // Get user details from database
      const user = await storage.getUserById(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Validate user is a notary
      if (user.userType !== 'notary') {
        return { success: false, error: 'User is not a notary' };
      }

      // Check if user already has an active certificate
      const existingCert = await this.getActiveCertificate(userId);
      if (existingCert) {
        return { 
          success: false, 
          error: 'User already has an active certificate' 
        };
      }

      // Build user certificate configuration
      const userConfig: UserCertConfig = {
        fullName: user.fullName || user.email,
        email: user.email,
        state: user.commissionState || user.state || 'Unknown',
        notaryCommission: user.nameOnCommission || 'Digital Notary',
        organizationUnit: user.notaryType === 'contractor' ? 'Contractor Notary' : 'Subscriber Notary',
        keySize: 2048, // Smaller key size for better performance
        validityDays: 1095 // 3 years
      };

      console.log(`🔧 Generating certificate for user ${userId}: ${userConfig.fullName}`);

      // Generate the certificate
      const certResult = await this.ca.generateUserCertificate(userConfig);

      // Store certificate record in database
      const certificateId = await this.storeCertificateRecord({
        userId,
        serialNumber: certResult.serialNumber,
        certificatePath: certResult.certificatePath,
        privateKeyPath: certResult.privateKeyPath,
        p12Path: certResult.p12Path,
        issueDate: new Date().toISOString(),
        expiryDate: new Date(Date.now() + userConfig.validityDays * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active',
        p12Password: await this.getP12Password(certResult.p12Path)
      });

      // Update user record with certificate information including the P12 password
      const actualP12Password = await this.getP12Password(certResult.p12Path);
      await this.updateUserCertificateInfo(userId, {
        digitalCertificateFile: certResult.p12Path,
        digitalCertificateExpiration: new Date(Date.now() + userConfig.validityDays * 24 * 60 * 60 * 1000).toISOString(),
        publicCertificatePassword: actualP12Password
      });

      console.log(`✅ Certificate generated successfully for user ${userId}`);

      return {
        success: true,
        certificateId,
        p12Path: certResult.p12Path,
        p12Password: await this.getP12Password(certResult.p12Path)
      };

    } catch (error) {
      console.error(`❌ Failed to generate certificate for user ${userId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate certificate for a verified signer/witness user
   */
  async generateSignerCertificate(userId: number): Promise<{
    success: boolean;
    certificateId?: number;
    p12Path?: string;
    p12Password?: string;
    error?: string;
  }> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Get user details from database
      const user = await storage.getUserById(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Validate user is a signer or witness
      if (!['signer', 'witness'].includes(user.role)) {
        return { success: false, error: 'User must be a signer or witness' };
      }

      // CRITICAL: Only generate certificates for verified users
      if (!user.isVerified && !user.isVerificationBypassed) {
        return { 
          success: false, 
          error: 'User must complete ID verification before certificate generation' 
        };
      }

      // Check if user already has an active certificate
      const existingCert = await this.getActiveCertificate(userId);
      if (existingCert) {
        return { 
          success: false, 
          error: 'User already has an active certificate' 
        };
      }

      // Build user certificate configuration for signer/witness
      const userConfig: UserCertConfig = {
        fullName: user.fullName || `${user.firstName} ${user.lastName}`.trim() || user.email,
        email: user.email,
        state: user.state || 'Unknown',
        notaryCommission: `Verified ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}`, // "Verified Signer" or "Verified Witness"
        organizationUnit: `Document ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}s`, // "Document Signers" or "Document Witnesses"
        keySize: 2048, // Standard key size
        validityDays: 365 // 1 year validity for signers/witnesses
      };

      console.log(`🔧 Generating ${user.role} certificate for user ${userId}: ${userConfig.fullName}`);

      // Generate the certificate using existing CA infrastructure
      const certResult = await this.ca.generateUserCertificate(userConfig);

      // Store certificate record in database
      const certificateId = await this.storeCertificateRecord({
        userId,
        serialNumber: certResult.serialNumber,
        certificatePath: certResult.certificatePath,
        privateKeyPath: certResult.privateKeyPath,
        p12Path: certResult.p12Path,
        issueDate: new Date().toISOString(),
        expiryDate: new Date(Date.now() + userConfig.validityDays * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active',
        p12Password: await this.getP12Password(certResult.p12Path)
      });

      // Update user record with certificate information including the P12 password
      const actualP12Password = await this.getP12Password(certResult.p12Path);
      await this.updateUserCertificateInfo(userId, {
        digitalCertificateFile: certResult.p12Path,
        digitalCertificateExpiration: new Date(Date.now() + userConfig.validityDays * 24 * 60 * 60 * 1000).toISOString(),
        publicCertificatePassword: actualP12Password
      });

      console.log(`✅ ${user.role} certificate generated successfully for user ${userId}`);

      return {
        success: true,
        certificateId,
        p12Path: certResult.p12Path,
        p12Password: await this.getP12Password(certResult.p12Path)
      };

    } catch (error) {
      console.error(`❌ Failed to generate ${user?.role || 'user'} certificate for user ${userId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Universal certificate generation - supports all user types
   */
  async generateUserCertificate(userId: number): Promise<{
    success: boolean;
    certificateId?: number;
    p12Path?: string;
    p12Password?: string;
    error?: string;
  }> {
    try {
      // Get user details to determine certificate type
      const user = await storage.getUserById(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Route to appropriate certificate generation method
      switch (user.role) {
        case 'notary':
          return await this.generateNotaryCertificate(userId);
        case 'signer':
        case 'witness':
          return await this.generateSignerCertificate(userId);
        default:
          return { 
            success: false, 
            error: `Certificate generation not supported for role: ${user.role}` 
          };
      }
    } catch (error) {
      console.error(`❌ Failed to generate certificate for user ${userId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate a user's certificate
   */
  async validateUserCertificate(userId: number): Promise<{
    valid: boolean;
    expired?: boolean;
    nearExpiry?: boolean;
    daysRemaining?: number;
    details?: any;
    error?: string;
  }> {
    try {
      const certificate = await this.getActiveCertificate(userId);
      if (!certificate) {
        return { valid: false, error: 'No active certificate found' };
      }

      // Validate certificate against CA
      const validation = await this.ca.validateCertificate(certificate.certificatePath);
      
      if (!validation.valid) {
        return {
          valid: false,
          error: validation.reason
        };
      }

      // Check expiry
      const expiry = await this.ca.checkCertificateExpiry(certificate.certificatePath);

      return {
        valid: true,
        expired: expiry.expired,
        nearExpiry: expiry.nearExpiry,
        daysRemaining: expiry.daysRemaining,
        details: validation.details
      };

    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Get certificate file for download
   */
  async getCertificateFile(userId: number, fileType: 'p12' | 'pem' = 'p12'): Promise<{
    success: boolean;
    filePath?: string;
    password?: string;
    error?: string;
  }> {
    try {
      const certificate = await this.getActiveCertificate(userId);
      if (!certificate) {
        return { success: false, error: 'No active certificate found' };
      }

      const filePath = fileType === 'p12' ? certificate.p12Path : certificate.certificatePath;
      const password = fileType === 'p12' ? certificate.p12Password : undefined;

      return {
        success: true,
        filePath,
        password
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Revoke a user's certificate
   */
  async revokeCertificate(userId: number, reason: string = 'user_request'): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const certificate = await this.getActiveCertificate(userId);
      if (!certificate) {
        return { success: false, error: 'No active certificate found' };
      }

      // Revoke certificate with CA
      await this.ca.revokeCertificate(certificate.certificatePath, reason);

      // Update certificate status in database
      await this.updateCertificateStatus(certificate.userId, 'revoked');

      // Clear certificate info from user record
      await this.updateUserCertificateInfo(userId, {
        digitalCertificateFile: null,
        digitalCertificateExpiration: null
      });

      console.log(`✅ Certificate revoked successfully for user ${userId}`);

      return { success: true };

    } catch (error) {
      console.error(`❌ Failed to revoke certificate for user ${userId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check all certificates for expiry and update status
   */
  async checkAllCertificatesExpiry(): Promise<{
    checked: number;
    expired: number;
    nearExpiry: number;
  }> {
    try {
      const certificates = await this.getAllActiveCertificates();
      let expired = 0;
      let nearExpiry = 0;

      for (const cert of certificates) {
        try {
          const expiry = await this.ca.checkCertificateExpiry(cert.certificatePath);
          
          if (expiry.expired && cert.status === 'active') {
            await this.updateCertificateStatus(cert.userId, 'expired');
            expired++;
          } else if (expiry.nearExpiry) {
            nearExpiry++;
            // Could send notification here
            console.log(`⚠️  Certificate for user ${cert.userId} expires in ${expiry.daysRemaining} days`);
          }
        } catch (error) {
          console.error(`Error checking certificate for user ${cert.userId}:`, error);
        }
      }

      console.log(`📊 Certificate expiry check complete: ${certificates.length} checked, ${expired} expired, ${nearExpiry} near expiry`);

      return {
        checked: certificates.length,
        expired,
        nearExpiry
      };

    } catch (error) {
      console.error('❌ Failed to check certificate expiry:', error);
      throw error;
    }
  }

  /**
   * Get certificate statistics
   */
  async getCertificateStats(): Promise<{
    total: number;
    active: number;
    expired: number;
    revoked: number;
    nearExpiry: number;
  }> {
    try {
      const stats = await storage.executeQuery(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
          COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired,
          COUNT(CASE WHEN status = 'revoked' THEN 1 END) as revoked
        FROM certificates
      `);

      // Check for near expiry certificates
      const nearExpiryQuery = await storage.executeQuery(`
        SELECT COUNT(*) as near_expiry
        FROM certificates 
        WHERE status = 'active' 
        AND expiry_date <= $1
      `, [new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()]);

      return {
        total: parseInt(stats[0].total),
        active: parseInt(stats[0].active),
        expired: parseInt(stats[0].expired),
        revoked: parseInt(stats[0].revoked),
        nearExpiry: parseInt(nearExpiryQuery[0].near_expiry)
      };

    } catch (error) {
      console.error('❌ Failed to get certificate stats:', error);
      throw error;
    }
  }

  // Private helper methods
  private async createCertificatesTable(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS certificates (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        serial_number VARCHAR(20) NOT NULL UNIQUE,
        certificate_path TEXT NOT NULL,
        private_key_path TEXT NOT NULL,
        p12_path TEXT NOT NULL,
        p12_password TEXT NOT NULL,
        issue_date TIMESTAMP NOT NULL,
        expiry_date TIMESTAMP NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_certificates_user_id ON certificates(user_id);
      CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates(status);
      CREATE INDEX IF NOT EXISTS idx_certificates_expiry ON certificates(expiry_date);
      CREATE INDEX IF NOT EXISTS idx_certificates_serial ON certificates(serial_number);
    `;

    await storage.executeQuery(createTableQuery);
  }

  private async getActiveCertificate(userId: number): Promise<CertificateRecord | null> {
    const result = await storage.executeQuery(
      'SELECT * FROM certificates WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1',
      [userId, 'active']
    );

    if (result.length === 0) return null;

    const row = result[0];
    return {
      userId: row.user_id,
      serialNumber: row.serial_number,
      certificatePath: row.certificate_path,
      privateKeyPath: row.private_key_path,
      p12Path: row.p12_path,
      issueDate: row.issue_date,
      expiryDate: row.expiry_date,
      status: row.status,
      p12Password: row.p12_password
    };
  }

  private async getAllActiveCertificates(): Promise<CertificateRecord[]> {
    const result = await storage.executeQuery(
      'SELECT * FROM certificates WHERE status = $1',
      ['active']
    );

    return result.map(row => ({
      userId: row.user_id,
      serialNumber: row.serial_number,
      certificatePath: row.certificate_path,
      privateKeyPath: row.private_key_path,
      p12Path: row.p12_path,
      issueDate: row.issue_date,
      expiryDate: row.expiry_date,
      status: row.status,
      p12Password: row.p12_password
    }));
  }

  private async storeCertificateRecord(record: CertificateRecord): Promise<number> {
    const result = await storage.executeQuery(`
      INSERT INTO certificates (
        user_id, serial_number, certificate_path, private_key_path, 
        p12_path, p12_password, issue_date, expiry_date, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      record.userId,
      record.serialNumber,
      record.certificatePath,
      record.privateKeyPath,
      record.p12Path,
      record.p12Password,
      record.issueDate,
      record.expiryDate,
      record.status
    ]);

    return result[0].id;
  }

  private async updateCertificateStatus(userId: number, status: string): Promise<void> {
    await storage.executeQuery(
      'UPDATE certificates SET status = $1, updated_at = NOW() WHERE user_id = $2 AND status = $3',
      [status, userId, 'active']
    );
  }

  private async updateUserCertificateInfo(userId: number, info: {
    digitalCertificateFile: string | null;
    digitalCertificateExpiration: string | null;
    publicCertificatePassword?: string | null;
  }): Promise<void> {
    if (info.publicCertificatePassword !== undefined) {
      // Update with password
      await storage.executeQuery(
        'UPDATE users SET digital_certificate_file = $1, digital_certificate_expiration = $2, public_certificate_password = $3 WHERE id = $4',
        [info.digitalCertificateFile, info.digitalCertificateExpiration, info.publicCertificatePassword, userId]
      );
    } else {
      // Update without password (maintain backward compatibility)
      await storage.executeQuery(
        'UPDATE users SET digital_certificate_file = $1, digital_certificate_expiration = $2 WHERE id = $3',
        [info.digitalCertificateFile, info.digitalCertificateExpiration, userId]
      );
    }
  }

  private async getP12Password(p12Path: string): Promise<string> {
    // Extract certificate info from path to get the actual password
    // P12 path format: user-{serialNumber}.p12
    try {
      const serialMatch = p12Path.match(/user-([^-.]+)\.p12$/);
      if (!serialMatch) {
        console.warn(`⚠️ Could not extract serial number from P12 path: ${p12Path}`);
        return 'notary123'; // Fallback to old default
      }
      
      const serialNumber = serialMatch[1];
      
      // Query the certificates table for the actual password
      const { certificates } = await import('../../shared/schema');
      const [certificate] = await db
        .select()
        .from(certificates)
        .where(eq(certificates.serialNumber, serialNumber))
        .limit(1);
      
      if (certificate && certificate.p12Password) {
        console.log(`✅ Retrieved actual P12 password for certificate ${serialNumber}`);
        return certificate.p12Password;
      } else {
        console.warn(`⚠️ No password found in database for certificate ${serialNumber}`);
        return 'notary123'; // Fallback
      }
    } catch (error) {
      console.error(`❌ Failed to retrieve P12 password for ${p12Path}:`, error);
      return 'notary123'; // Fallback
    }
  }
}

// Create singleton instance
const certificateService = new CertificateService();

export { CertificateService, certificateService }; 