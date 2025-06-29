/**
 * File Storage Migration Strategy - Local to Vultr Object Storage
 * 
 * This provides a gradual transition approach with minimal breaking changes
 */

import { cloudStorage } from './cloud-storage-service';
import { optimizedStorage } from './optimized-storage-strategy';
import fs from 'fs/promises';
import path from 'path';

/**
 * PHASE 1: Hybrid Mode - New uploads go to Vultr, old files stay local
 * This allows you to transition gradually without breaking existing functionality
 */

export class FileStorageMigration {
  private isVultrEnabled: boolean;

  constructor() {
    // Enable Vultr when environment variables are set
    this.isVultrEnabled = !!(
      process.env.VULTR_ACCESS_KEY && 
      process.env.VULTR_SECRET_KEY
    );
  }

  /**
   * STEP 1: Update your upload handlers to use Vultr for new files
   * Old code stays working, new files go to Vultr
   */
  async handleFileUpload(
    fileBuffer: Buffer,
    originalFilename: string,
    sessionId: string,
    userId?: number,
    uploadType: 'document' | 'signature' | 'stamp' = 'document'
  ): Promise<{
    fileUrl: string;
    fileKey: string;
    storageType: 'local' | 'vultr';
    filePath?: string; // For backward compatibility
  }> {
    
    if (this.isVultrEnabled) {
      // NEW: Upload to Vultr Object Storage
      const vultrResult = await cloudStorage.uploadFile(
        fileBuffer,
        cloudStorage.generateFileKey(uploadType, sessionId, originalFilename, userId),
        {
          contentType: this.getContentType(originalFilename),
          metadata: {
            originalFilename,
            sessionId,
            userId: userId?.toString() || '',
            uploadedAt: new Date().toISOString(),
          }
        }
      );

      return {
        fileUrl: vultrResult.url,
        fileKey: vultrResult.key,
        storageType: 'vultr',
        // For backward compatibility with existing database structure
        filePath: vultrResult.key, 
      };
    } else {
      // FALLBACK: Use existing local storage (your current code)
      return this.handleLocalUpload(fileBuffer, originalFilename, sessionId, uploadType);
    }
  }

  /**
   * STEP 2: Update file access to work with both local and Vultr files
   * This handles existing local files AND new Vultr files
   */
  async getFileUrl(filePath: string, expiresInHours: number = 24): Promise<{
    url: string;
    storageType: 'local' | 'vultr';
    needsMigration: boolean;
  }> {
    
    // Check if this is a Vultr object key (starts with upload type)
    if (this.isVultrKey(filePath)) {
      // This is a Vultr file - get optimized URL
      const fileAccess = await optimizedStorage.getOptimizedFileUrl(filePath, expiresInHours);
      
      return {
        url: fileAccess.cdnUrl || fileAccess.signedUrl,
        storageType: 'vultr',
        needsMigration: false,
      };
    } else {
      // This is a local file - return local URL
      const localUrl = `/api/files/local/${encodeURIComponent(filePath)}`;
      
      return {
        url: localUrl,
        storageType: 'local',
        needsMigration: this.isVultrEnabled, // Flag for migration
      };
    }
  }

  /**
   * STEP 3: Add endpoint to serve existing local files
   * This keeps your old files working while transitioning
   */
  async serveLocalFile(filePath: string): Promise<{
    buffer: Buffer;
    contentType: string;
    filename: string;
  } | null> {
    try {
      const fullPath = path.join(process.cwd(), 'uploads', filePath);
      const buffer = await fs.readFile(fullPath);
      const contentType = this.getContentType(filePath);
      const filename = path.basename(filePath);

      return { buffer, contentType, filename };
    } catch (error) {
      console.error('Local file not found:', filePath, error);
      return null;
    }
  }

  /**
   * STEP 4: Background migration of existing files (optional)
   * Run this to gradually move old files to Vultr
   */
  async migrateExistingFile(localFilePath: string, sessionId: string, userId?: number): Promise<{
    success: boolean;
    vultrKey?: string;
    vultrUrl?: string;
    error?: string;
  }> {
    if (!this.isVultrEnabled) {
      return { success: false, error: 'Vultr not configured' };
    }

    try {
      // Read local file
      const fullPath = path.join(process.cwd(), 'uploads', localFilePath);
      const fileBuffer = await fs.readFile(fullPath);
      const filename = path.basename(localFilePath);

      // Upload to Vultr
      const vultrResult = await cloudStorage.uploadFile(
        fileBuffer,
        cloudStorage.generateFileKey('document', sessionId, filename, userId),
        {
          contentType: this.getContentType(filename),
          metadata: {
            migratedFrom: localFilePath,
            migratedAt: new Date().toISOString(),
          }
        }
      );

      return {
        success: true,
        vultrKey: vultrResult.key,
        vultrUrl: vultrResult.url,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Migration failed',
      };
    }
  }

  // Helper methods
  private async handleLocalUpload(
    fileBuffer: Buffer,
    originalFilename: string,
    sessionId: string,
    uploadType: string
  ): Promise<{
    fileUrl: string;
    fileKey: string;
    storageType: 'local';
    filePath: string;
  }> {
    // Your existing local upload logic
    const uploadsDir = path.join(process.cwd(), 'uploads', uploadType, sessionId);
    await fs.mkdir(uploadsDir, { recursive: true });
    
    const filename = this.generateSecureFilename(originalFilename);
    const filePath = path.join(uploadsDir, filename);
    
    await fs.writeFile(filePath, fileBuffer);
    
    const relativePath = path.relative(path.join(process.cwd(), 'uploads'), filePath);
    
    return {
      fileUrl: `/api/files/local/${encodeURIComponent(relativePath)}`,
      fileKey: relativePath,
      storageType: 'local',
      filePath: relativePath,
    };
  }

  private isVultrKey(filePath: string): boolean {
    // Vultr keys start with upload type and have structured format
    return /^(document|signature|stamp)\/\d{4}-\d{2}-\d{2}\//.test(filePath);
  }

  private generateSecureFilename(originalFilename: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const extension = path.extname(originalFilename);
    const baseName = path.basename(originalFilename, extension)
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 20);
    
    return `${timestamp}_${random}_${baseName}${extension}`;
  }

  private getContentType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    
    return contentTypes[ext] || 'application/octet-stream';
  }
}

// Export singleton instance
export const fileMigration = new FileStorageMigration();

/**
 * UPDATED API ROUTES - These replace your existing upload/file routes
 */

// New upload handler (replaces your existing one)
export async function handleFileUploadRoute(req: any, res: any) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { sessionId, userId } = req.body;
    
    // This automatically chooses Vultr or local based on configuration
    const result = await fileMigration.handleFileUpload(
      req.file.buffer,
      req.file.originalname,
      sessionId,
      userId ? parseInt(userId) : undefined,
      'document'
    );

    // Update your database with the new file info
    // You can store either result.fileKey (Vultr) or result.filePath (local)
    // The migration handler will work with both
    
    res.json({
      success: true,
      fileUrl: result.fileUrl,
      fileKey: result.fileKey,
      storageType: result.storageType,
      message: `File uploaded to ${result.storageType} storage`,
    });

  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
}

// New file access handler (works with both local and Vultr files)
export async function handleFileAccessRoute(req: any, res: any) {
  try {
    const { fileKey } = req.params;
    
    // This automatically detects if it's a local file or Vultr file
    const fileAccess = await fileMigration.getFileUrl(fileKey);
    
    if (fileAccess.storageType === 'local') {
      // Serve local file directly
      const localFile = await fileMigration.serveLocalFile(fileKey);
      if (!localFile) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      res.setHeader('Content-Type', localFile.contentType);
      res.setHeader('Content-Disposition', `inline; filename="${localFile.filename}"`);
      res.send(localFile.buffer);
    } else {
      // Redirect to Vultr URL (faster, doesn't use your server bandwidth)
      res.redirect(302, fileAccess.url);
    }

  } catch (error) {
    console.error('File access error:', error);
    res.status(500).json({ error: 'File access failed' });
  }
}

// Background migration endpoint (run this to migrate old files)
export async function handleFileMigrationRoute(req: any, res: any) {
  try {
    const { filePath, sessionId, userId } = req.body;
    
    const result = await fileMigration.migrateExistingFile(filePath, sessionId, userId);
    
    if (result.success) {
      // Update your database to use the new Vultr key
      // UPDATE job_documents SET file_path = result.vultrKey WHERE file_path = filePath
      
      res.json({
        success: true,
        message: 'File migrated to Vultr',
        oldPath: filePath,
        newKey: result.vultrKey,
        newUrl: result.vultrUrl,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }

  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ error: 'Migration failed' });
  }
} 