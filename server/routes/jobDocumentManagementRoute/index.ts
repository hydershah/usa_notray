import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "../../storage";
import { db } from "../../db";

import { verifyToken, type AuthUser } from "../../auth";

import { and, desc, eq } from 'drizzle-orm'; 
interface AuthenticatedRequest extends Express.Request {
  user: AuthUser;
}
import jwt from "jsonwebtoken";
import multer from "multer";
import fs from "fs";

import { 

  documentVersions,
} from "@shared/schema";


import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fetch from 'node-fetch';

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";



const upload = multer({
  storage: multer.memoryStorage(), // Use memory storage for direct cloud uploads
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for cloud storage
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'text/plain',
      'video/mp4',
      'video/webm',
      'video/mov',
      'audio/wav',
      'audio/mp3'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Please upload PDF, DOC, DOCX, images, videos, or audio files only.'));
    }
  }
});




export async function jonDocumentManagementRoutes(app: Express): Promise<Server> {


  app.get('/api/jobs/:id/documents', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      if (req.user.role !== 'admin' && job.userId !== req.user.id && job.selectedNotary !== req.user.id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const documents = await storage.getJobDocumentsByJobId(jobId);
      res.json(documents);
    } catch (error) {
      console.error('Get job documents error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/jobs/:id/document-versions', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      if (req.user.role !== 'admin' && job.userId !== req.user.id && job.selectedNotary !== req.user.id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const versions = await db
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.originalDocumentId, jobId))
        .orderBy(desc(documentVersions.createdAt));

      // Add download URLs to each version
      const versionsWithUrls = versions.map(version => ({
        ...version,
        downloadUrl: `/api/documents/signed/${encodeURIComponent(version.fileName)}`
      }));

      res.json(versionsWithUrls);
    } catch (error) {
      console.error('Get document versions error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/jobs/:id/documents', verifyToken, upload.array('documents', 10), async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }
      if (req.user.role !== 'admin' && job.userId !== req.user.id && job.selectedNotary !== req.user.id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const addedDocuments = [];

      if (req.files && req.files.length > 0) {
        const { VultrUploadHandler } = await import('../../vultr-upload-handler');
        
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          const metadataKey = `documentMetadata_${i}`;
          let metadata = { isRequired: false, documentType: 'additional', originalName: file.originalname };
          
          if (req.body[metadataKey]) {
            try {
              metadata = { ...metadata, ...JSON.parse(req.body[metadataKey]) };
            } catch (e) {
              console.warn('Failed to parse document metadata:', e);
            }
          }
          try {
            const fileBuffer = Buffer.from(file.buffer || await fs.promises.readFile(file.path));
            
            const uploadResult = await VultrUploadHandler.handleJobDocumentUpload(
              fileBuffer,
              file.originalname,
              jobId,
              req.user.id,
              {
                ...metadata,
                userRole: req.user.role,
                jobId: jobId
              }
            );

            if (uploadResult.success) {
              const documents = await storage.getJobDocumentsByJobId(jobId);
              const latestDocument = documents[documents.length - 1]; 
              addedDocuments.push(latestDocument);
              
              console.log(`✅ Document uploaded to Vultr: ${file.originalname} → ${uploadResult.fileKey}`);
            } else {
              throw new Error(uploadResult.error || 'Upload failed');
            }
            
          } catch (vultrError) {
            console.error(`Vultr upload failed for ${file.originalname}:`, vultrError);
            return res.status(500).json({ 
              message: `Failed to upload document: ${vultrError instanceof Error ? vultrError.message : 'Unknown error'}`,
              error: 'vultr_upload_failed',
              fileName: file.originalname
            });
          }
        }
      }

      try {
        const { redisCache } = await import('../../services/redis-cache');
        await redisCache.delPattern(`job:${jobId}:*`);
        console.log(`🧹 Cleared job cache after document upload: job:${jobId}:*`);
      } catch (cacheError) {
        console.warn('Failed to clear job cache after document upload:', cacheError);
      }

      res.status(201).json({
        message: `Added ${addedDocuments.length} document${addedDocuments.length !== 1 ? 's' : ''} to job`,
        documents: addedDocuments,
        vultrOrganized: true 
      });
    } catch (error) {
      console.error('Add job documents error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/jobs/:jobId/documents/:documentId', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const documentId = parseInt(req.params.documentId);

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      const document = await storage.getJobDocument(documentId);
      if (!document || document.jobId !== jobId) {
        return res.status(404).json({ message: 'Document not found' });
      }
      if (req.user.role !== 'admin' && job.userId !== req.user.id && document.uploadedBy !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      const filePath = document.filePath;
      
      try {
        const { cloudStorage } = await import('../../lib/cloud-storage-service');
        const fileExists = await cloudStorage.fileExists(filePath);
        if (fileExists) {
          await cloudStorage.deleteFile(filePath);
          console.log(`✅ Deleted document from Vultr: ${filePath}`);
        }
      } catch (vultrError) {
        console.error(`❌ Failed to delete document from Vultr: ${filePath}`, vultrError);
      }
      const deleted = await storage.deleteJobDocument(documentId);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Document not found' });
      }

      try {
        const { redisCache } = await import('../../services/redis-cache');
        await redisCache.delPattern(`job:${jobId}:*`);
        console.log(`🧹 Cleared job cache after document deletion: job:${jobId}:*`);
      } catch (cacheError) {
        console.warn('Failed to clear job cache after document deletion:', cacheError);
      }

      res.json({ message: 'Document deleted successfully' });
    } catch (error) {
      console.error('Delete job document error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/jobs/:jobId/documents/:documentId', verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const documentId = parseInt(req.params.documentId);

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }
      const document = await storage.getJobDocument(documentId);
      if (!document || document.jobId !== jobId) {
        return res.status(404).json({ message: 'Document not found' });
      }

      if (req.user.role !== 'admin' && job.userId !== req.user.id && job.selectedNotary !== req.user.id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const updatedDocument = await storage.updateJobDocument(documentId, req.body);
      
      if (!updatedDocument) {
        return res.status(404).json({ message: 'Document not found' });
      }

      res.json(updatedDocument);
    } catch (error) {
      console.error('Update job document error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/jobs/:jobId/documents/:documentId/download', async (req: any, res) => {
    try {
      let token = req.headers.authorization?.split(' ')[1];
      if (!token && req.query.token) {
        token = req.query.token as string;
      }
      
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }

      let user;
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        user = decoded;
      } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      const jobId = parseInt(req.params.jobId);
      const documentId = parseInt(req.params.documentId);

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      const document = await storage.getJobDocument(documentId);
      if (!document || document.jobId !== jobId) {
        return res.status(404).json({ message: 'Document not found' });
      }

      if (user.role !== 'admin' && job.userId !== user.id && job.selectedNotary !== user.id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const filePath = document.filePath;
      
      try {
        const { cloudStorage } = await import('../../lib/cloud-storage-service');
        
        const fileExists = await cloudStorage.fileExists(filePath);
        if (!fileExists) {
          return res.status(404).json({ message: 'File not found in cloud storage' });
        }
        const signedUrl = await cloudStorage.getSignedUrl(filePath, 3600);
        const isSigned = req.query.signed === 'true';
        const timestamp = req.query.timestamp;
         const filename = isSigned 
          ? `SIGNED_${timestamp}_${document.originalName}` 
          : document.originalName;
          
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        if (isSigned) {
          res.setHeader('X-Document-Status', 'signed');
          res.setHeader('X-Signing-Timestamp', timestamp || new Date().toISOString());
          console.log(`Serving signed PDF from Vultr: ${filename}`);
        }
        
        console.log(`Redirecting to Vultr download: ${document.originalName}`);
        res.redirect(302, signedUrl);
        
      } catch (vultrError) {
        console.error('Vultr download error:', vultrError);
        return res.status(500).json({ message: 'Failed to access file in cloud storage' });
      }
    } catch (error) {
      console.error('Download document error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/jobs/:jobId/documents/:documentId/sign', verifyToken, async (req: any, res) => {
    res.setHeader('Content-Type', 'application/json');
    
    try {
      console.log('Sign endpoint called:', {
        jobId: req.params.jobId,
        documentId: req.params.documentId,
        userId: req.user.id,
        bodyKeys: Object.keys(req.body || {})
      });

      const jobId = parseInt(req.params.jobId);
      const documentId = parseInt(req.params.documentId);
      
      if (isNaN(jobId) || isNaN(documentId)) {
        console.log('Invalid job or document ID:', { jobId, documentId });
        return res.status(400).json({ message: 'Invalid job or document ID' });
      }
      
      const { signatures = [], page = 1, scale = 1.0 } = req.body || {};
      
      console.log('Sign request details:', {
        jobId,
        documentId,
        signaturesCount: signatures.length,
        page,
        scale
      });

      const job = await storage.getJob(jobId);
      if (!job) {
        console.log('Job not found:', jobId);
        return res.status(404).json({ message: 'Job not found' });
      }

      const document = await storage.getJobDocument(documentId);
      if (!document || document.jobId !== jobId) {
        console.log('Document not found or mismatch:', { documentId, jobId, found: !!document });
        return res.status(404).json({ message: 'Document not found' });
      }

      if (req.user.role !== 'admin' && job.userId !== req.user.id && job.selectedNotary !== req.user.id.toString()) {
        console.log('Access denied for user:', req.user.id);
        return res.status(403).json({ message: 'Access denied' });
      }

      try {
        let pdfBytes: Buffer;
        
        const filePath = document.filePath;
        
        const { cloudStorage } = await import('../../lib/cloud-storage-service');
        
        const fileExists = await cloudStorage.fileExists(filePath);
        if (!fileExists) {
          return res.status(404).json({ message: 'PDF file not found in cloud storage' });
        }
        const signedUrl = await cloudStorage.getSignedUrl(filePath, 300); // 5 minutes for processing
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for PDF processing
        
        const response = await fetch(signedUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'USA-Notary-Service/1.0'
          }
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Failed to download PDF from Vultr: ${response.status} ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        pdfBytes = Buffer.from(arrayBuffer);
        console.log(`Downloaded PDF from Vultr for signing: ${document.originalName}`);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const signatureFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

        for (const sig of signatures) {
          const pageIndex = (sig.page || 1) - 1;
          if (pageIndex < 0 || pageIndex >= pages.length) {
            console.warn(`Invalid page number ${sig.page} for signature. Skipping.`);
            continue;
          }

          const page = pages[pageIndex];
          const pageDimensions = page.getSize();
          
          const clientWidth = sig.clientWidth || pageDimensions.width;
          const clientHeight = sig.clientHeight || pageDimensions.height;

          const widthScale = pageDimensions.width / clientWidth;
          const heightScale = pageDimensions.height / clientHeight;

          const x = sig.x * widthScale;
          const y = pageDimensions.height - (sig.y * heightScale);
          const signatureWidth = sig.width * widthScale;
          const signatureHeight = sig.height * heightScale;
          
          const finalY = y - signatureHeight;

          try {
            if (sig.type === 'signature' || sig.type === 'initial' || sig.type === 'stamp') {
              if (sig.signatureImage) {
                const base64Data = sig.signatureImage.split(',')[1];
                if (base64Data) {
                  const imageBytes = Buffer.from(base64Data, 'base64');
                  
                  let image;
                  try {
                    if (sig.signatureImage.startsWith('data:image/jpeg') || sig.signatureImage.startsWith('data:image/jpg')) {
                      image = await pdfDoc.embedJpg(imageBytes);
                    } else {
                      image = await pdfDoc.embedPng(imageBytes);
                    }
                    
                    page.drawImage(image, {
                      x,
                      y: finalY,
                      width: signatureWidth,
                      height: signatureHeight,
                    });

                  } catch (embedError) {
                    console.error('Failed to embed image:', embedError);
                  }
                }
              }
            } else if (sig.type === 'checkbox') {
              const checkmarkSize = Math.min(signatureWidth, signatureHeight) * 0.8;
              const xPos = x + (signatureWidth / 2);
              const yPos = finalY + (signatureHeight / 2);
              
              const p1 = { x: xPos - checkmarkSize / 2, y: yPos };
              const p2 = { x: xPos - checkmarkSize / 4, y: yPos - checkmarkSize / 2 };
              const p3 = { x: xPos + checkmarkSize / 2, y: yPos + checkmarkSize / 2 };

              page.drawLine({
                start: p1,
                end: p2,
                thickness: 2,
                color: rgb(0, 0, 0),
              });
              page.drawLine({
                start: p2,
                end: p3,
                thickness: 2,
                color: rgb(0, 0, 0),
              });
            } else if (sig.content) {
              page.drawText(sig.content, {
                x,
                y: finalY,
                font: helveticaFont,
                size: 12, // Or a dynamic size
                color: rgb(0, 0, 0),
              });
            }
          } catch (err) {
            console.error(`Failed to draw signature (ID: ${sig.id}, Type: ${sig.type}):`, err);
            // Continue to next signature
          }
        }

        const signedPdfBytes = await pdfDoc.save();

        console.log(`Successfully generated signed PDF for document ${documentId}`);
        const filename = `SIGNED_${Date.now()}_${document.originalName}`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/pdf');
        res.send(Buffer.from(signedPdfBytes));

      } catch (pdfError) {
        console.error('Error during PDF signing process:', pdfError);
        res.status(500).json({
            success: false,
            message: 'Failed to generate signed PDF.',
            error: pdfError instanceof Error ? pdfError.message : String(pdfError),
        });
      }
    } catch (error) {
      console.error('Sign document error:', error);
      
      const errorResponse = {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      };
      
      res.status(500).json(errorResponse);
    }
  });

  app.get('/api/jobs/:jobId/documents/:documentId/preview', async (req: any, res) => {
    try {
      let token = req.headers.authorization?.split(' ')[1];
      if (!token && req.query.token) {
        token = req.query.token as string;
      }
      
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }

      let user;
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        user = decoded;
      } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      const jobId = parseInt(req.params.jobId);
      const documentId = parseInt(req.params.documentId);

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      const document = await storage.getJobDocument(documentId);
      if (!document || document.jobId !== jobId) {
        return res.status(404).json({ message: 'Document not found' });
      }

      if (user.role !== 'admin' && job.userId !== user.id && job.selectedNotary !== user.id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
      const filePath = document.filePath;
      
      try {
        const { cloudStorage } = await import('../../lib/cloud-storage-service');
        
        const fileExists = await cloudStorage.fileExists(filePath);
        if (!fileExists) {
          return res.status(404).json({ message: 'File not found in cloud storage' });
        }
        
        const signedUrl = await cloudStorage.getSignedUrl(filePath, 3600);
        
        res.setHeader('Content-Type', document.mimeType);
        res.setHeader('Cache-Control', 'private, max-age=300'); // 5 minute cache
        
        console.log(`Redirecting to Vultr preview: ${document.originalName}`);
        res.redirect(302, signedUrl);
        
      } catch (vultrError) {
        console.error('Vultr preview error:', vultrError);
        return res.status(500).json({ message: 'Failed to access file in cloud storage' });
      }
    } catch (error) {
      console.error('Preview document error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

}