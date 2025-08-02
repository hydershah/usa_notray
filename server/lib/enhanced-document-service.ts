import { cloudStorage } from './cloud-storage-service';
import fs from 'fs/promises';
import path from 'path';

interface DocumentAccessResult {
  success: boolean;
  buffer?: Buffer;
  url?: string;
  contentType?: string;
  error?: string;
  source: 'vultr' | 'local' | 'not_found';
}

export class EnhancedDocumentService {
  
  /**
   * Get document from Vultr or local storage with intelligent fallback
   */
  static async getDocument(filePath: string): Promise<DocumentAccessResult> {
    console.log(`📄 Enhanced document service: ${filePath}`);
    
    // Try Vultr first
    const vultrResult = await this.tryVultrAccess(filePath);
    if (vultrResult.success) {
      return vultrResult;
    }
    
    // Fallback to local storage
    const localResult = await this.tryLocalAccess(filePath);
    if (localResult.success) {
      return localResult;
    }
    
    // Document not found in either location
    return {
      success: false,
      error: 'Document not found in Vultr or local storage',
      source: 'not_found'
    };
  }
  
  /**
   * Try to access document from Vultr storage
   */
  private static async tryVultrAccess(filePath: string): Promise<DocumentAccessResult> {
    try {
      console.log('☁️ Attempting Vultr access...');
      
      // Check if Vultr is configured
      const bucketStats = await cloudStorage.getBucketStats();
      if (!bucketStats.isAccessible) {
        console.log('⚠️ Vultr not accessible, skipping...');
        return {
          success: false,
          error: 'Vultr storage not accessible',
          source: 'not_found'
        };
      }
      
      // Check if file exists in Vultr
      const fileExists = await cloudStorage.fileExists(filePath);
      if (!fileExists) {
        console.log('📄 File not found in Vultr');
        return {
          success: false,
          error: 'File not found in Vultr storage',
          source: 'not_found'
        };
      }
      
      // Generate signed URL
      const signedUrl = await cloudStorage.getSignedUrl(filePath, 3600);
      console.log('🔗 Generated Vultr signed URL');
      
      // Fetch the document content
      const response = await fetch(signedUrl, {
        headers: {
          'User-Agent': 'USA-Notary-Service/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Vultr fetch failed: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      console.log(`✅ Successfully retrieved document from Vultr: ${buffer.length} bytes`);
      
      return {
        success: true,
        buffer,
        url: signedUrl,
        contentType: this.getContentType(filePath),
        source: 'vultr'
      };
      
    } catch (error) {
      console.error('❌ Vultr access failed:', error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Vultr access failed',
        source: 'not_found'
      };
    }
  }
  
  /**
   * Try to access document from local storage
   */
  private static async tryLocalAccess(filePath: string): Promise<DocumentAccessResult> {
    try {
      console.log('📁 Attempting local access...');
      
      // Try different possible local paths
      const possiblePaths = [
        path.resolve('uploads', filePath),
        path.resolve('uploads', 'documents', filePath),
        path.resolve(filePath.startsWith('/') ? filePath.substring(1) : filePath),
        path.resolve(filePath)
      ];
      
      let localFilePath = null;
      
      for (const possiblePath of possiblePaths) {
        try {
          const stats = await fs.stat(possiblePath);
          if (stats.isFile()) {
            localFilePath = possiblePath;
            console.log(`📁 Found local file at: ${localFilePath}`);
            break;
          }
        } catch (e) {
          // File doesn't exist at this path, continue checking
        }
      }
      
      if (!localFilePath) {
        console.log('📄 File not found in local storage');
        return {
          success: false,
          error: 'File not found in local storage',
          source: 'not_found'
        };
      }
      
      // Read the file
      const buffer = await fs.readFile(localFilePath);
      console.log(`✅ Successfully read local file: ${buffer.length} bytes`);
      
      return {
        success: true,
        buffer,
        contentType: this.getContentType(filePath),
        source: 'local'
      };
      
    } catch (error) {
      console.error('❌ Local access failed:', error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Local access failed',
        source: 'not_found'
      };
    }
  }
  
  /**
   * Get content type based on file extension
   */
  private static getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.pdf':
        return 'application/pdf';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.doc':
        return 'application/msword';
      case '.docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      default:
        return 'application/octet-stream';
    }
  }
  
  /**
   * Upload document to Vultr with local fallback
   */
  static async uploadDocument(
    buffer: Buffer,
    originalFilename: string,
    sessionId: string,
    metadata: any = {}
  ): Promise<{
    success: boolean;
    fileKey?: string;
    fileUrl?: string;
    error?: string;
    storageType: 'vultr' | 'local';
  }> {
    try {
      console.log(`📤 Uploading document: ${originalFilename}`);
      
      // Try Vultr upload first
      const vultrResult = await this.tryVultrUpload(buffer, originalFilename, sessionId, metadata);
      if (vultrResult.success) {
        return vultrResult;
      }
      
      // Fallback to local storage
      const localResult = await this.tryLocalUpload(buffer, originalFilename, sessionId);
      return localResult;
      
    } catch (error) {
      console.error('❌ Document upload failed:', error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
        storageType: 'local'
      };
    }
  }
  
  /**
   * Try to upload document to Vultr
   */
  private static async tryVultrUpload(
    buffer: Buffer,
    originalFilename: string,
    sessionId: string,
    metadata: any
  ): Promise<{
    success: boolean;
    fileKey?: string;
    fileUrl?: string;
    error?: string;
    storageType: 'vultr' | 'local';
  }> {
    try {
      // Check if Vultr is accessible
      const bucketStats = await cloudStorage.getBucketStats();
      if (!bucketStats.isAccessible) {
        throw new Error('Vultr storage not accessible');
      }
      
      // Generate file key
      const fileKey = await cloudStorage.generateFileKey('document', sessionId, originalFilename);
      
      // Upload to Vultr
      const uploadResult = await cloudStorage.uploadFile(buffer, fileKey, {
        contentType: this.getContentType(originalFilename),
        metadata: {
          originalFilename,
          sessionId,
          uploadedAt: new Date().toISOString(),
          ...metadata
        }
      });
      
      console.log(`✅ Successfully uploaded to Vultr: ${fileKey}`);
      
      return {
        success: true,
        fileKey,
        fileUrl: uploadResult.url,
        storageType: 'vultr'
      };
      
    } catch (error) {
      console.error('❌ Vultr upload failed:', error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Vultr upload failed',
        storageType: 'local'
      };
    }
  }
  
  /**
   * Upload document to local storage
   */
  private static async tryLocalUpload(
    buffer: Buffer,
    originalFilename: string,
    sessionId: string
  ): Promise<{
    success: boolean;
    fileKey?: string;
    fileUrl?: string;
    error?: string;
    storageType: 'vultr' | 'local';
  }> {
    try {
      // Ensure uploads directory exists
      const uploadsDir = path.resolve('uploads');
      await fs.mkdir(uploadsDir, { recursive: true });
      
      // Generate local file path
      const timestamp = Date.now();
      const sanitizedFilename = originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const localFilename = `${sessionId}-${timestamp}-${sanitizedFilename}`;
      const localPath = path.join(uploadsDir, localFilename);
      
      // Write file to local storage
      await fs.writeFile(localPath, buffer);
      
      console.log(`✅ Successfully saved to local storage: ${localFilename}`);
      
      return {
        success: true,
        fileKey: localPath,
        fileUrl: `/uploads/${localFilename}`,
        storageType: 'local'
      };
      
    } catch (error) {
      console.error('❌ Local upload failed:', error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Local upload failed',
        storageType: 'local'
      };
    }
  }
} 