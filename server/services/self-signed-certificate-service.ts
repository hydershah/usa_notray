import * as selfsigned from 'selfsigned';
import { promises as fs } from 'fs';
import { join } from 'path';
import { storage } from '../storage';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface SelfSignedCertificateResult {
  success: boolean;
  certificateId?: string;
  certificatePath?: string;
  privateKeyPath?: string;
  publicKeyPath?: string;
  certificate?: string;
  privateKey?: string;
  publicKey?: string;
  error?: string;
  expirationDate?: Date;
}

export interface CertificateUserInfo {
  id: number;
  email: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  role: string;
  state?: string;
  verificationDate: Date;
}

class SelfSignedCertificateService {
  private certificatesDir: string;

  constructor() {
    this.certificatesDir = join(process.cwd(), 'certificates', 'user-certificates');
  }

  /**
   * Initialize the certificate service
   */
  async initialize(): Promise<void> {
    try {
      // Ensure certificates directory exists
      await fs.mkdir(this.certificatesDir, { recursive: true });
      console.log(`✅ Self-signed certificate service initialized: ${this.certificatesDir}`);
    } catch (error) {
      console.error('❌ Failed to initialize self-signed certificate service:', error);
      throw error;
    }
  }

  /**
   * Generate a self-signed certificate for a verified signer or witness
   */
  async generateCertificateForUser(userId: number): Promise<SelfSignedCertificateResult> {
    try {
      await this.initialize();

      // Get user details
      const user = await storage.getUserById(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Validate user role
      if (!['signer', 'witness'].includes(user.role)) {
        return { success: false, error: 'Certificates can only be generated for signers and witnesses' };
      }

      // Validate user is verified
      const isVerified = user.isVerified || user.isVerificationBypassed || user.notaryVerificationBypassed;
      if (!isVerified) {
        return { 
          success: false, 
          error: 'User must complete ID verification before certificate generation' 
        };
      }

      // Check if user already has a certificate
      const existingCert = await this.getUserCertificate(userId);
      if (existingCert && !this.isCertificateExpired(existingCert)) {
        return { 
          success: false, 
          error: 'User already has an active certificate' 
        };
      }

      // Prepare certificate attributes
      const fullName = user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
      const organizationUnit = user.role === 'signer' ? 'Document Signers' : 'Document Witnesses';
      const commonName = `${fullName} (Verified ${user.role.charAt(0).toUpperCase() + user.role.slice(1)})`;

      const attrs = [
        { name: 'commonName', value: commonName },
        { name: 'emailAddress', value: user.email },
        { name: 'organizationName', value: 'USA Notary Platform' },
        { name: 'organizationalUnitName', value: organizationUnit },
        { name: 'countryName', value: 'US' },
        { name: 'stateOrProvinceName', value: user.state || 'Unknown' },
        { name: 'localityName', value: 'Digital Verification' }
      ];

      // Certificate options
      const options = {
        keySize: 2048,
        days: 365, // 1 year validity
        algorithm: 'sha256',
        extensions: [
          {
            name: 'basicConstraints',
            cA: false
          },
          {
            name: 'keyUsage',
            digitalSignature: true,
            keyEncipherment: true,
            nonRepudiation: true
          },
          {
            name: 'extKeyUsage',
            clientAuth: true,
            emailProtection: true
          },
          {
            name: 'subjectAltName',
            altNames: [
              {
                type: 1, // RFC822 Name (email)
                value: user.email
              }
            ]
          }
        ]
      };

      console.log(`🔐 Generating self-signed certificate for ${user.role}: ${commonName}`);

      // Generate the self-signed certificate
      const pems = selfsigned.generate(attrs, options);

      // Create unique certificate ID
      const certificateId = `user-${userId}-${Date.now()}`;
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      
      // Define file paths
      const certFileName = `${certificateId}-cert.pem`;
      const keyFileName = `${certificateId}-key.pem`;
      const pubKeyFileName = `${certificateId}-pubkey.pem`;
      
      const certificatePath = join(this.certificatesDir, certFileName);
      const privateKeyPath = join(this.certificatesDir, keyFileName);
      const publicKeyPath = join(this.certificatesDir, pubKeyFileName);

      // Save certificate files
      await fs.writeFile(certificatePath, pems.cert);
      await fs.writeFile(privateKeyPath, pems.private);
      await fs.writeFile(publicKeyPath, pems.public);

      // Calculate expiration date
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + options.days);

      // Store certificate info in database
      await this.storeCertificateRecord({
        userId,
        certificateId,
        certificatePath: certFileName, // Store relative path
        privateKeyPath: keyFileName,
        publicKeyPath: pubKeyFileName,
        certificate: pems.cert,
        privateKey: pems.private,
        publicKey: pems.public,
        expirationDate,
        issuedAt: new Date(),
        userRole: user.role,
        userEmail: user.email,
        commonName
      });

      // Update user record with certificate information
      await db.update(users)
        .set({
          digitalCertificateFile: certFileName,
          digitalCertificateExpiration: expirationDate,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));

      console.log(`✅ Self-signed certificate generated successfully for user ${userId}`);
      console.log(`   - Certificate: ${certificatePath}`);
      console.log(`   - Private Key: ${privateKeyPath}`);
      console.log(`   - Public Key: ${publicKeyPath}`);
      console.log(`   - Expires: ${expirationDate.toISOString()}`);

      return {
        success: true,
        certificateId,
        certificatePath,
        privateKeyPath,
        publicKeyPath,
        certificate: pems.cert,
        privateKey: pems.private,
        publicKey: pems.public,
        expirationDate
      };

    } catch (error) {
      console.error(`❌ Failed to generate self-signed certificate for user ${userId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Certificate generation failed'
      };
    }
  }

  /**
   * Get user's certificate information
   */
  async getUserCertificate(userId: number): Promise<any> {
    try {
      const result = await storage.executeQuery(`
        SELECT * FROM self_signed_certificates 
        WHERE user_id = $1 AND status = 'active'
        ORDER BY issued_at DESC 
        LIMIT 1
      `, [userId]);

      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error('Error getting user certificate:', error);
      return null;
    }
  }

  /**
   * Check if certificate is expired
   */
  private isCertificateExpired(certificate: any): boolean {
    if (!certificate || !certificate.expires_at) return true;
    return new Date() > new Date(certificate.expires_at);
  }

  /**
   * Store certificate record in database
   */
  private async storeCertificateRecord(record: {
    userId: number;
    certificateId: string;
    certificatePath: string;
    privateKeyPath: string;
    publicKeyPath: string;
    certificate: string;
    privateKey: string;
    publicKey: string;
    expirationDate: Date;
    issuedAt: Date;
    userRole: string;
    userEmail: string;
    commonName: string;
  }): Promise<void> {
    // Create table if it doesn't exist
    await storage.executeQuery(`
      CREATE TABLE IF NOT EXISTS self_signed_certificates (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        certificate_id VARCHAR(255) NOT NULL UNIQUE,
        certificate_path TEXT NOT NULL,
        private_key_path TEXT NOT NULL,
        public_key_path TEXT NOT NULL,
        certificate_content TEXT NOT NULL,
        common_name VARCHAR(255) NOT NULL,
        user_role VARCHAR(50) NOT NULL,
        user_email VARCHAR(255) NOT NULL,
        issued_at TIMESTAMP NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_user_certificates_user_id ON self_signed_certificates(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_certificates_status ON self_signed_certificates(status);
      CREATE INDEX IF NOT EXISTS idx_user_certificates_expires ON self_signed_certificates(expires_at);
    `);

    await storage.executeQuery(`
      INSERT INTO self_signed_certificates (
        user_id, certificate_id, certificate_path, private_key_path, public_key_path,
        certificate_content, private_key, public_key, common_name, user_role, user_email, 
        issued_at, expires_at, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [
      record.userId,
      record.certificateId,
      record.certificatePath,
      record.privateKeyPath,
      record.publicKeyPath,
      record.certificate,
      record.privateKey,
      record.publicKey,
      record.commonName,
      record.userRole,
      record.userEmail,
      record.issuedAt,
      record.expirationDate,
      'active'
    ]);
  }

  /**
   * Get certificate file content for download
   */
  async getCertificateFile(userId: number, fileType: 'cert' | 'key' | 'pubkey' = 'cert'): Promise<{
    success: boolean;
    filePath?: string;
    content?: string;
    fileName?: string;
    error?: string;
  }> {
    try {
      const certificate = await this.getUserCertificate(userId);
      if (!certificate) {
        return { success: false, error: 'No active certificate found' };
      }

      let fileName: string;
      let relativePath: string;

      switch (fileType) {
        case 'cert':
          fileName = certificate.certificate_path;
          relativePath = certificate.certificate_path;
          break;
        case 'key':
          fileName = certificate.private_key_path;
          relativePath = certificate.private_key_path;
          break;
        case 'pubkey':
          fileName = certificate.public_key_path;
          relativePath = certificate.public_key_path;
          break;
        default:
          return { success: false, error: 'Invalid file type' };
      }

      const fullPath = join(this.certificatesDir, relativePath);
      
      // Check if file exists
      try {
        await fs.access(fullPath);
      } catch {
        return { success: false, error: 'Certificate file not found' };
      }

      const content = await fs.readFile(fullPath, 'utf8');

      return {
        success: true,
        filePath: fullPath,
        content,
        fileName
      };

    } catch (error) {
      console.error('Error getting certificate file:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get certificate file' 
      };
    }
  }

  /**
   * List all certificates for admin view
   */
  async getAllCertificates(): Promise<any[]> {
    try {
      const result = await storage.executeQuery(`
        SELECT 
          uc.*,
          u.username,
          u.email,
          u.first_name,
          u.last_name,
          u.full_name,
          u.role,
          u.is_verified,
          u.verification_status
        FROM self_signed_certificates uc
        LEFT JOIN users u ON uc.user_id = u.id
        ORDER BY uc.issued_at DESC
      `);

      return result.map((cert: any) => ({
        id: cert.id,
        userId: cert.user_id,
        certificateId: cert.certificate_id,
        commonName: cert.common_name,
        userRole: cert.user_role,
        userEmail: cert.user_email,
        issuedAt: cert.issued_at,
        expiresAt: cert.expires_at,
        status: cert.status,
        isExpired: new Date() > new Date(cert.expires_at),
        user: {
          username: cert.username,
          email: cert.email,
          firstName: cert.first_name,
          lastName: cert.last_name,
          fullName: cert.full_name,
          role: cert.role,
          isVerified: cert.is_verified,
          verificationStatus: cert.verification_status
        }
      }));
    } catch (error) {
      console.error('Error getting all certificates:', error);
      return [];
    }
  }

  /**
   * Revoke a certificate
   */
  async revokeCertificate(userId: number, reason?: string): Promise<{ success: boolean; error?: string }> {
    try {
      await storage.executeQuery(`
        UPDATE self_signed_certificates 
        SET status = 'revoked', updated_at = NOW()
        WHERE user_id = $1 AND status = 'active'
      `, [userId]);

      // Clear certificate info from user record
      await db.update(users)
        .set({
          digitalCertificateFile: null,
          digitalCertificateExpiration: null,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));

      console.log(`🚫 Certificate revoked for user ${userId}${reason ? ` (Reason: ${reason})` : ''}`);
      
      return { success: true };
    } catch (error) {
      console.error('Error revoking certificate:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to revoke certificate' 
      };
    }
  }
}

// Export singleton instance
export const selfSignedCertificateService = new SelfSignedCertificateService(); 