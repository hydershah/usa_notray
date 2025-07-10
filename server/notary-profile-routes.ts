import { Express } from 'express';
import { verifyToken, hasNotaryPrivileges } from './auth';
import { cacheUserData } from './middleware/cache-middleware';
import { redisCache } from './services/redis-cache';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { storage } from './storage';
import { cloudStorage, handleCloudFileUpload } from './lib/cloud-storage-service';
import { optimizedStorage } from './lib/optimized-storage-strategy';

// Updated multer configuration for Vultr cloud storage
const upload = multer({
  storage: multer.memoryStorage(), // Use memory storage for cloud upload
  limits: {
    fileSize: 25 * 1024 * 1024, // Increased to 25MB for notary documents
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPG, JPEG, and PNG files are allowed.'));
    }
  }
});

export function registerNotaryProfileRoutes(app: Express) {
  /**
   * POST /api/notary/profile/migrate-documents
   * Migrate existing local documents to Vultr cloud storage
   */
  app.post('/api/notary/profile/migrate-documents', verifyToken, async (req: any, res) => {
    try {
      if (!hasNotaryPrivileges(req.user)) {
        return res.status(403).json({ message: 'Notary privileges required' });
      }

      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      console.log(`🔄 Starting document migration for user ${userId}`);

      const documentTypes = [
        'notaryCommissionFile',
        'eoInsuranceFile', 
        'publicCertificateFile',
        'bondFile',
        'signingAgentFile'
      ];

      const migrationResults: any = {};
      
      for (const docType of documentTypes) {
        const localPath = user[docType as keyof typeof user] as string;
        
        if (localPath && (localPath.startsWith('/uploads/') || localPath.startsWith('uploads/'))) {
          console.log(`📄 Migrating ${docType}: ${localPath}`);
          
          try {
            // Construct full local path
            const fullPath = localPath.startsWith('/') ? 
              path.join(process.cwd(), localPath.substring(1)) : 
              path.join(process.cwd(), localPath);
            
            // Check if local file exists
            if (fs.existsSync(fullPath)) {
              // Read the local file
              const fileBuffer = fs.readFileSync(fullPath);
              const fileName = path.basename(localPath);
              
              // Generate Vultr file key
              const vultrFileKey = `documents/notary-profile-${userId}/${docType}-migrated-${Date.now()}-${fileName}`;
              
              // Upload to Vultr
              const mimeType = fileName.endsWith('.pdf') ? 'application/pdf' : 
                              fileName.endsWith('.png') ? 'image/png' :
                              fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') ? 'image/jpeg' : 'application/octet-stream';
              
              await cloudStorage.uploadFile(fileBuffer, vultrFileKey, {
                contentType: mimeType,
                metadata: {
                  originalFilename: fileName,
                  documentType: docType,
                  notaryId: userId.toString(),
                  migratedFrom: localPath,
                  migratedAt: new Date().toISOString()
                }
              });
              
              // Update user record with new Vultr file key
              await storage.updateUser(userId, {
                [docType]: vultrFileKey
              });
              
              migrationResults[docType] = {
                success: true,
                oldPath: localPath,
                newKey: vultrFileKey,
                fileSize: fileBuffer.length
              };
              
              console.log(`✅ Migrated ${docType} to Vultr: ${vultrFileKey}`);
              
              // Optionally delete the local file (uncomment if you want to clean up)
              // fs.unlinkSync(fullPath);
              
            } else {
              // File reference exists but file is missing - clear the reference
              console.log(`❌ Local file not found for ${docType}: ${fullPath}, clearing reference`);
              
              await storage.updateUser(userId, {
                [docType]: null
              });
              
              migrationResults[docType] = {
                success: true,
                error: 'Local file not found - reference cleared',
                oldPath: localPath,
                action: 'cleared_missing_reference'
              };
            }
            
          } catch (error) {
            migrationResults[docType] = {
              success: false,
              error: error instanceof Error ? error.message : 'Migration failed',
              oldPath: localPath
            };
            console.error(`❌ Failed to migrate ${docType}:`, error);
          }
                 } else if (localPath) {
           // Check if it's a Vultr cloud storage key but file doesn't exist
           if (localPath.startsWith('documents/')) {
             console.log(`📄 Checking Vultr cloud file: ${localPath}`);
             try {
               const fileExists = await cloudStorage.fileExists(localPath);
               if (!fileExists) {
                 console.log(`❌ Vultr file not found for ${docType}: ${localPath}, clearing reference`);
                 
                 await storage.updateUser(userId, {
                   [docType]: null
                 });
                 
                 migrationResults[docType] = {
                   success: true,
                   error: 'Vultr file not found - reference cleared',
                   oldPath: localPath,
                   action: 'cleared_missing_vultr_reference'
                 };
               } else {
                 migrationResults[docType] = {
                   success: false,
                   error: 'File exists in Vultr cloud storage',
                   currentPath: localPath
                 };
               }
             } catch (error) {
               console.log(`❌ Error checking Vultr file for ${docType}: ${localPath}, clearing reference`);
               
               await storage.updateUser(userId, {
                 [docType]: null
               });
               
               migrationResults[docType] = {
                 success: true,
                 error: 'Vultr file check failed - reference cleared',
                 oldPath: localPath,
                 action: 'cleared_broken_vultr_reference'
               };
             }
           } else {
             // Already a Vultr key or different format
             migrationResults[docType] = {
               success: false,
               error: 'Already using cloud storage or invalid path format',
               currentPath: localPath
             };
           }
         }
      }

      const successCount = Object.values(migrationResults).filter((result: any) => result.success).length;
      
      res.json({
        message: `Document migration completed. ${successCount} documents migrated.`,
        results: migrationResults,
        migratedCount: successCount
      });

    } catch (error) {
      console.error('Document migration error:', error);
      res.status(500).json({ message: 'Failed to migrate documents' });
    }
  });

  /**
   * GET /api/notary/profile/documents/:notaryId
   * Get notary document status and information
   */
  app.get('/api/notary/profile/documents/:notaryId', verifyToken, async (req: any, res) => {
    try {
      const notaryId = parseInt(req.params.notaryId);
      
      // Check if user can access this notary's documents
      if (req.user.id !== notaryId && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const user = await storage.getUser(notaryId);
      if (!user) {
        return res.status(404).json({ message: 'Notary not found' });
      }

      const documentStatus = {
        hasNotaryCommissionFile: !!user.notaryCommissionFile,
        hasEOInsuranceFile: !!user.eoInsuranceFile,
        hasPublicCertificateFile: !!user.publicCertificateFile,
        hasBondFile: !!user.bondFile,
        hasSigningAgentFile: !!user.signingAgentFile,
        notaryCommissionFile: user.notaryCommissionFile,
        eoInsuranceFile: user.eoInsuranceFile,
        publicCertificateFile: user.publicCertificateFile,
        bondFile: user.bondFile,
        signingAgentFile: user.signingAgentFile
      };

      res.json(documentStatus);
    } catch (error) {
      console.error('Error fetching document status:', error);
      res.status(500).json({ message: 'Failed to fetch document status' });
    }
  });

  /**
   * GET /api/notary/profile/documents/:notaryId/download/:documentType
   * Download a specific notary document
   */
  app.get('/api/notary/profile/documents/:notaryId/download/:documentType', async (req: any, res) => {
    try {
      const notaryId = parseInt(req.params.notaryId);
      const documentType = req.params.documentType;
      
      // Handle token from both Authorization header and query parameter
      let token = null;
      if (req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.substring(7);
      } else if (req.query.token) {
        token = req.query.token;
      }
      
      if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
      }
      
      // Verify token
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
      }
      
      // Check if user can access this notary's documents
      if (decoded.id !== notaryId && decoded.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const user = await storage.getUser(notaryId);
      if (!user) {
        console.error(`Download error: User not found for notaryId ${notaryId}`);
        return res.status(404).json({ message: 'Notary not found' });
      }

      console.log(`Download request: User ${notaryId}, Document ${documentType}`);

      const fileKey = user[documentType as keyof typeof user] as string;
      if (!fileKey) {
        console.error(`Download error: No file key found for ${documentType} in user record`);
        return res.status(404).json({ 
          message: 'Document not found',
          details: `No ${documentType} found for this user`
        });
      }

      console.log(`Found file key for ${documentType}: ${fileKey}`);

      // Determine if this is a local file path or Vultr key
      const isLocalFile = fileKey.startsWith('/uploads/') || fileKey.startsWith('uploads/');
      
      if (isLocalFile) {
        // Handle legacy local files
        console.log(`Processing as local file: ${fileKey}`);
        
        try {
          // Construct full local path
          const fullPath = fileKey.startsWith('/') ? 
            path.join(process.cwd(), fileKey.substring(1)) : 
            path.join(process.cwd(), fileKey);
          
          console.log(`Checking local file at: ${fullPath}`);
          
          // Check if local file exists
          if (!fs.existsSync(fullPath)) {
            console.error(`Download error: Local file not found: ${fullPath}`);
            return res.status(404).json({ 
              message: 'Document file not found',
              details: 'Legacy file not found on server',
              fileKey: fileKey
            });
          }

          console.log(`Local file exists: ${fullPath}`);

          // Set appropriate headers for download
          res.setHeader('Content-Type', 'application/octet-stream');
          res.setHeader('Content-Disposition', `attachment; filename="${documentType}-${Date.now()}"`);
          res.setHeader('X-Served-From', 'local-storage');
          
          // Serve the local file for download
          console.log(`Serving local file for download: ${fullPath}`);
          res.download(path.resolve(fullPath), `${documentType}-${Date.now()}`);
          
        } catch (localError) {
          console.error(`Download error: Local file error:`, localError);
          return res.status(500).json({ 
            message: 'Local file access error',
            error: localError instanceof Error ? localError.message : 'Unknown local file error'
          });
        }
        
      } else {
        // Handle Vultr cloud storage files
        console.log(`Processing as Vultr cloud file: ${fileKey}`);
        
        try {
          const fileExists = await cloudStorage.fileExists(fileKey);
          if (!fileExists) {
            console.error(`Download error: File not found in Vultr storage: ${fileKey}`);
            return res.status(404).json({ 
              message: 'File not found in storage',
              fileKey: fileKey
            });
          }

          console.log(`File exists in Vultr: ${fileKey}`);

          // Generate signed URL for download (valid for 1 hour)
          const signedUrl = await cloudStorage.getSignedUrl(fileKey, 3600);
          console.log(`Generated signed URL for download: ${signedUrl.substring(0, 100)}...`);
          
          // Set appropriate headers for download
          res.setHeader('Content-Type', 'application/octet-stream');
          res.setHeader('Content-Disposition', `attachment; filename="${documentType}-${Date.now()}"`);
          res.setHeader('X-Served-From', 'vultr-storage');
          
          // Redirect to Vultr signed URL for download
          console.log(`Redirecting to Vultr signed URL for download`);
          res.redirect(302, signedUrl);
          
        } catch (storageError) {
          console.error(`Download error: Cloud storage error:`, storageError);
          return res.status(500).json({ 
            message: 'Cloud storage error',
            error: storageError instanceof Error ? storageError.message : 'Unknown storage error'
          });
        }
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      res.status(500).json({ message: 'Failed to download document' });
    }
  });

  /**
   * GET /api/notary/profile/documents/:notaryId/preview/:documentType
   * Preview a specific notary document
   */
  app.get('/api/notary/profile/documents/:notaryId/preview/:documentType', async (req: any, res) => {
    try {
      const notaryId = parseInt(req.params.notaryId);
      const documentType = req.params.documentType;
      
      // Handle token from both Authorization header and query parameter
      let token = null;
      if (req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.substring(7);
      } else if (req.query.token) {
        token = req.query.token;
      }
      
      if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
      }
      
      // Verify token
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
      }
      
      // Check if user can access this notary's documents
      if (decoded.id !== notaryId && decoded.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const user = await storage.getUser(notaryId);
      if (!user) {
        console.error(`Preview error: User not found for notaryId ${notaryId}`);
        return res.status(404).json({ message: 'Notary not found' });
      }

      console.log(`Preview request: User ${notaryId}, Document ${documentType}`);
      console.log(`User document fields:`, {
        notaryCommissionFile: user.notaryCommissionFile,
        eoInsuranceFile: user.eoInsuranceFile,
        publicCertificateFile: user.publicCertificateFile,
        bondFile: user.bondFile,
        signingAgentFile: user.signingAgentFile
      });

      const fileKey = user[documentType as keyof typeof user] as string;
      if (!fileKey) {
        console.error(`Preview error: No file key found for ${documentType} in user record`);
        return res.status(404).json({ 
          message: 'Document not found',
          details: `No ${documentType} found for this user`,
          availableFields: Object.keys(user).filter(key => key.includes('File'))
        });
      }

      console.log(`Found file key for ${documentType}: ${fileKey}`);

      // Determine if this is a local file path or Vultr key
      const isLocalFile = fileKey.startsWith('/uploads/') || fileKey.startsWith('uploads/');
      
      if (isLocalFile) {
        // Handle legacy local files
        console.log(`Processing as local file: ${fileKey}`);
        
        try {
          // Construct full local path
          const fullPath = fileKey.startsWith('/') ? 
            path.join(process.cwd(), fileKey.substring(1)) : 
            path.join(process.cwd(), fileKey);
          
          console.log(`Checking local file at: ${fullPath}`);
          
          // Check if local file exists
          if (!fs.existsSync(fullPath)) {
            console.error(`Preview error: Local file not found: ${fullPath}`);
            return res.status(404).json({ 
              message: 'Document file not found',
              details: 'Legacy file not found on server',
              fileKey: fileKey
            });
          }

          console.log(`Local file exists: ${fullPath}`);

          // Set appropriate headers for preview
          const mimeType = fileKey.endsWith('.pdf') ? 'application/pdf' : 
                           fileKey.endsWith('.jpg') || fileKey.endsWith('.jpeg') ? 'image/jpeg' :
                           fileKey.endsWith('.png') ? 'image/png' : 'application/octet-stream';
          
          res.setHeader('Content-Type', mimeType);
          res.setHeader('Content-Disposition', 'inline');
          res.setHeader('Cache-Control', 'private, max-age=300'); // 5 minute cache
          res.setHeader('X-Served-From', 'local-storage');
          
          // Serve the local file
          console.log(`Serving local file for preview: ${fullPath}`);
          res.sendFile(path.resolve(fullPath));
          
        } catch (localError) {
          console.error(`Preview error: Local file error:`, localError);
          return res.status(500).json({ 
            message: 'Local file access error',
            error: localError instanceof Error ? localError.message : 'Unknown local file error'
          });
        }
        
      } else {
        // Handle Vultr cloud storage files
        console.log(`Processing as Vultr cloud file: ${fileKey}`);
        
        try {
          const fileExists = await cloudStorage.fileExists(fileKey);
          if (!fileExists) {
            console.error(`Preview error: File not found in Vultr storage: ${fileKey}`);
            return res.status(404).json({ 
              message: 'File not found in storage',
              fileKey: fileKey
            });
          }

          console.log(`File exists in Vultr: ${fileKey}`);

          // Generate signed URL for preview (valid for 1 hour)
          const signedUrl = await cloudStorage.getSignedUrl(fileKey, 3600);
          console.log(`Generated signed URL for preview: ${signedUrl.substring(0, 100)}...`);

          // Set appropriate headers for preview
          const mimeType = fileKey.endsWith('.pdf') ? 'application/pdf' : 
                           fileKey.endsWith('.jpg') || fileKey.endsWith('.jpeg') ? 'image/jpeg' :
                           fileKey.endsWith('.png') ? 'image/png' : 'application/octet-stream';
          
          res.setHeader('Content-Type', mimeType);
          res.setHeader('Content-Disposition', 'inline');
          res.setHeader('Cache-Control', 'private, max-age=300'); // 5 minute cache
          res.setHeader('X-Served-From', 'vultr-storage');
          
          // Redirect to Vultr signed URL for preview
          console.log(`Redirecting to Vultr signed URL for preview`);
          res.redirect(302, signedUrl);
          
        } catch (storageError) {
          console.error(`Preview error: Cloud storage error:`, storageError);
          return res.status(500).json({ 
            message: 'Cloud storage error',
            error: storageError instanceof Error ? storageError.message : 'Unknown storage error'
          });
        }
      }
    } catch (error) {
      console.error('Error previewing document:', error);
      res.status(500).json({ message: 'Failed to preview document' });
    }
  });

  /**
   * POST /api/notary/profile/upload-documents
   * Upload notary documents (commission, E&O, bond, certificate, NSA) to Vultr cloud storage
   */
  app.post('/api/notary/profile/upload-documents', verifyToken, upload.fields([
    { name: 'notaryCommissionFile', maxCount: 1 },
    { name: 'eoInsuranceFile', maxCount: 1 },
    { name: 'publicCertificateFile', maxCount: 1 },
    { name: 'bondFile', maxCount: 1 },
    { name: 'signingAgentFile', maxCount: 1 }
  ]), async (req: any, res) => {
    try {
      if (!hasNotaryPrivileges(req.user)) {
        return res.status(403).json({ message: 'Notary privileges required to upload documents' });
      }

      const files = req.files as any;
      const filePaths: any = {};
      const sessionId = `notary-profile-${req.user.id}`;
      const userId = req.user.id;

      // Process uploaded files to Vultr cloud storage
      const fileTypes = [
        'notaryCommissionFile',
        'eoInsuranceFile', 
        'publicCertificateFile',
        'bondFile',
        'signingAgentFile'
      ];

      for (const fileType of fileTypes) {
        if (files[fileType] && files[fileType][0]) {
          try {
            const file = files[fileType][0];
            
            // Sanitize filename for cloud storage
            const sanitizedFilename = file.originalname
              .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
              .replace(/_+/g, '_') // Replace multiple underscores with single
              .replace(/^_|_$/g, '') // Remove leading/trailing underscores
              .replace(/^\.+|\.+$/g, '') // Remove leading/trailing dots
              .substring(0, 200); // Limit filename length
            
            // Ensure filename has an extension
            const finalFilename = sanitizedFilename || `document_${Date.now()}.${file.mimetype.split('/')[1] || 'bin'}`;
            
            // Upload to Vultr cloud storage
            const vultrFileKey = `documents/notary-profile-${userId}/${fileType}-${Date.now()}-${finalFilename}`;
            
            const uploadResult = await cloudStorage.uploadFile(file.buffer, vultrFileKey, {
              contentType: file.mimetype,
              metadata: {
                originalFilename: file.originalname,
                sanitizedFilename: finalFilename,
                documentType: fileType,
                notaryId: userId.toString(),
                uploadedAt: new Date().toISOString()
              }
            });

            // Generate signed URL for immediate access
            const signedUrl = await cloudStorage.getSignedUrl(vultrFileKey, 86400); // 24 hours

            // Store the Vultr file key and generate signed URL
            filePaths[fileType] = {
              fileKey: vultrFileKey,
              fileUrl: signedUrl,
              fileName: file.originalname,
              uploadedAt: new Date().toISOString()
            };

            console.log(`✅ Uploaded ${fileType} to Vultr: ${file.originalname} → ${finalFilename}`);
          } catch (error) {
            console.error(`❌ Failed to upload ${fileType}:`, error);
            throw new Error(`Failed to upload ${fileType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // Update user document flags in database
      if (Object.keys(filePaths).length > 0) {
        const updateData: any = {};
        
        // Set file paths and flags for uploaded documents
        Object.keys(filePaths).forEach(fileType => {
          if (filePaths[fileType]) {
            updateData[fileType] = filePaths[fileType].fileKey;
          }
        });
        
        // Update the user record with new file information
        await storage.updateUser(userId, updateData);
        
        console.log(`✅ Updated user ${userId} with new document file keys:`, Object.keys(filePaths));
      }

      res.json({
        message: 'Files uploaded successfully to cloud storage',
        uploadedFiles: filePaths,
        storageType: 'vultr'
      });

    } catch (error) {
      console.error('File upload error:', error);
      res.status(500).json({ message: 'Failed to upload files' });
    }
  });

  /**
   * POST /api/notary/profile/complete
   * Complete notary profile with all required information
   */
  app.post('/api/notary/profile/complete', verifyToken, async (req: any, res) => {
    try {
      if (!hasNotaryPrivileges(req.user)) {
        return res.status(403).json({ message: 'Notary privileges required to complete profile' });
      }

      const {
        // Basic personal information
        firstName,
        lastName,
        fullName,
        phoneNumber,
        // Personal address
        address1,
        address2,
        city,
        state,
        zipCode,
        // Notary-specific fields
        nameOnCommission,
        commissionAddress1,
        commissionAddress2,
        commissionCity,
        commissionState,
        commissionZipCode,
        commissionCounty,
        commissionNumber,
        commissionExpiration,
        eoInsuranceCompany,
        eoInsuranceAmount,
        eoInsuranceExpiration,
        publicCertificateExpiration,
        publicCertificatePassword,
        bondCompanyName,
        bondAmount,
        bondExpiration,
        signingAgentCertified,
        signingAgentExpirationDate,
        foreignLanguages,
        // File paths from upload
        notaryCommissionFile,
        eoInsuranceFile,
        publicCertificateFile,
        bondFile,
        signingAgentFile
      } = req.body;

      // Helper function to convert date strings to Date objects
      const parseDate = (dateString: string) => {
        if (!dateString) return null;
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? null : date;
      };

      // Update user profile with comprehensive notary information
      const updateData = {
        // Basic personal information
        firstName,
        lastName,
        fullName: fullName || (firstName && lastName ? `${firstName} ${lastName}`.trim() : undefined),
        phoneNumber,
        // Personal address
        address1,
        address2,
        city,
        state,
        zipCode,
        // Notary-specific fields
        nameOnCommission,
        commissionAddress1,
        commissionAddress2,
        commissionCity,
        commissionState,
        commissionZipCode,
        commissionCounty,
        commissionNumber,
        commissionExpiration: parseDate(commissionExpiration),
        eoInsuranceCompany,
        eoInsuranceAmount, // Already in cents from frontend
        eoInsuranceExpiration: parseDate(eoInsuranceExpiration),
        publicCertificateExpiration: parseDate(publicCertificateExpiration),
        publicCertificatePassword,
        bondCompanyName,
        bondAmount, // Already in cents from frontend
        bondExpiration: parseDate(bondExpiration),
        signingAgentCertified,
        signingAgentExpirationDate: signingAgentCertified ? parseDate(signingAgentExpirationDate) : null,
        foreignLanguages,
        // File paths
        notaryCommissionFile,
        eoInsuranceFile,
        publicCertificateFile,
        bondFile,
        signingAgentFile: signingAgentCertified ? signingAgentFile : null,
        // Update approval status and timestamps
        approvalStatus: 'pending', // Reset to pending for admin review
        lastProfileUpdate: new Date(),
        // Mark profile as submitted - indicates user has gone through the completion process
        profileSubmitted: true,
        profileCompleted: true
      };

      await storage.updateUser(req.user.id, updateData);

      // Invalidate user-specific cache to ensure fresh data on next request
      try {
        await redisCache.delPattern(`user:${req.user.id}:*`);
        console.log(`🧹 Invalidated cache for user ${req.user.id} after profile completion`);
      } catch (cacheError) {
        console.error('Failed to invalidate cache after profile completion:', cacheError);
        // Don't fail the request if cache invalidation fails
      }

      res.json({
        message: 'Profile completed successfully',
        approvalStatus: 'pending'
      });

    } catch (error) {
      console.error('Profile completion error:', error);
      res.status(500).json({ message: 'Failed to complete profile' });
    }
  });

  /**
   * GET /api/notary/profile/status
   * Check if notary profile is complete and approved
   */
  app.get('/api/notary/profile/status', verifyToken, cacheUserData(300), async (req: any, res) => {
    try {
      if (!hasNotaryPrivileges(req.user)) {
        return res.status(403).json({ message: 'Notary privileges required to check profile status' });
      }

      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if profile is complete
      // Profile is considered complete if:
      // 1. User has submitted the profile form (profileSubmitted = true), OR
      // 2. User has all core required fields filled
      
      const coreRequiredFields = [
        'nameOnCommission',
        'commissionNumber',
        'commissionExpiration',
        'commissionState'
      ];

      const missingCoreFields = coreRequiredFields.filter(field => !user[field]);
      
      // Profile is complete if user has submitted it OR has core fields
      const profileComplete = user.profileSubmitted || missingCoreFields.length === 0;

      // For detailed status, check all recommended fields
      const allRecommendedFields = [
        'nameOnCommission',
        'commissionAddress1', 
        'commissionCity',
        'commissionState',
        'commissionZipCode',
        'commissionCounty',
        'commissionNumber',
        'commissionExpiration',
        'eoInsuranceCompany',
        'eoInsuranceAmount',
        'eoInsuranceExpiration',
        'publicCertificateExpiration',
        'publicCertificatePassword',
        'bondCompanyName',
        'bondAmount',
        'bondExpiration'
      ];

      const allRecommendedFiles = [
        'notaryCommissionFile',
        'eoInsuranceFile', 
        'publicCertificateFile',
        'bondFile'
      ];

      const missingFields = allRecommendedFields.filter(field => !user[field]);
      const missingFiles = allRecommendedFiles.filter(field => !user[field]);

      res.json({
        profileComplete,
        approvalStatus: user.approvalStatus || 'pending',
        isActive: user.isActive,
        missingFields,
        missingFiles,
        canAccessDashboard: profileComplete && user.approvalStatus === 'approved' && user.isActive,
        lastProfileUpdate: user.lastProfileUpdate
      });

    } catch (error) {
      console.error('Profile status check error:', error);
      res.status(500).json({ message: 'Failed to check profile status' });
    }
  });

  /**
   * GET /api/notary/profile/comprehensive
   * Get comprehensive notary profile for editing
   */
  app.get('/api/notary/profile/comprehensive', verifyToken, async (req: any, res) => {
    try {
      if (!hasNotaryPrivileges(req.user)) {
        return res.status(403).json({ message: 'Notary privileges required to access profile data' });
      }

      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Return comprehensive profile data for form pre-population
      const profileData = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role, // Include role so frontend knows this is a notary
        fullName: user.fullName,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        
        // Personal address
        address1: user.address1,
        address2: user.address2,
        city: user.city,
        state: user.state,
        zipCode: user.zipCode,
        
        // Commission information
        nameOnCommission: user.nameOnCommission,
        commissionAddress1: user.commissionAddress1,
        commissionAddress2: user.commissionAddress2,
        commissionCity: user.commissionCity,
        commissionState: user.commissionState,
        commissionZipCode: user.commissionZipCode,
        commissionCounty: user.commissionCounty,
        commissionNumber: user.commissionNumber,
        commissionExpiration: user.commissionExpiration,
        
        // Insurance and bond
        eoInsuranceCompany: user.eoInsuranceCompany,
        eoInsuranceAmount: user.eoInsuranceAmount ? user.eoInsuranceAmount / 100 : 0, // Convert from cents
        eoInsuranceExpiration: user.eoInsuranceExpiration,
        bondCompanyName: user.bondCompanyName,
        bondAmount: user.bondAmount ? user.bondAmount / 100 : 0, // Convert from cents
        bondExpiration: user.bondExpiration,
        
        // Certificate
        publicCertificateExpiration: user.publicCertificateExpiration,
        publicCertificatePassword: '', // Don't return password for security
        
        // Signing agent
        signingAgentCertified: user.signingAgentCertified,
        signingAgentExpirationDate: user.signingAgentExpirationDate,
        
        // Languages
        foreignLanguages: user.foreignLanguages || [],
        
        // File status
        hasNotaryCommissionFile: !!user.notaryCommissionFile,
        hasEOInsuranceFile: !!user.eoInsuranceFile,
        hasPublicCertificateFile: !!user.publicCertificateFile,
        hasBondFile: !!user.bondFile,
        hasSigningAgentFile: !!user.signingAgentFile,
        
        // Status
        approvalStatus: user.approvalStatus,
        isActive: user.isActive,
        lastProfileUpdate: user.lastProfileUpdate
      };

      res.json(profileData);

    } catch (error) {
      console.error('Profile data error:', error);
      res.status(500).json({ message: 'Failed to get profile data' });
    }
  });
} 