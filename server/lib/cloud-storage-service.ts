import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'crypto';
import { Readable } from 'stream';

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
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;

  constructor() {
    this.region = process.env.VULTR_REGION || 'ewr1'; // Vultr region codes
    this.bucketName = process.env.VULTR_BUCKET_NAME || 'usa-notary-documents';
    
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

    // Validate required environment variables
    if (!process.env.VULTR_ACCESS_KEY || !process.env.VULTR_SECRET_KEY) {
      throw new Error('Vultr Object Storage credentials must be set in environment variables');
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
    try {
      // Generate content hash for integrity verification
      const contentHash = createHash('md5').update(buffer).digest('hex');
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: options.contentType || 'application/octet-stream',
        ContentMD5: Buffer.from(contentHash, 'hex').toString('base64'),
        Metadata: {
          ...options.metadata,
          uploadedAt: new Date().toISOString(),
          originalSize: buffer.length.toString(),
        },
        ACL: options.acl || 'private',
        CacheControl: options.cacheControl || 'max-age=31536000', // 1 year cache
        ServerSideEncryption: 'AES256', // Server-side encryption
      });

      const result = await this.s3Client.send(command);
      
      return {
        key,
        url: `https://${this.bucketName}.${this.region}.vultrobjects.com/${key}`,
        etag: result.ETag || '',
        size: buffer.length,
      };
    } catch (error) {
      console.error('File upload failed:', error);
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: stream,
        ContentType: options.contentType || 'application/octet-stream',
        Metadata: {
          ...options.metadata,
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
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      console.error('Failed to generate signed URL:', error);
      throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    try {
      await this.getFileMetadata(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate a secure file key with proper structure
   */
  generateFileKey(type: 'document' | 'signature' | 'stamp' | 'certificate', 
                 sessionId: string, 
                 originalFilename: string,
                 userId?: number): string {
    const timestamp = Date.now();
    const randomId = createHash('sha256')
      .update(`${sessionId}-${timestamp}-${Math.random()}`)
      .digest('hex')
      .substring(0, 16);
    
    const extension = originalFilename.split('.').pop()?.toLowerCase() || 'bin';
    const sanitizedFilename = originalFilename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 100); // Limit filename length
    
    // Organize files by type and date for better management
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const userPrefix = userId ? `user-${userId}/` : '';
    
    return `${type}/${date}/${userPrefix}${sessionId}/${randomId}_${sanitizedFilename}`;
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

// Enhanced file upload handler using cloud storage
export async function handleCloudFileUpload(
  buffer: Buffer,
  originalFilename: string,
  uploadType: 'document' | 'signature' | 'stamp' | 'certificate',
  sessionId: string,
  userId?: number,
  metadata?: Record<string, string>
): Promise<{
  key: string;
  url: string;
  signedUrl: string;
  size: number;
}> {
  try {
    // Generate secure file key
    const fileKey = cloudStorage.generateFileKey(uploadType, sessionId, originalFilename, userId);
    
    // Determine content type
    const extension = originalFilename.split('.').pop()?.toLowerCase();
    const contentTypeMap: Record<string, string> = {
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    
    const contentType = contentTypeMap[extension || ''] || 'application/octet-stream';
    
    // Upload to cloud storage
    const uploadResult = await cloudStorage.uploadFile(buffer, fileKey, {
      contentType,
      metadata: {
        originalFilename,
        uploadType,
        sessionId,
        userId: userId?.toString() || '',
        ...metadata,
      },
      acl: 'private', // All files are private by default
    });
    
    // Generate signed URL for immediate access
    const signedUrl = await cloudStorage.getSignedUrl(fileKey, 3600); // 1 hour expiry
    
    return {
      key: fileKey,
      url: uploadResult.url,
      signedUrl,
      size: uploadResult.size,
    };
  } catch (error) {
    console.error('Cloud file upload failed:', error);
    throw error;
  }
} 