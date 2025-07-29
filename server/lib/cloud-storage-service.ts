import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'crypto';
import { Readable } from 'stream';

// Ensure environment variables are loaded
import dotenv from 'dotenv';
dotenv.config();

// Check for required Vultr credentials
const REQUIRED_ENV_VARS = [
  'VULTR_ACCESS_KEY',
  'VULTR_SECRET_KEY',
  'VULTR_REGION',
  'VULTR_BUCKET_NAME',
  'VULTR_ENDPOINT'
];

const missingVars = REQUIRED_ENV_VARS.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.warn('⚠️  WARNING: Missing Vultr environment variables:', missingVars.join(', '));
  console.warn('⚠️  Document storage features will not work properly without these variables.');
  console.warn('⚠️  Please set these environment variables in production.');
}

interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  acl?: 'private' | 'public-read';
  cacheControl?: string;
}

interface UploadResult {
  key: string;
  url: string;
  etag: string;
  size: number;
}

export class CloudStorageService {
  private s3Client: S3Client | null = null;
  private bucketName: string;
  private region: string;
  private isEnabled: boolean = false;

  constructor() {
    this.region = process.env.VULTR_REGION || 'ewr1'; // Vultr region codes
    this.bucketName = process.env.VULTR_BUCKET_NAME || 'usanotary'; // Fixed to match actual bucket
    
    // Check if Vultr credentials are available
    const hasCredentials = !!(process.env.VULTR_ACCESS_KEY && process.env.VULTR_SECRET_KEY);
    
    if (hasCredentials) {
      try {
        console.log(`🔑 Vultr credentials found - initializing cloud storage...`);
        
        // Initialize S3-compatible client for Vultr Object Storage
        this.s3Client = new S3Client({
          region: this.region,
          endpoint: process.env.VULTR_ENDPOINT || `https://${this.region}.vultrobjects.com`,
          credentials: {
            accessKeyId: process.env.VULTR_ACCESS_KEY!,
            secretAccessKey: process.env.VULTR_SECRET_KEY!,
          },
          maxAttempts: 3, // Retry failed requests
          forcePathStyle: false, // Vultr uses virtual hosted style
        });
        
        this.isEnabled = true;
        console.log(`🪣 CloudStorageService initialized with bucket: ${this.bucketName} in region: ${this.region}`);
      } catch (error) {
        console.error('❌ Failed to initialize Vultr client:', error);
        this.isEnabled = false;
      }
    } else {
      console.warn('⚠️  Vultr Object Storage credentials not found - running without cloud storage');
      console.warn('📝 To enable cloud storage, set VULTR_ACCESS_KEY and VULTR_SECRET_KEY environment variables');
      console.warn(`🔍 Current env check: ACCESS_KEY=${!!process.env.VULTR_ACCESS_KEY}, SECRET_KEY=${!!process.env.VULTR_SECRET_KEY}`);
      this.isEnabled = false;
    }
  }

  /**
   * Upload a file buffer to cloud storage
   */
  async uploadFile(
    buffer: Buffer,
    key: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    if (!this.isEnabled || !this.s3Client) {
      console.warn('⚠️  Cloud storage not available - file upload skipped');
      // Return a mock result for development
      return {
        key: key,
        url: `/dev-storage/${key}`,
        etag: 'dev-mock-etag',
        size: buffer.length,
      };
    }

    try {
      // Generate content hash for integrity verification
      const contentHash = createHash('md5').update(buffer).digest('hex');
      
      // Ensure all metadata values are strings and contain only valid characters
      const stringifiedMetadata: Record<string, string> = {};
      if (options.metadata) {
        for (const [metaKey, value] of Object.entries(options.metadata)) {
          // Sanitize metadata keys and values for S3 compatibility
          const sanitizedKey = metaKey.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
          const sanitizedValue = value != null ? String(value).replace(/[^\x00-\x7F]/g, '') : '';
          
          if (sanitizedKey && sanitizedValue) {
            stringifiedMetadata[sanitizedKey] = sanitizedValue.substring(0, 256); // S3 metadata value limit
          }
        }
      }
      
      // Sanitize the object key to ensure S3 compatibility
      const sanitizedKey = key.replace(/[^a-zA-Z0-9\/\-_.~]/g, '-');
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: sanitizedKey,
        Body: buffer,
        ContentType: options.contentType || 'application/octet-stream',
        Metadata: {
          ...stringifiedMetadata,
          'uploaded-at': new Date().toISOString().replace(/[:.]/g, '-'), // S3-safe timestamp
          'original-size': buffer.length.toString(),
        },
        ACL: options.acl || 'private',
        CacheControl: options.cacheControl || 'max-age=31536000', // 1 year cache
        // Remove ServerSideEncryption as some Vultr regions may not support it
      });

      const result = await this.s3Client.send(command);
      
      return {
        key: sanitizedKey,
        url: `https://${this.bucketName}.${this.region}.vultrobjects.com/${sanitizedKey}`,
        etag: result.ETag || '',
        size: buffer.length,
      };
    } catch (error: any) {
      console.error('File upload failed:', {
        error: error.message,
        code: error.Code,
        bucketName: this.bucketName,
        region: this.region,
        key: key
      });
      
      // Provide more specific error messages
      if (error.Code === 'InvalidArgument') {
        throw new Error(`Invalid upload parameters. Check bucket name, region, and file content.`);
      } else if (error.Code === 'NoSuchBucket') {
        throw new Error(`Bucket '${this.bucketName}' does not exist in region '${this.region}'.`);
      } else if (error.Code === 'AccessDenied') {
        throw new Error(`Access denied. Check your Vultr credentials and bucket permissions.`);
      } else {
        throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Upload a stream to cloud storage (for large files)
   */
  async uploadStream(
    stream: Readable,
    key: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    try {
      // Ensure all metadata values are strings (AWS SDK requirement)
      const stringifiedMetadata: Record<string, string> = {};
      if (options.metadata) {
        for (const [key, value] of Object.entries(options.metadata)) {
          stringifiedMetadata[key] = value != null ? String(value) : '';
        }
      }
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: stream,
        ContentType: options.contentType || 'application/octet-stream',
        Metadata: {
          ...stringifiedMetadata,
          uploadedAt: new Date().toISOString(),
        },
        ACL: options.acl || 'private',
        CacheControl: options.cacheControl || 'max-age=31536000',
        ServerSideEncryption: 'AES256',
      });

      const result = await this.s3Client.send(command);
      
      return {
        key,
        url: `https://${this.bucketName}.${this.region}.vultrobjects.com/${key}`,
        etag: result.ETag || '',
        size: 0, // Size unknown for streams
      };
    } catch (error) {
      console.error('Stream upload failed:', error);
      throw new Error(`Failed to upload stream: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a signed URL for file access
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    console.log(`🔗 getSignedUrl called for: ${key}`);
    console.log(`🔍 Service state: isEnabled=${this.isEnabled}, hasS3Client=${!!this.s3Client}`);
    
    if (!this.isEnabled || !this.s3Client) {
      console.warn('⚠️  Cloud storage not available - returning dev URL');
      console.warn(`📊 Details: isEnabled=${this.isEnabled}, s3Client=${!!this.s3Client}`);
      return `/dev-storage/${key}?expires=${Date.now() + (expiresIn * 1000)}`;
    }

    try {
      console.log(`🔗 Generating real Vultr signed URL for: ${key}`);
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
      console.log(`✅ Generated Vultr signed URL: ${signedUrl.substring(0, 100)}...`);
      return signedUrl;
    } catch (error) {
      console.error('Failed to generate signed URL:', error);
      throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download a file as Buffer from cloud storage
   */
  async downloadFile(key: string): Promise<Buffer> {
    if (!this.isEnabled || !this.s3Client) {
      throw new Error('Cloud storage not available - cannot download certificate file');
    }

    try {
      console.log(`📥 Downloading file from Vultr: ${key}`);
      
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const result = await this.s3Client.send(command);
      
      if (!result.Body) {
        throw new Error('No file content received from Vultr storage');
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      if (result.Body) {
        for await (const chunk of result.Body as any) {
          chunks.push(chunk);
        }
      }
      
      const buffer = Buffer.concat(chunks);
      console.log(`✅ Downloaded ${buffer.length} bytes from Vultr: ${key}`);
      
      return buffer;
    } catch (error) {
      console.error(`❌ Failed to download file from Vultr: ${key}`, error);
      throw new Error(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get file metadata without downloading the file
   */
  async getFileMetadata(key: string): Promise<{
    size: number;
    lastModified: Date;
    contentType: string;
    metadata: Record<string, string>;
  }> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const result = await this.s3Client.send(command);
      
      return {
        size: result.ContentLength || 0,
        lastModified: result.LastModified || new Date(),
        contentType: result.ContentType || 'application/octet-stream',
        metadata: result.Metadata || {},
      };
    } catch (error) {
      console.error('Failed to get file metadata:', error);
      throw new Error(`Failed to get file metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a file from cloud storage
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(key: string): Promise<boolean> {
    if (!this.isEnabled || !this.s3Client) {
      console.warn('⚠️  Cloud storage not available - assuming file exists for dev');
      return true; // Assume files exist in development
    }

    try {
      await this.getFileMetadata(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate a secure file key with intelligent organization
   */
  async generateFileKey(
    type: 'document' | 'signature' | 'stamp' | 'certificate', 
    sessionId: string, 
    originalFilename: string,
    userId?: number,
    options?: {
      userRole?: string;
      jobId?: number;
      notaryId?: number;
    }
  ): Promise<string> {
    const { generateVultrKey } = await import('./vultr-file-organizer');
    
    const organizedPath = generateVultrKey(type, originalFilename, {
      userId,
      userRole: options?.userRole,
      jobId: options?.jobId,
      notaryId: options?.notaryId,
      sessionId
    });
    
    return organizedPath.vultrKey;
  }

  /**
   * Get bucket statistics (for monitoring)
   */
  async getBucketStats(): Promise<{
    bucketName: string;
    region: string;
    isAccessible: boolean;
  }> {
    try {
      // Test bucket access by attempting to list objects (limited)
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: 'test-access',
      });

      try {
        await this.s3Client.send(command);
      } catch (error) {
        // Expected for non-existent key, but validates bucket access
      }

      return {
        bucketName: this.bucketName,
        region: this.region,
        isAccessible: true,
      };
    } catch (error) {
      return {
        bucketName: this.bucketName,
        region: this.region,
        isAccessible: false,
      };
    }
  }

  /**
   * Cleanup temporary files (optional utility method)
   */
  async cleanupTempFiles(olderThanDays: number = 7): Promise<number> {
    // This would require listing objects and filtering by date
    // Implementation depends on your specific cleanup requirements
    console.log(`Cleanup of temporary files older than ${olderThanDays} days would be implemented here`);
    return 0;
  }
}

// Singleton instance
export const cloudStorage = new CloudStorageService();

// Enhanced file upload handler using cloud storage with intelligent organization
export async function handleCloudFileUpload(
  buffer: Buffer,
  originalFilename: string,
  uploadType: 'document' | 'signature' | 'stamp' | 'certificate',
  sessionId: string,
  userId?: number,
  metadata?: Record<string, string> & {
    userRole?: string;
    jobId?: number;
    notaryId?: number;
  }
): Promise<{
  key: string;
  url: string;
  signedUrl: string;
  size: number;
  organizedPath?: {
    folder: string;
    filename: string;
  };
}> {
  try {
    // Generate intelligent file key with organization
    const fileKey = await cloudStorage.generateFileKey(uploadType, sessionId, originalFilename, userId, {
      userRole: metadata?.userRole,
      jobId: metadata?.jobId,
      notaryId: metadata?.notaryId,
    });
    
    // Get content type using the organizer
    const { VultrFileOrganizer } = await import('./vultr-file-organizer');
    const contentType = VultrFileOrganizer.getContentType(originalFilename);
    
    // Upload to cloud storage
    const uploadResult = await cloudStorage.uploadFile(buffer, fileKey, {
      contentType,
      metadata: {
        originalFilename,
        uploadType,
        sessionId,
        userId: userId?.toString() || '',
        userRole: metadata?.userRole || '',
        jobId: metadata?.jobId?.toString() || '',
        notaryId: metadata?.notaryId?.toString() || '',
        uploadedAt: new Date().toISOString(),
        ...metadata,
      },
      acl: 'private', // All files are private by default
    });
    
    // Generate signed URL for immediate access
    const signedUrl = await cloudStorage.getSignedUrl(fileKey, 3600); // 1 hour expiry
    
    // Parse the organized path for additional info
    let organizedPath;
    try {
      const parsed = VultrFileOrganizer.parseVultrKey(fileKey);
      organizedPath = {
        folder: `${parsed.fileType}/${parsed.year}/${parsed.month}/${parsed.category}`,
        filename: parsed.filename
      };
    } catch (error) {
      console.warn('Could not parse organized path:', error);
    }
    
    return {
      key: fileKey,
      url: uploadResult.url,
      signedUrl,
      size: uploadResult.size,
      organizedPath,
    };
  } catch (error) {
    console.error('Cloud file upload failed:', error);
    throw error;
  }
} 