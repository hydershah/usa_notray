import { Request, Response, NextFunction } from 'express';
import { cloudStorage, handleCloudFileUpload } from './lib/cloud-storage-service';
import { optimizedStorage } from './lib/optimized-storage-strategy';
import { db } from './db';
import { jobDocuments, notaryStamps } from '@shared/schema';
import fs from 'fs';
import path from 'path';

export interface VultrUploadResult {
  success: boolean;
  fileKey?: string;
  fileUrl?: string;
  signedUrl?: string;
  error?: string;
  size?: number;
}

/**
 * Enhanced upload handler for all file types using Vultr storage
 */
export class VultrUploadHandler {
  
  /**
   * Handle job document uploads to Vultr with intelligent organization
   */
  static async handleJobDocumentUpload(
    fileBuffer: Buffer,
    originalFilename: string,
    jobId: number,
    userId: number,
    metadata: any = {}
  ): Promise<VultrUploadResult> {
    try {
      // Handle temporary uploads (jobId = 0) for job requests
      const sessionId = jobId === 0 ? 
        (metadata.tempSessionId || `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`) : 
        `job-${jobId}`;
      
      // Enhanced metadata for intelligent organization
      const enhancedMetadata = {
        ...metadata,
        jobId,
        userRole: metadata.userRole || 'user', // Default to 'user' if not specified
        documentType: metadata.documentType || 'original'
      };
      
      const uploadResult = await handleCloudFileUpload(
        fileBuffer,
        originalFilename,
        'document',
        sessionId,
        userId,
        enhancedMetadata
      );

      // Only create database record if jobId is not 0 (temporary upload)
      if (jobId !== 0) {
        // Create job document record in database with Vultr key
        await db.insert(jobDocuments).values({
          jobId,
          fileName: originalFilename,
          originalName: originalFilename,
          filePath: uploadResult.key, // Store organized Vultr key
          fileSize: uploadResult.size,
          mimeType: this.getContentType(originalFilename),
          documentType: enhancedMetadata.documentType,
          status: 'uploaded',
          uploadedBy: userId,
          isRequired: metadata.isRequired || false,
          signaturePages: []
        });
      }

      console.log(`✅ Uploaded ${jobId === 0 ? 'temporary' : 'job'} document to Vultr: ${originalFilename}`);
      console.log(`📁 Organized path: ${uploadResult.organizedPath?.folder}/${uploadResult.organizedPath?.filename}`);

      return {
        success: true,
        fileKey: uploadResult.key,
        fileUrl: uploadResult.url,
        signedUrl: uploadResult.signedUrl,
        size: uploadResult.size
      };

    } catch (error) {
      console.error('Job document upload failed:', error);
      
      // FALLBACK: Save to local storage if Vultr fails
      console.warn('🔄 Vultr upload failed, falling back to local storage...');
      
      try {
        // Ensure uploads directory exists
        const uploadsDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        // Generate local file path
        const timestamp = Date.now();
        const sanitizedFilename = originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_');
        const localFilename = jobId === 0 ? 
          `temp-${timestamp}-${sanitizedFilename}` : 
          `job-${jobId}-${timestamp}-${sanitizedFilename}`;
        const localPath = path.join(uploadsDir, localFilename);
        
        // Write file to local storage
        fs.writeFileSync(localPath, fileBuffer);
        
        // Only create database record if jobId is not 0 (temporary upload)
        if (jobId !== 0) {
          // Create job document record with local path
          await db.insert(jobDocuments).values({
            jobId,
            fileName: originalFilename,
            originalName: originalFilename,
            filePath: localPath, // Store local path as fallback
            fileSize: fileBuffer.length,
            mimeType: this.getContentType(originalFilename),
            documentType: metadata.documentType || 'original',
            status: 'uploaded_local', // Mark as local fallback
            uploadedBy: userId,
            isRequired: metadata.isRequired || false,
            signaturePages: []
          });
        }
        
        console.log(`✅ Fallback: Saved ${jobId === 0 ? 'temporary' : 'job'} document locally: ${localFilename}`);
        
        return {
          success: true,
          fileKey: localPath,
          fileUrl: `/uploads/${localFilename}`, // Local URL
          signedUrl: `/uploads/${localFilename}`,
          size: fileBuffer.length
        };
        
      } catch (fallbackError) {
        console.error('❌ Local fallback also failed:', fallbackError);
        return {
          success: false,
          error: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  }

  /**
   * Handle video recording uploads to Vultr
   */
  static async handleVideoRecordingUpload(
    fileBuffer: Buffer,
    originalFilename: string,
    jobId: number,
    recordingMetadata: any = {}
  ): Promise<VultrUploadResult> {
    try {
      const sessionId = `recording-${jobId}`;
      
      const uploadResult = await handleCloudFileUpload(
        fileBuffer,
        originalFilename,
        'document', // Use 'document' type for recordings
        sessionId,
        undefined, // No specific user for recordings
        { 
          fileType: 'video_recording',
          jobId,
          ...recordingMetadata 
        }
      );

      console.log(`✅ Uploaded video recording to Vultr: ${originalFilename}`);

      return {
        success: true,
        fileKey: uploadResult.key,
        fileUrl: uploadResult.url,
        signedUrl: uploadResult.signedUrl,
        size: uploadResult.size
      };

    } catch (error) {
      console.error('Video recording upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  /**
   * Handle verification image uploads to Vultr (for ID verification process)
   * This method uploads verification images without requiring a job_id
   */
  static async handleVerificationImageUpload(
    fileBuffer: Buffer,
    originalFilename: string,
    userId: number,
    imageType: 'front' | 'back' | 'selfie',
    verificationSessionId?: string
  ): Promise<VultrUploadResult> {
    try {
      const sessionId = verificationSessionId || `verification-${userId}-${Date.now()}`;
      
      const uploadResult = await handleCloudFileUpload(
        fileBuffer,
        originalFilename,
        'document', // Use 'document' type for verification images
        sessionId,
        userId,
        { 
          fileType: 'verification_image',
          imageType,
          userId,
          verificationSessionId: sessionId,
          documentType: `id_verification_${imageType}`,
          userRole: 'verification'
        }
      );

      console.log(`✅ Uploaded ${imageType} verification image to Vultr: ${originalFilename}`);

      return {
        success: true,
        fileKey: uploadResult.key,
        fileUrl: uploadResult.url,
        signedUrl: uploadResult.signedUrl,
        size: uploadResult.size
      };

    } catch (error) {
      console.error(`${imageType} verification image upload failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  /**
   * Handle notary stamp uploads to Vultr
   */
  static async handleNotaryStampUpload(
    fileBuffer: Buffer,
    originalFilename: string,
    notaryId: number,
    stampData: any = {}
  ): Promise<VultrUploadResult> {
    try {
      const sessionId = `notary-stamp-${notaryId}`;
      
      const uploadResult = await handleCloudFileUpload(
        fileBuffer,
        originalFilename,
        'stamp',
        sessionId,
        notaryId,
        { stampType: 'notary', ...stampData }
      );

      console.log(`✅ Uploaded notary stamp to Vultr: ${originalFilename}`);

      return {
        success: true,
        fileKey: uploadResult.key,
        fileUrl: uploadResult.url,
        signedUrl: uploadResult.signedUrl,
        size: uploadResult.size
      };

    } catch (error) {
      console.error('Notary stamp upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  /**
   * Handle signature uploads to Vultr
   */
  static async handleSignatureUpload(
    fileBuffer: Buffer,
    originalFilename: string,
    sessionId: string,
    participantId: number,
    signatureType: 'signature' | 'initial' = 'signature'
  ): Promise<VultrUploadResult> {
    try {
      const uploadResult = await handleCloudFileUpload(
        fileBuffer,
        originalFilename,
        'signature',
        sessionId,
        participantId,
        { signatureType, participantId }
      );

      console.log(`✅ Uploaded ${signatureType} to Vultr: ${originalFilename}`);

      return {
        success: true,
        fileKey: uploadResult.key,
        fileUrl: uploadResult.url,
        signedUrl: uploadResult.signedUrl,
        size: uploadResult.size
      };

    } catch (error) {
      console.error('Signature upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  /**
   * Get file access URL (with caching optimization)
   */
  static async getFileUrl(
    fileKey: string, 
    expiresInHours: number = 24
  ): Promise<{
    url: string;
    cached: boolean;
  }> {
    try {
      const fileAccess = await optimizedStorage.getOptimizedFileUrl(fileKey, expiresInHours);
      
      return {
        url: fileAccess.cdnUrl || fileAccess.signedUrl,
        cached: fileAccess.cached
      };
    } catch (error) {
      console.error('Failed to get file URL:', error);
      throw error;
    }
  }

  /**
   * Delete file from Vultr storage
   */
  static async deleteFile(fileKey: string): Promise<boolean> {
    try {
      await cloudStorage.deleteFile(fileKey);
      console.log(`✅ Deleted file from Vultr: ${fileKey}`);
      return true;
    } catch (error) {
      console.error('Failed to delete file:', error);
      return false;
    }
  }

  /**
   * Generate signed URL for a specific file key
   */
  static async generateSignedUrl(fileKey: string, expiresInHours: number = 1): Promise<string | null> {
    try {
      const { cloudStorage } = await import('./lib/cloud-storage-service');
      const signedUrl = await cloudStorage.getSignedUrl(fileKey, expiresInHours * 3600);
      return signedUrl;
    } catch (error) {
      console.error('Failed to generate signed URL:', error);
      return null;
    }
  }

  /**
   * Helper method to determine content type
   */
  private static getContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'avi': 'video/avi',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    
    return contentTypes[ext || ''] || 'application/octet-stream';
  }
}

/**
 * Express middleware for handling Vultr uploads
 */
export function createVultrUploadMiddleware(uploadType: 'document' | 'signature' | 'stamp' | 'recording') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { buffer, originalname } = req.file;
      const userId = (req as any).user?.id;
      const sessionId = req.body.sessionId || `upload-${Date.now()}`;

      let result: VultrUploadResult;

      switch (uploadType) {
        case 'document':
          const jobId = req.body.jobId ? parseInt(req.body.jobId) : 0;
          result = await VultrUploadHandler.handleJobDocumentUpload(
            buffer, originalname, jobId, userId, req.body.metadata
          );
          break;

        case 'signature':
          result = await VultrUploadHandler.handleSignatureUpload(
            buffer, originalname, sessionId, userId, req.body.signatureType
          );
          break;

        case 'stamp':
          result = await VultrUploadHandler.handleNotaryStampUpload(
            buffer, originalname, userId, req.body.stampData
          );
          break;

        case 'recording':
          const recordingJobId = req.body.jobId ? parseInt(req.body.jobId) : 0;
          result = await VultrUploadHandler.handleVideoRecordingUpload(
            buffer, originalname, recordingJobId, req.body.metadata
          );
          break;

        default:
          return res.status(400).json({ error: 'Invalid upload type' });
      }

      if (result.success) {
        res.json({
          success: true,
          message: `${uploadType} uploaded successfully to Vultr`,
          fileKey: result.fileKey,
          fileUrl: result.fileUrl,
          signedUrl: result.signedUrl,
          size: result.size,
          storageType: 'vultr'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }

    } catch (error) {
      console.error('Upload middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Upload failed'
      });
    }
  };
}

export default VultrUploadHandler; 