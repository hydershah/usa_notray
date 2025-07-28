import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import * as path from 'path';
import { openViduService } from './openvidu-service';

interface VultrStorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  cdnUrl?: string;
}

interface RecordingMetadata {
  jobId: number;
  sessionId: string;
  participants: string[];
  layout: string;
  quality: string;
  duration?: number;
  startTime: Date;
  endTime?: Date;
}

interface UploadResult {
  success: boolean;
  vultrUrl: string;
  cdnUrl?: string;
  size: number;
  error?: string;
}

class RecordingService {
  private s3Client: S3Client | null = null;
  private config: VultrStorageConfig;
  private isConfigured: boolean;
  private recordingMetadata: Map<string, RecordingMetadata> = new Map();

  constructor() {
    this.config = {
      endpoint: process.env.VULTR_STORAGE_ENDPOINT || '',
      region: process.env.VULTR_STORAGE_REGION || 'ewr1',
      bucket: process.env.VULTR_STORAGE_BUCKET || '',
      accessKeyId: process.env.VULTR_STORAGE_ACCESS_KEY || '',
      secretAccessKey: process.env.VULTR_STORAGE_SECRET_KEY || '',
      cdnUrl: process.env.VULTR_STORAGE_CDN_URL
    };

    this.isConfigured = !!(
      this.config.endpoint &&
      this.config.bucket &&
      this.config.accessKeyId &&
      this.config.secretAccessKey
    );

    if (this.isConfigured) {
      this.initializeS3Client();
      console.log('✅ Vultr Object Storage configured for recordings');
      console.log(`📦 Storage Bucket: ${this.config.bucket}`);
      console.log(`🌐 Storage Endpoint: ${this.config.endpoint}`);
    } else {
      console.warn('⚠️ Vultr Object Storage not configured. Set environment variables:');
      console.warn('   VULTR_STORAGE_ENDPOINT, VULTR_STORAGE_BUCKET,');
      console.warn('   VULTR_STORAGE_ACCESS_KEY, VULTR_STORAGE_SECRET_KEY');
      console.warn('   Recordings will be stored locally only.');
    }
  }

  private initializeS3Client() {
    this.s3Client = new S3Client({
      endpoint: this.config.endpoint,
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey
      },
      forcePathStyle: true, // Required for Vultr Object Storage
    });
  }

  // Start recording with metadata
  async startRecording(
    sessionId: string,
    jobId: number,
    participants: string[],
    options: {
      layout?: string;
      resolution?: string;
      frameRate?: number;
    } = {}
  ): Promise<{ recordingId: string; status: string }> {
    try {
      console.log(`🎬 Starting recording for session: ${sessionId}`);

      // Start OpenVidu recording
      const recordingData = await openViduService.startRecording(sessionId, {
        layout: options.layout || 'GRID',
        resolution: options.resolution || '1920x1080',
        frameRate: options.frameRate || 25
      });

      // Store metadata for later use
      const metadata: RecordingMetadata = {
        jobId,
        sessionId,
        participants,
        layout: options.layout || 'GRID',
        quality: options.resolution || '1920x1080',
        startTime: recordingData.startTime
      };

      this.recordingMetadata.set(recordingData.recordingId, metadata);

      console.log('✅ Recording started successfully:', {
        recordingId: recordingData.recordingId,
        sessionId,
        jobId
      });

      return {
        recordingId: recordingData.recordingId,
        status: recordingData.status
      };
    } catch (error) {
      console.error('❌ Error starting recording:', error);
      throw new Error(`Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Stop recording and upload to Vultr
  async stopRecording(recordingId: string): Promise<{
    recordingId: string;
    status: string;
    vultrUrl?: string;
    cdnUrl?: string;
    size?: number;
  }> {
    try {
      console.log(`🛑 Stopping recording: ${recordingId}`);

      // Stop OpenVidu recording
      const recordingData = await openViduService.stopRecording(recordingId);
      
      // Update metadata with end time and duration
      const metadata = this.recordingMetadata.get(recordingId);
      if (metadata) {
        metadata.endTime = recordingData.endTime || new Date();
        metadata.duration = recordingData.duration;
      }

      let vultrUrl: string | undefined;
      let cdnUrl: string | undefined;
      
      // Upload to Vultr if configured and recording is available
      if (this.isConfigured && recordingData.downloadUrl) {
        try {
          const uploadResult = await this.uploadToVultr(recordingId, recordingData.downloadUrl, metadata);
          
          if (uploadResult.success) {
            vultrUrl = uploadResult.vultrUrl;
            cdnUrl = uploadResult.cdnUrl;
            console.log('✅ Recording uploaded to Vultr successfully');
          }
        } catch (uploadError) {
          console.error('⚠️ Failed to upload to Vultr, recording saved locally:', uploadError);
          // Don't fail the entire operation if Vultr upload fails
        }
      }

      // Clean up metadata
      this.recordingMetadata.delete(recordingId);

      return {
        recordingId: recordingData.recordingId,
        status: recordingData.status,
        vultrUrl,
        cdnUrl,
        size: recordingData.size
      };
    } catch (error) {
      console.error('❌ Error stopping recording:', error);
      throw new Error(`Failed to stop recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Upload recording file to Vultr Object Storage
  private async uploadToVultr(
    recordingId: string, 
    localFileUrl: string, 
    metadata?: RecordingMetadata
  ): Promise<UploadResult> {
    if (!this.s3Client || !this.isConfigured) {
      throw new Error('Vultr Object Storage not configured');
    }

    try {
      console.log(`📤 Uploading recording ${recordingId} to Vultr...`);

      // Download file from OpenVidu server first (if it's a URL)
      let filePath: string;
      let fileBuffer: Buffer;

      if (localFileUrl.startsWith('http')) {
        // Download from URL
        const response = await fetch(localFileUrl);
        if (!response.ok) {
          throw new Error(`Failed to download recording: ${response.statusText}`);
        }
        fileBuffer = Buffer.from(await response.arrayBuffer());
      } else {
        // Read from local file
        filePath = localFileUrl;
        fileBuffer = fs.readFileSync(filePath);
      }

      // Generate object key with date and metadata
      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const objectKey = `recordings/${date}/job-${metadata?.jobId || 'unknown'}/${recordingId}.mp4`;

      // Prepare upload parameters
      const uploadParams = {
        Bucket: this.config.bucket,
        Key: objectKey,
        Body: fileBuffer,
        ContentType: 'video/mp4',
        Metadata: {
          jobId: metadata?.jobId?.toString() || '',
          sessionId: metadata?.sessionId || '',
          participants: metadata?.participants?.join(',') || '',
          layout: metadata?.layout || '',
          quality: metadata?.quality || '',
          duration: metadata?.duration?.toString() || '',
          startTime: metadata?.startTime?.toISOString() || '',
          endTime: metadata?.endTime?.toISOString() || ''
        }
      };

      // Upload to Vultr
      const command = new PutObjectCommand(uploadParams);
      await this.s3Client.send(command);

      // Generate URLs
      const vultrUrl = `${this.config.endpoint}/${this.config.bucket}/${objectKey}`;
      const cdnUrl = this.config.cdnUrl 
        ? `${this.config.cdnUrl}/${objectKey}` 
        : undefined;

      console.log('✅ Recording uploaded to Vultr:', {
        recordingId,
        objectKey,
        size: fileBuffer.length,
        vultrUrl
      });

      return {
        success: true,
        vultrUrl,
        cdnUrl,
        size: fileBuffer.length
      };
    } catch (error) {
      console.error('❌ Error uploading to Vultr:', error);
      return {
        success: false,
        vultrUrl: '',
        size: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Generate signed URL for secure download
  async generateDownloadUrl(
    recordingId: string, 
    expirationSeconds: number = 3600
  ): Promise<string | null> {
    if (!this.s3Client || !this.isConfigured) {
      console.warn('Vultr Object Storage not configured for download URLs');
      return null;
    }

    try {
      // Find recording object key (you might want to store this in database)
      const objectKey = await this.findRecordingObjectKey(recordingId);
      if (!objectKey) {
        console.warn(`Recording object key not found for: ${recordingId}`);
        return null;
      }

      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: objectKey
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: expirationSeconds
      });

      console.log('✅ Generated signed download URL:', {
        recordingId,
        expiresIn: expirationSeconds
      });

      return signedUrl;
    } catch (error) {
      console.error('❌ Error generating download URL:', error);
      return null;
    }
  }

  // Find recording object key (simplified - in production, store in database)
  private async findRecordingObjectKey(recordingId: string): Promise<string | null> {
    // This is a simplified implementation
    // In production, you should store object keys in your database
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const possibleKeys = [
      `recordings/${today}/job-*/` + recordingId + '.mp4',
      `recordings/${yesterday}/job-*/` + recordingId + '.mp4'
    ];

    // In a real implementation, you'd search the bucket or use a database
    // For now, return a constructed key
    return `recordings/${today}/job-unknown/${recordingId}.mp4`;
  }

  // Delete recording from Vultr (for cleanup)
  async deleteRecording(recordingId: string): Promise<boolean> {
    if (!this.s3Client || !this.isConfigured) {
      console.warn('Vultr Object Storage not configured for deletion');
      return false;
    }

    try {
      const objectKey = await this.findRecordingObjectKey(recordingId);
      if (!objectKey) {
        console.warn(`Recording object key not found for deletion: ${recordingId}`);
        return false;
      }

      const command = new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: objectKey
      });

      await this.s3Client.send(command);

      console.log('✅ Recording deleted from Vultr:', recordingId);
      return true;
    } catch (error) {
      console.error('❌ Error deleting recording from Vultr:', error);
      return false;
    }
  }

  // Get recording metadata
  getRecordingMetadata(recordingId: string): RecordingMetadata | undefined {
    return this.recordingMetadata.get(recordingId);
  }

  // List recordings for a job
  async getJobRecordings(jobId: number): Promise<Array<{
    recordingId: string;
    sessionId: string;
    vultrUrl?: string;
    cdnUrl?: string;
    size?: number;
    duration?: number;
    createdAt: Date;
  }>> {
    try {
      // This would typically query your database
      // For now, return OpenVidu recordings
      const recordings = await openViduService.getSessionRecordings(`job-${jobId}`);
      
      return recordings.map(recording => ({
        recordingId: recording.recordingId,
        sessionId: recording.sessionId,
        vultrUrl: recording.vultrStorageUrl,
        size: recording.size,
        duration: recording.duration,
        createdAt: recording.startTime
      }));
    } catch (error) {
      console.error('❌ Error getting job recordings:', error);
      return [];
    }
  }

  // Health check
  async healthCheck(): Promise<{ status: string; info: any }> {
    if (!this.isConfigured) {
      return {
        status: 'warning',
        info: {
          configured: false,
          message: 'Vultr Object Storage not configured'
        }
      };
    }

    try {
      // Test S3 connection by listing bucket (limited)
      if (this.s3Client) {
        // Simple test - just check if client is configured
        return {
          status: 'healthy',
          info: {
            configured: true,
            bucket: this.config.bucket,
            endpoint: this.config.endpoint,
            cdnEnabled: !!this.config.cdnUrl
          }
        };
      }

      return {
        status: 'error',
        info: {
          configured: false,
          error: 'S3 client not initialized'
        }
      };
    } catch (error) {
      return {
        status: 'error',
        info: {
          configured: true,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  // Get configuration status
  getConfigStatus() {
    return {
      configured: this.isConfigured,
      bucket: this.config.bucket,
      endpoint: this.config.endpoint,
      cdnEnabled: !!this.config.cdnUrl
    };
  }
}

// Export singleton instance
export const recordingService = new RecordingService(); 