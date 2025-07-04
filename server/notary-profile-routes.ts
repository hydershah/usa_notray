import { Express } from 'express';
import { verifyToken, hasNotaryPrivileges } from './auth';
import { cacheUserData } from './middleware/cache-middleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
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
            
            // Upload to Vultr using the cloud storage service
            const uploadResult = await handleCloudFileUpload(
              file.buffer,
              file.originalname,
              'document',
              sessionId,
              userId,
              { documentType: fileType }
            );

            // Store the Vultr file key and generate signed URL
            filePaths[fileType] = {
              fileKey: uploadResult.key,
              fileUrl: uploadResult.signedUrl,
              fileName: file.originalname,
              uploadedAt: new Date().toISOString()
            };

            console.log(`✅ Uploaded ${fileType} to Vultr: ${file.originalname}`);
          } catch (error) {
            console.error(`❌ Failed to upload ${fileType}:`, error);
            throw new Error(`Failed to upload ${fileType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
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