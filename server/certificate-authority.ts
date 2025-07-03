import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, mkdir, access } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';

const execAsync = promisify(exec);

// Certificate Authority Configuration
interface CAConfig {
  country: string;
  state: string;
  city: string;
  organization: string;
  organizationUnit: string;
  commonName: string;
  emailAddress: string;
  keySize: number;
  validityDays: number;
}

interface UserCertConfig {
  fullName: string;
  email: string;
  state: string;
  notaryCommission: string;
  organizationUnit: string;
  keySize: number;
  validityDays: number;
}

class CertificateAuthority {
  private caPath: string;
  private config: CAConfig;

  constructor(caPath: string = './certs') {
    this.caPath = caPath;
    this.config = {
      country: 'US',
      state: 'California',
      city: 'San Francisco',
      organization: 'USA Notary Platform',
      organizationUnit: 'Digital Notary Services',
      commonName: 'USA Notary CA',
      emailAddress: 'ca@usanotary.com',
      keySize: 4096,
      validityDays: 3650 // 10 years
    };
  }

  /**
   * Initialize the Certificate Authority
   * Creates CA private key and self-signed certificate
   */
  async initializeCA(): Promise<void> {
    try {
      // Ensure certs directory exists
      await mkdir(this.caPath, { recursive: true });

      // Check if CA already exists
      const caKeyPath = join(this.caPath, 'ca-key.pem');
      const caCertPath = join(this.caPath, 'ca-cert.pem');
      
      try {
        await access(caKeyPath);
        await access(caCertPath);
        console.log('✅ Certificate Authority already exists');
        return;
      } catch {
        console.log('🔧 Initializing Certificate Authority...');
      }

      // Generate CA private key and self-signed certificate
      const caSubject = this.buildSubject(this.config);
      const command = `openssl req -x509 -newkey rsa:${this.config.keySize} -days ${this.config.validityDays} -nodes -keyout "${caKeyPath}" -out "${caCertPath}" -subj "${caSubject}"`;
      
      await execAsync(command);
      
      console.log('✅ Certificate Authority initialized successfully');
      console.log(`   - CA Key: ${caKeyPath}`);
      console.log(`   - CA Certificate: ${caCertPath}`);
      
      // Display CA certificate information
      await this.displayCertificateInfo(caCertPath, 'Certificate Authority');
      
    } catch (error) {
      console.error('❌ Failed to initialize Certificate Authority:', error);
      throw error;
    }
  }

  /**
   * Generate a digital certificate for a notary user
   */
  async generateUserCertificate(userConfig: UserCertConfig): Promise<{
    certificatePath: string;
    privateKeyPath: string;
    p12Path: string;
    serialNumber: string;
  }> {
    try {
      const serialNumber = this.generateSerialNumber();
      const userKeyPath = join(this.caPath, `user-${serialNumber}-key.pem`);
      const userCsrPath = join(this.caPath, `user-${serialNumber}-csr.pem`);
      const userCertPath = join(this.caPath, `user-${serialNumber}-cert.pem`);
      const userP12Path = join(this.caPath, `user-${serialNumber}.p12`);
      
      // Build subject for user certificate
      const userSubject = `/C=US/ST=${userConfig.state}/L=Notary/O=USA Notary Platform/OU=${userConfig.organizationUnit}/CN=${userConfig.fullName}/emailAddress=${userConfig.email}`;
      
      console.log(`🔧 Generating certificate for: ${userConfig.fullName}`);
      
      // Step 1: Generate user private key and CSR
      const csrCommand = `openssl req -newkey rsa:${userConfig.keySize} -nodes -keyout "${userKeyPath}" -out "${userCsrPath}" -subj "${userSubject}"`;
      await execAsync(csrCommand);
      
      // Step 2: Create certificate extensions for notary usage
      const extPath = join(this.caPath, `user-${serialNumber}-ext.cnf`);
      const extensions = this.generateNotaryExtensions(userConfig);
      await writeFile(extPath, extensions);
      
      // Step 3: Sign the CSR with CA to create the certificate
      const caKeyPath = join(this.caPath, 'ca-key.pem');
      const caCertPath = join(this.caPath, 'ca-cert.pem');
      
      const signCommand = `openssl x509 -req -in "${userCsrPath}" -days ${userConfig.validityDays} -CA "${caCertPath}" -CAkey "${caKeyPath}" -CAcreateserial -out "${userCertPath}" -extfile "${extPath}"`;
      await execAsync(signCommand);
      
      // Step 4: Create PKCS#12 file (.p12) for easy installation
      const p12Password = this.generateP12Password();
      const p12Command = `openssl pkcs12 -export -out "${userP12Path}" -inkey "${userKeyPath}" -in "${userCertPath}" -certfile "${caCertPath}" -password pass:${p12Password}`;
      await execAsync(p12Command);
      
      // Step 5: Clean up temporary files
      await this.cleanupTempFiles([userCsrPath, extPath]);
      
      console.log('✅ User certificate generated successfully');
      console.log(`   - Certificate: ${userCertPath}`);
      console.log(`   - Private Key: ${userKeyPath}`);
      console.log(`   - PKCS#12 File: ${userP12Path}`);
      console.log(`   - P12 Password: ${p12Password}`);
      
      // Display certificate information
      await this.displayCertificateInfo(userCertPath, `User Certificate (${userConfig.fullName})`);
      
      return {
        certificatePath: userCertPath,
        privateKeyPath: userKeyPath,
        p12Path: userP12Path,
        serialNumber
      };
      
    } catch (error) {
      console.error('❌ Failed to generate user certificate:', error);
      throw error;
    }
  }

  /**
   * Validate a certificate against the CA
   */
  async validateCertificate(certificatePath: string): Promise<{
    valid: boolean;
    reason?: string;
    details?: any;
  }> {
    try {
      const caCertPath = join(this.caPath, 'ca-cert.pem');
      
      // Verify certificate against CA
      const verifyCommand = `openssl verify -CAfile "${caCertPath}" "${certificatePath}"`;
      const { stdout, stderr } = await execAsync(verifyCommand);
      
      if (stdout.includes('OK')) {
        // Get certificate details
        const details = await this.getCertificateDetails(certificatePath);
        
        return {
          valid: true,
          details
        };
      } else {
        return {
          valid: false,
          reason: stderr || 'Certificate verification failed'
        };
      }
      
    } catch (error) {
      return {
        valid: false,
        reason: `Validation error: ${error.message}`
      };
    }
  }

  /**
   * Get detailed certificate information
   */
  async getCertificateDetails(certificatePath: string): Promise<any> {
    try {
      const command = `openssl x509 -in "${certificatePath}" -noout -text`;
      const { stdout } = await execAsync(command);
      
      // Parse certificate information
      const details = this.parseCertificateOutput(stdout);
      return details;
      
    } catch (error) {
      throw new Error(`Failed to get certificate details: ${error.message}`);
    }
  }

  /**
   * Check if certificate is expired or near expiration
   */
  async checkCertificateExpiry(certificatePath: string): Promise<{
    expired: boolean;
    nearExpiry: boolean;
    daysRemaining: number;
    expiryDate: string;
  }> {
    try {
      const command = `openssl x509 -in "${certificatePath}" -noout -enddate`;
      const { stdout } = await execAsync(command);
      
      const expiryStr = stdout.split('=')[1].trim();
      const expiryDate = new Date(expiryStr);
      const now = new Date();
      const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        expired: daysRemaining <= 0,
        nearExpiry: daysRemaining <= 30, // Alert if less than 30 days
        daysRemaining,
        expiryDate: expiryDate.toISOString()
      };
      
    } catch (error) {
      throw new Error(`Failed to check certificate expiry: ${error.message}`);
    }
  }

  /**
   * Revoke a certificate
   */
  async revokeCertificate(certificatePath: string, reason: string = 'unspecified'): Promise<void> {
    try {
      const crlPath = join(this.caPath, 'ca-crl.pem');
      const caKeyPath = join(this.caPath, 'ca-key.pem');
      const caCertPath = join(this.caPath, 'ca-cert.pem');
      
      // Revoke certificate
      const revokeCommand = `openssl ca -revoke "${certificatePath}" -keyfile "${caKeyPath}" -cert "${caCertPath}" -crl_reason ${reason}`;
      await execAsync(revokeCommand);
      
      // Generate updated CRL
      const crlCommand = `openssl ca -gencrl -keyfile "${caKeyPath}" -cert "${caCertPath}" -out "${crlPath}"`;
      await execAsync(crlCommand);
      
      console.log('✅ Certificate revoked successfully');
      
    } catch (error) {
      console.error('❌ Failed to revoke certificate:', error);
      throw error;
    }
  }

  // Private helper methods
  private buildSubject(config: CAConfig): string {
    return `/C=${config.country}/ST=${config.state}/L=${config.city}/O=${config.organization}/OU=${config.organizationUnit}/CN=${config.commonName}/emailAddress=${config.emailAddress}`;
  }

  private generateSerialNumber(): string {
    return randomBytes(8).toString('hex').toUpperCase();
  }

  private generateP12Password(): string {
    return randomBytes(12).toString('base64').slice(0, 16);
  }

  private generateNotaryExtensions(userConfig: UserCertConfig): string {
    return `
# X.509 extensions for notary certificates
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
extendedKeyUsage = emailProtection, clientAuth, codeSigning
subjectAltName = @alt_names
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer

# Notary-specific extensions
1.3.6.1.4.1.99999.1 = ASN1:UTF8String:${userConfig.notaryCommission}
1.3.6.1.4.1.99999.2 = ASN1:UTF8String:${userConfig.state}
1.3.6.1.4.1.99999.3 = ASN1:UTF8String:Digital Notary Certificate

[alt_names]
email.1 = ${userConfig.email}
DNS.1 = usanotary.com
`;
  }

  private async displayCertificateInfo(certPath: string, title: string): Promise<void> {
    try {
      const command = `openssl x509 -in "${certPath}" -noout -text | head -20`;
      const { stdout } = await execAsync(command);
      
      console.log(`\n📋 ${title} Information:`);
      console.log('----------------------------------------');
      console.log(stdout);
      console.log('----------------------------------------\n');
      
    } catch (error) {
      console.log(`⚠️  Could not display certificate info: ${error.message}`);
    }
  }

  private parseCertificateOutput(output: string): any {
    const details: any = {};
    
    // Extract common certificate fields
    const subjectMatch = output.match(/Subject: (.+)/);
    if (subjectMatch) details.subject = subjectMatch[1];
    
    const issuerMatch = output.match(/Issuer: (.+)/);
    if (issuerMatch) details.issuer = issuerMatch[1];
    
    const serialMatch = output.match(/Serial Number: (.+)/);
    if (serialMatch) details.serialNumber = serialMatch[1];
    
    const validFromMatch = output.match(/Not Before: (.+)/);
    if (validFromMatch) details.validFrom = validFromMatch[1];
    
    const validToMatch = output.match(/Not After : (.+)/);
    if (validToMatch) details.validTo = validToMatch[1];
    
    return details;
  }

  private async cleanupTempFiles(files: string[]): Promise<void> {
    for (const file of files) {
      try {
        await exec(`rm -f "${file}"`);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

export { CertificateAuthority, CAConfig, UserCertConfig }; 