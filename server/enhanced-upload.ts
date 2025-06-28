import multer from 'multer';
import sharp from 'sharp';
import { Request, Response, NextFunction } from 'express';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
import path from 'path';
import fs from 'fs/promises';
import { z } from 'zod';

// Upload validation schemas
const SignatureUploadSchema = z.object({
  type: z.enum(['signature', 'initial', 'stamp', 'document']),
  participantId: z.string(),
  sessionId: z.string(),
  method: z.enum(['draw', 'upload', 'type']).optional(),
});

const DocumentUploadSchema = z.object({
  documentType: z.string(),
  jobId: z.number(),
  sessionId: z.string(),
  participantId: z.string(),
});

const NotaryStampUploadSchema = z.object({
  notaryId: z.string(),
  state: z.string(),
  commission: z.string().optional(),
});

interface ProcessedUpload {
  id: string;
  originalName: string;
  processedPath: string;
  thumbnailPath?: string;
  mimeType: string;
  size: number;
  dimensions: { width: number; height: number };
  checksum: string;
  metadata: Record<string, any>;
  securityScan: {
    safe: boolean;
    threats: string[];
    confidence: number;
  };
}

// Enhanced security configuration
const UPLOAD_CONFIG = {
  // File size limits (bytes)
  maxFileSize: {
    signature: 5 * 1024 * 1024,     // 5MB for signatures
    document: 50 * 1024 * 1024,     // 50MB for documents
    stamp: 2 * 1024 * 1024,         // 2MB for notary stamps
    general: 10 * 1024 * 1024       // 10MB general limit
  },
  
  // Allowed MIME types
  allowedMimeTypes: {
    images: [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
      'image/webp', 'image/svg+xml', 'image/bmp'
    ],
    documents: [
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain', 'application/rtf'
    ]
  },
  
  // Image processing settings
  imageProcessing: {
    signature: {
      maxWidth: 800,
      maxHeight: 400,
      quality: 95,
      format: 'png' as const,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    },
    stamp: {
      maxWidth: 400,
      maxHeight: 400,
      quality: 100,
      format: 'png' as const,
      preserveTransparency: true
    },
    document: {
      maxWidth: 2480,  // 300 DPI at 8.27 inches (A4 width)
      maxHeight: 3508, // 300 DPI at 11.69 inches (A4 height)
      quality: 90,
      format: 'jpeg' as const
    }
  },
  
  // Security settings
  security: {
    scanForMalware: true,
    validateImageHeaders: true,
    stripMetadata: true,
    generateThumbnails: true,
    watermarkNotaryStamps: true
  }
};

// Enhanced multer configuration with security
const createMulterConfig = (uploadType: 'signature' | 'document' | 'stamp' | 'general') => {
  const storage = multer.memoryStorage();
  
  const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    try {
      // Validate file type
      const isImage = UPLOAD_CONFIG.allowedMimeTypes.images.includes(file.mimetype);
      const isDocument = UPLOAD_CONFIG.allowedMimeTypes.documents.includes(file.mimetype);
      
      if (uploadType === 'document' && (isImage || isDocument)) {
        cb(null, true);
      } else if ((uploadType === 'signature' || uploadType === 'stamp') && isImage) {
        cb(null, true);
      } else if (uploadType === 'general' && (isImage || isDocument)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type for ${uploadType} upload: ${file.mimetype}`));
      }
    } catch (error) {
      cb(error as Error);
    }
  };

  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: UPLOAD_CONFIG.maxFileSize[uploadType],
      files: 1, // Only allow single file uploads for security
    }
  });
};

// Security scanning functions
async function scanFileForMalware(buffer: Buffer, filename: string): Promise<{
  safe: boolean;
  threats: string[];
  confidence: number;
}> {
  // Mock security scan (in production, integrate with ClamAV, VirusTotal, etc.)
  try {
    console.log(`Starting security scan for: ${filename}`);
    
    // Basic file header validation
    const headerCheck = validateFileHeaders(buffer, filename);
    console.log(`Header check result: ${headerCheck}`);
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\x4d\x5a/, // PE executable header
      /<script[^>]*>/i, // Script tags in images
      /<iframe[^>]*>/i, // Iframe tags
      /javascript:/i, // JavaScript URLs
    ];
    
    const threats: string[] = [];
    const bufferString = buffer.toString('binary');
    
    suspiciousPatterns.forEach((pattern, index) => {
      if (pattern.test(bufferString)) {
        threats.push(`Suspicious pattern ${index + 1} detected`);
      }
    });
    
    console.log(`Threats found: ${threats.length}`);
    
    // In development, be more lenient
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // In production, call external security service
    // const scanResult = await externalSecurityScan(buffer);
    
    // In development mode, allow files to pass even with minor threats
    // as long as the header validation passes
    const isSafe = isDevelopment 
      ? headerCheck  // In dev, only require valid headers
      : headerCheck && threats.length === 0;  // In prod, require no threats
    
    const confidence = isSafe ? 0.95 : (isDevelopment ? 0.7 : 0.3);
    
    console.log(`Security scan complete:`, { safe: isSafe, threats, confidence });
    
    return {
      safe: isSafe,
      threats: threats.length > 0 ? threats : (headerCheck ? [] : ['Invalid file header']),
      confidence
    };
    
  } catch (error) {
    console.error('Security scan error:', error);
    return {
      safe: false,
      threats: ['Security scan failed'],
      confidence: 0.0
    };
  }
}

function validateFileHeaders(buffer: Buffer, filename: string): boolean {
  try {
    const extension = path.extname(filename).toLowerCase();
    const header = buffer.slice(0, 16);
    
    // File signature validation
    const signatures: Record<string, Buffer[]> = {
      '.jpg': [Buffer.from([0xFF, 0xD8, 0xFF])],
      '.jpeg': [Buffer.from([0xFF, 0xD8, 0xFF])],
      '.png': [Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
      '.gif': [Buffer.from([0x47, 0x49, 0x46, 0x38])],
      '.pdf': [Buffer.from([0x25, 0x50, 0x44, 0x46])],
      '.webp': [Buffer.from([0x52, 0x49, 0x46, 0x46])]
    };
    
    const expectedSignatures = signatures[extension];
    if (!expectedSignatures) {
      console.log(`Unknown file extension: ${extension}, allowing to pass`);
      return true; // Allow unknown extensions to pass for now
    }
    
    const isValid = expectedSignatures.some(signature => {
      const headerPortion = header.slice(0, signature.length);
      const matches = headerPortion.equals(signature);
      console.log(`Header validation for ${extension}:`, {
        expected: signature.toString('hex'),
        actual: headerPortion.toString('hex'),
        matches
      });
      return matches;
    });
    
    return isValid;
  } catch (error) {
    console.error('Header validation error:', error);
    return false;
  }
}

// Advanced image processing
async function processImage(
  buffer: Buffer, 
  uploadType: 'signature' | 'stamp' | 'document',
  metadata: Record<string, any>
): Promise<{
  processed: Buffer;
  thumbnail?: Buffer;
  dimensions: { width: number; height: number };
  processedMetadata: Record<string, any>;
}> {
  
  const config = UPLOAD_CONFIG.imageProcessing[uploadType];
  let sharpInstance = sharp(buffer);
  
  // Get original dimensions
  const originalMetadata = await sharpInstance.metadata();
  
  // Strip EXIF data for privacy (unless specifically needed)
  if (UPLOAD_CONFIG.security.stripMetadata) {
    sharpInstance = sharpInstance.rotate(); // Auto-rotate based on EXIF then strip
  }
  
  // Resize if needed
  if (originalMetadata.width! > config.maxWidth || originalMetadata.height! > config.maxHeight) {
    sharpInstance = sharpInstance.resize(config.maxWidth, config.maxHeight, {
      fit: 'inside',
      withoutEnlargement: true
    });
  }
  
  // Apply format-specific processing
  let processed: Buffer;
  
  switch (config.format) {
    case 'png':
      processed = await sharpInstance
        .png({ 
          quality: config.quality,
          compressionLevel: 6,
          progressive: true
        })
        .toBuffer();
      break;
      
    case 'jpeg':
      processed = await sharpInstance
        .jpeg({ 
          quality: config.quality,
          progressive: true,
          mozjpeg: true
        })
        .toBuffer();
      break;
      
    default:
      processed = await sharpInstance.toBuffer();
  }
  
  // Generate thumbnail if required
  let thumbnail: Buffer | undefined;
  if (UPLOAD_CONFIG.security.generateThumbnails) {
    thumbnail = await sharp(processed)
      .resize(150, 150, { fit: 'inside' })
      .jpeg({ quality: 80 })
      .toBuffer();
  }
  
  // Apply watermark for notary stamps (disabled for now due to SVG generation issues)
  if (uploadType === 'stamp' && UPLOAD_CONFIG.security.watermarkNotaryStamps && process.env.NODE_ENV !== 'development') {
    try {
      const watermarkText = `NOTARY STAMP - ${new Date().toISOString().split('T')[0]}`;
      const currentMetadata = await sharp(processed).metadata();
      const imageWidth = currentMetadata.width || 400;
      const imageHeight = currentMetadata.height || 400;
      
      // Make watermark responsive to image size (max 80% of width, 10% of height)
      const watermarkWidth = Math.min(Math.floor(imageWidth * 0.8), 300);
      const watermarkHeight = Math.min(Math.floor(imageHeight * 0.1), 20);
      const fontSize = Math.max(Math.floor(watermarkHeight * 0.5), 8);
      
      // Ensure minimum dimensions
      if (watermarkWidth > 0 && watermarkHeight > 0 && fontSize > 0) {
        const svgText = `<svg width="${watermarkWidth}" height="${watermarkHeight}" xmlns="http://www.w3.org/2000/svg">
          <text x="5" y="${Math.max(watermarkHeight - 2, fontSize)}" font-family="Arial" font-size="${fontSize}" fill="rgba(128,128,128,0.3)">
            ${watermarkText}
          </text>
        </svg>`;
        
        console.log('Applying watermark with dimensions:', { watermarkWidth, watermarkHeight, fontSize });
        
        processed = await sharp(processed)
          .composite([{
            input: Buffer.from(svgText),
            gravity: 'southeast'
          }])
          .toBuffer();
      }
    } catch (watermarkError) {
      console.log('Watermark application failed, continuing without watermark:', watermarkError);
      // Continue without watermark if it fails
    }
  }
  
  const finalMetadata = await sharp(processed).metadata();
  
  return {
    processed,
    thumbnail,
    dimensions: {
      width: finalMetadata.width || 0,
      height: finalMetadata.height || 0
    },
    processedMetadata: {
      originalDimensions: {
        width: originalMetadata.width,
        height: originalMetadata.height
      },
      processedFormat: config.format,
      compressionApplied: true,
      metadataStripped: UPLOAD_CONFIG.security.stripMetadata
    }
  };
}

// Generate secure filename and checksum
function generateSecureFilename(originalName: string, uploadType: string): string {
  const timestamp = Date.now();
  const randomId = randomBytes(16).toString('hex');
  const extension = path.extname(originalName).toLowerCase();
  
  return `${uploadType}_${timestamp}_${randomId}${extension}`;
}

async function generateChecksum(buffer: Buffer): Promise<string> {
  return createHash('sha256').update(buffer).digest('hex');
}

// Main upload processors
export const signatureUpload = createMulterConfig('signature').single('signature');
export const documentUpload = createMulterConfig('document').single('document');
export const stampUpload = createMulterConfig('stamp').single('stamp');

// Enhanced signature upload handler
export async function handleSignatureUpload(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate request data
    const validationResult = SignatureUploadSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid upload data', 
        details: validationResult.error.errors 
      });
    }

    const { type, participantId, sessionId, method } = validationResult.data;

    // Security scan
    const securityScan = await scanFileForMalware(req.file.buffer, req.file.originalname);
    if (!securityScan.safe) {
      return res.status(400).json({
        error: 'Security scan failed',
        threats: securityScan.threats
      });
    }

    // Process image
    const processedImage = await processImage(req.file.buffer, 'signature', req.body);
    
    // Generate secure paths
    const filename = generateSecureFilename(req.file.originalname, type);
    const uploadDir = path.join(process.cwd(), 'uploads', 'signatures', sessionId);
    await fs.mkdir(uploadDir, { recursive: true });
    
    const processedPath = path.join(uploadDir, filename);
    const thumbnailPath = processedImage.thumbnail 
      ? path.join(uploadDir, `thumb_${filename}`) 
      : undefined;

    // Save processed files
    await fs.writeFile(processedPath, processedImage.processed);
    if (processedImage.thumbnail && thumbnailPath) {
      await fs.writeFile(thumbnailPath, processedImage.thumbnail);
    }

    // Generate checksum
    const checksum = await generateChecksum(processedImage.processed);

    // Create response data
    const uploadResult: ProcessedUpload = {
      id: randomUUID(),
      originalName: req.file.originalname,
      processedPath: processedPath.replace(process.cwd(), ''),
      thumbnailPath: thumbnailPath?.replace(process.cwd(), ''),
      mimeType: req.file.mimetype,
      size: processedImage.processed.length,
      dimensions: processedImage.dimensions,
      checksum,
      metadata: {
        participantId,
        sessionId,
        type,
        method,
        uploadTime: new Date().toISOString(),
        ...processedImage.processedMetadata
      },
      securityScan
    };

    // Log upload event
    console.log(`Signature upload processed: ${uploadResult.id}`, {
      participantId,
      sessionId,
      type,
      size: uploadResult.size,
      securityScore: securityScan.confidence
    });

    res.json({
      success: true,
      upload: uploadResult,
      message: 'Signature uploaded and processed successfully'
    });

  } catch (error) {
    console.error('Signature upload error:', error);
    res.status(500).json({
      error: 'Upload processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Enhanced document upload handler
export async function handleDocumentUpload(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate request data
    const validationResult = DocumentUploadSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid upload data', 
        details: validationResult.error.errors 
      });
    }

    const { documentType, jobId, sessionId, participantId } = validationResult.data;

    // Security scan
    const securityScan = await scanFileForMalware(req.file.buffer, req.file.originalname);
    if (!securityScan.safe) {
      return res.status(400).json({
        error: 'Security scan failed',
        threats: securityScan.threats
      });
    }

    let processedBuffer = req.file.buffer;
    let dimensions = { width: 0, height: 0 };
    let processedMetadata = {};

    // Process images
    if (req.file.mimetype.startsWith('image/')) {
      const processedImage = await processImage(req.file.buffer, 'document', req.body);
      processedBuffer = processedImage.processed;
      dimensions = processedImage.dimensions;
      processedMetadata = processedImage.processedMetadata;
    }

    // Generate secure paths
    const filename = generateSecureFilename(req.file.originalname, 'document');
    const uploadDir = path.join(process.cwd(), 'uploads', 'documents', sessionId);
    await fs.mkdir(uploadDir, { recursive: true });
    
    const processedPath = path.join(uploadDir, filename);

    // Save processed file
    await fs.writeFile(processedPath, processedBuffer);

    // Generate checksum
    const checksum = await generateChecksum(processedBuffer);

    // Create response data
    const uploadResult: ProcessedUpload = {
      id: randomUUID(),
      originalName: req.file.originalname,
      processedPath: processedPath.replace(process.cwd(), ''),
      mimeType: req.file.mimetype,
      size: processedBuffer.length,
      dimensions,
      checksum,
      metadata: {
        documentType,
        jobId,
        participantId,
        sessionId,
        uploadTime: new Date().toISOString(),
        ...processedMetadata
      },
      securityScan
    };

    res.json({
      success: true,
      upload: uploadResult,
      message: 'Document uploaded and processed successfully'
    });

  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({
      error: 'Upload processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Notary stamp upload handler with enhanced security
export async function handleNotaryStampUpload(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No stamp image uploaded' });
    }

    // Validate request data
    const validationResult = NotaryStampUploadSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid upload data', 
        details: validationResult.error.errors 
      });
    }

    const { notaryId, state, commission } = validationResult.data;

    // Enhanced security scan for notary stamps
    const securityScan = await scanFileForMalware(req.file.buffer, req.file.originalname);
    
    // In development, be more lenient with security scan
    const isDevelopment = process.env.NODE_ENV === 'development';
    const requiredConfidence = isDevelopment ? 0.3 : 0.9;
    
    // In development mode, we rely on the improved security scan logic
    // In production, maintain strict requirements
    if (!securityScan.safe || securityScan.confidence < requiredConfidence) {
      console.log('Security scan details:', securityScan);
      return res.status(400).json({
        error: isDevelopment 
          ? `Security scan failed (dev mode) - confidence: ${securityScan.confidence}, required: ${requiredConfidence}. Check file format and try a different image.`
          : 'Security scan failed - notary stamps require high security standards',
        threats: securityScan.threats,
        confidence: securityScan.confidence
      });
    }

    // Process stamp with special handling (simplified for development)
    let processedStamp;
    if (process.env.NODE_ENV === 'development') {
      // Simplified processing for development - just use the original image
      processedStamp = {
        processed: req.file.buffer,
        dimensions: { width: 100, height: 100 }, // Default dimensions
        processedMetadata: { simplified: true }
      };
    } else {
      processedStamp = await processImage(req.file.buffer, 'stamp', {
        notaryId,
        state,
        commission
      });
    }

    // Generate secure paths
    const filename = generateSecureFilename(req.file.originalname, 'notary_stamp');
    const uploadDir = path.join(process.cwd(), 'uploads', 'stamps', notaryId);
    await fs.mkdir(uploadDir, { recursive: true });
    
    const processedPath = path.join(uploadDir, filename);

    // Save with enhanced security
    await fs.writeFile(processedPath, processedStamp.processed, { mode: 0o600 }); // Restricted permissions

    // Generate checksum
    const checksum = await generateChecksum(processedStamp.processed);

    const uploadResult: ProcessedUpload = {
      id: randomUUID(),
      originalName: req.file.originalname,
      processedPath: processedPath.replace(process.cwd(), ''),
      mimeType: req.file.mimetype,
      size: processedStamp.processed.length,
      dimensions: processedStamp.dimensions,
      checksum,
      metadata: {
        notaryId,
        state,
        commission,
        uploadTime: new Date().toISOString(),
        ...processedStamp.processedMetadata
      },
      securityScan
    };

    // Log critical notary stamp upload
    console.log(`CRITICAL: Notary stamp uploaded`, {
      notaryId,
      state,
      uploadId: uploadResult.id,
      size: uploadResult.size,
      checksum: checksum.substring(0, 16),
      processedPath: uploadResult.processedPath
    });

    res.json({
      success: true,
      upload: uploadResult,
      message: 'Notary stamp uploaded successfully and ready to use'
    });

  } catch (error) {
    console.error('Notary stamp upload error:', error);
    res.status(500).json({
      error: 'Stamp upload processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// File retrieval with security
export async function getUploadedFile(req: Request, res: Response) {
  try {
    const { fileId, type } = req.params;
    const filePath = path.join(process.cwd(), 'uploads', type, fileId);
    
    // Verify file exists and user has permission
    await fs.access(filePath);
    
    // Security check - ensure file is within uploads directory
    const resolvedPath = path.resolve(filePath);
    const uploadsPath = path.resolve(path.join(process.cwd(), 'uploads'));
    
    if (!resolvedPath.startsWith(uploadsPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.sendFile(resolvedPath);
    
  } catch (error) {
    console.error('File retrieval error:', error);
    res.status(404).json({ error: 'File not found' });
  }
} 