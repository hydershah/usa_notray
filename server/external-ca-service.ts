import axios, { AxiosInstance } from 'axios';
import { createHash } from 'crypto';
import { storage } from './storage';

interface ExternalCAConfig {
  baseUrl: string;
  username: string;
  password: string;
  timeout: number;
  retries: number;
}

interface CertificateRequest {
  commonName: string;
  email: string;
  organization: string;
  organizationUnit: string;
  country: string;
  state: string;
  locality: string;
  keySize: number;
  validityDays: number;
  purpose: 'notary' | 'digital_signature' | 'authentication';
  userId: number;
}

interface CertificateResponse {
  success: boolean;
  certificateId?: string;
  serialNumber?: string;
  certificate?: string; // PEM format
  privateKey?: string; // PEM format  
  p12Certificate?: string; // Base64 encoded P12
  p12Password?: string;
  downloadUrl?: string;
  expiresAt?: string;
  error?: string;
}

interface CertificateStatus {
  certificateId: string;
  status: 'active' | 'expired' | 'revoked' | 'pending';
  issuedAt: string;
  expiresAt: string;
  serialNumber: string;
  revokedAt?: string;
  revocationReason?: string;
}

export class ExternalCertificateAuthorityService {
  private client: AxiosInstance;
  private config: ExternalCAConfig;

  constructor() {
    this.config = {
      baseUrl: process.env.EXTERNAL_CA_URL || 'https://104.238.133.98',
      username: process.env.EXTERNAL_CA_USERNAME || 'root',
      password: process.env.EXTERNAL_CA_PASSWORD || '3}QxfBR[TB@*4%Zg',
      timeout: 30000, // 30 seconds
      retries: 3
    };

    // Initialize axios client with authentication and SSL configuration
    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      auth: {
        username: this.config.username,
        password: this.config.password
      },
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'USA-Notary-System/1.0'
      },
      // For production, you'd want to verify SSL certificates
      // For development/testing, you might need to disable verification
      httpsAgent: process.env.NODE_ENV === 'production' ? undefined : {
        rejectUnauthorized: false
      }
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`🔐 External CA Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('🚫 External CA Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ External CA Response: ${response.status} ${response.statusText}`);
        return response;
      },
      (error) => {
        console.error(`❌ External CA Error: ${error.response?.status} ${error.message}`);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Generate a new certificate for a notary user
   */
  async generateNotaryCertificate(userId: number): Promise<CertificateResponse> {
    try {
      // Get user details from database
      const user = await storage.getUserById(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Validate user is a notary
      if (user.role !== 'notary') {
        return { success: false, error: 'User is not a notary' };
      }

      // Check if user already has an active certificate
      const existingCert = await this.getUserActiveCertificate(userId);
      if (existingCert && existingCert.status === 'active') {
        return { 
          success: false, 
          error: 'User already has an active certificate' 
        };
      }

      // Prepare certificate request
      const certRequest: CertificateRequest = {
        commonName: user.nameOnCommission || user.fullName || user.email,
        email: user.email,
        organization: 'USA Notary Services',
        organizationUnit: user.notaryType === 'contractor' ? 'Contractor Notary' : 'Subscriber Notary',
        country: 'US',
        state: user.commissionState || user.state || 'CA',
        locality: user.commissionCity || user.city || 'San Francisco',
        keySize: 2048,
        validityDays: 1095, // 3 years
        purpose: 'notary',
        userId: userId
      };

      console.log(`🔧 Requesting certificate from external CA for user ${userId}: ${certRequest.commonName}`);

      // Make request to external CA
      const response = await this.makeCARequest('/api/certificates/generate', 'POST', certRequest);

      if (response.success) {
        // Store certificate record in local database
        await this.storeCertificateRecord({
          userId,
          externalCertificateId: response.certificateId!,
          serialNumber: response.serialNumber!,
          status: 'active',
          issuedAt: new Date().toISOString(),
          expiresAt: response.expiresAt!,
          p12Password: response.p12Password,
          downloadUrl: response.downloadUrl
        });

        // Update user record with certificate information
        await storage.updateUser(userId, {
          digitalCertificateFile: response.downloadUrl,
          digitalCertificateExpiration: response.expiresAt
        });

        console.log(`✅ Certificate generated successfully for user ${userId}`);
      }

      return response;

    } catch (error) {
      console.error(`❌ Failed to generate certificate for user ${userId}:`, error);
      return {
        success: false,
        error: error.message || 'Failed to communicate with Certificate Authority'
      };
    }
  }

  /**
   * Check certificate status
   */
  async checkCertificateStatus(certificateId: string): Promise<CertificateStatus | null> {
    try {
      const response = await this.makeCARequest(`/api/certificates/${certificateId}/status`, 'GET');
      return response.success ? response.data : null;
    } catch (error) {
      console.error(`❌ Failed to check certificate status for ${certificateId}:`, error);
      return null;
    }
  }

  /**
   * Validate a certificate
   */
  async validateCertificate(certificateId: string): Promise<{
    valid: boolean;
    expired?: boolean;
    nearExpiry?: boolean;
    daysRemaining?: number;
    error?: string;
  }> {
    try {
      const response = await this.makeCARequest(`/api/certificates/${certificateId}/validate`, 'GET');
      
      if (!response.success) {
        return { valid: false, error: response.error };
      }

      return {
        valid: response.data.valid,
        expired: response.data.expired,
        nearExpiry: response.data.nearExpiry,
        daysRemaining: response.data.daysRemaining
      };

    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Revoke a certificate
   */
  async revokeCertificate(certificateId: string, reason: string = 'user_request'): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const response = await this.makeCARequest(`/api/certificates/${certificateId}/revoke`, 'POST', {
        reason
      });

      if (response.success) {
        // Update local database
        await this.updateCertificateStatus(certificateId, 'revoked');
        
        // Update user record
        const cert = await this.getCertificateByExternalId(certificateId);
        if (cert) {
          await storage.updateUser(cert.userId, {
            digitalCertificateFile: null,
            digitalCertificateExpiration: null
          });
        }
      }

      return response;

    } catch (error) {
      console.error(`❌ Failed to revoke certificate ${certificateId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Download certificate file
   */
  async downloadCertificate(certificateId: string, format: 'pem' | 'p12' = 'p12'): Promise<{
    success: boolean;
    data?: Buffer;
    filename?: string;
    password?: string;
    error?: string;
  }> {
    try {
      const response = await this.client.get(`/api/certificates/${certificateId}/download`, {
        params: { format },
        responseType: 'arraybuffer'
      });

      const filename = response.headers['content-disposition']?.match(/filename="(.+)"/)?.[1] || 
                      `certificate_${certificateId}.${format}`;
      
      let password;
      if (format === 'p12') {
        const cert = await this.getCertificateByExternalId(certificateId);
        password = cert?.p12Password;
      }

      return {
        success: true,
        data: Buffer.from(response.data),
        filename,
        password
      };

    } catch (error) {
      console.error(`❌ Failed to download certificate ${certificateId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get certificate statistics from external CA
   */
  async getCertificateStats(): Promise<{
    total: number;
    active: number;
    expired: number;
    revoked: number;
    nearExpiry: number;
  }> {
    try {
      const response = await this.makeCARequest('/api/certificates/stats', 'GET');
      return response.success ? response.data : {
        total: 0,
        active: 0,
        expired: 0,
        revoked: 0,
        nearExpiry: 0
      };
    } catch (error) {
      console.error('❌ Failed to get certificate stats:', error);
      return {
        total: 0,
        active: 0,
        expired: 0,
        revoked: 0,
        nearExpiry: 0
      };
    }
  }

  /**
   * Sync certificate status with external CA
   */
  async syncCertificateStatuses(): Promise<{
    synced: number;
    errors: number;
  }> {
    try {
      const localCerts = await this.getAllLocalCertificates();
      let synced = 0;
      let errors = 0;

      for (const cert of localCerts) {
        try {
          const status = await this.checkCertificateStatus(cert.externalCertificateId);
          if (status && status.status !== cert.status) {
            await this.updateCertificateStatus(cert.externalCertificateId, status.status);
            synced++;
          }
        } catch (error) {
          console.error(`Error syncing certificate ${cert.externalCertificateId}:`, error);
          errors++;
        }
      }

      console.log(`📊 Certificate sync complete: ${synced} updated, ${errors} errors`);
      return { synced, errors };

    } catch (error) {
      console.error('❌ Failed to sync certificate statuses:', error);
      return { synced: 0, errors: 1 };
    }
  }

  // Private helper methods
  private async makeCARequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', data?: any): Promise<any> {
    const maxRetries = this.config.retries;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.request({
          url: endpoint,
          method,
          data
        });

        return response.data;

      } catch (error) {
        lastError = error;
        console.warn(`🔄 CA request attempt ${attempt}/${maxRetries} failed:`, error.message);
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  private async getUserActiveCertificate(userId: number): Promise<any> {
    const result = await storage.executeQuery(
      'SELECT * FROM external_certificates WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1',
      [userId, 'active']
    );
    return result[0] || null;
  }

  private async getCertificateByExternalId(externalCertificateId: string): Promise<any> {
    const result = await storage.executeQuery(
      'SELECT * FROM external_certificates WHERE external_certificate_id = $1 LIMIT 1',
      [externalCertificateId]
    );
    return result[0] || null;
  }

  private async getAllLocalCertificates(): Promise<any[]> {
    return await storage.executeQuery(
      'SELECT * FROM external_certificates WHERE status IN ($1, $2)',
      ['active', 'pending']
    );
  }

  private async storeCertificateRecord(record: {
    userId: number;
    externalCertificateId: string;
    serialNumber: string;
    status: string;
    issuedAt: string;
    expiresAt: string;
    p12Password?: string;
    downloadUrl?: string;
  }): Promise<void> {
    // Create table if it doesn't exist
    await storage.executeQuery(`
      CREATE TABLE IF NOT EXISTS external_certificates (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        external_certificate_id VARCHAR(255) NOT NULL UNIQUE,
        serial_number VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        issued_at TIMESTAMP NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        p12_password TEXT,
        download_url TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_external_certificates_user_id ON external_certificates(user_id);
      CREATE INDEX IF NOT EXISTS idx_external_certificates_status ON external_certificates(status);
      CREATE INDEX IF NOT EXISTS idx_external_certificates_external_id ON external_certificates(external_certificate_id);
    `);

    await storage.executeQuery(`
      INSERT INTO external_certificates (
        user_id, external_certificate_id, serial_number, status, 
        issued_at, expires_at, p12_password, download_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      record.userId,
      record.externalCertificateId,
      record.serialNumber,
      record.status,
      record.issuedAt,
      record.expiresAt,
      record.p12Password,
      record.downloadUrl
    ]);
  }

  private async updateCertificateStatus(externalCertificateId: string, status: string): Promise<void> {
    await storage.executeQuery(
      'UPDATE external_certificates SET status = $1, updated_at = NOW() WHERE external_certificate_id = $2',
      [status, externalCertificateId]
    );
  }
}

// Create singleton instance
export const externalCAService = new ExternalCertificateAuthorityService(); 