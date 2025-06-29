import { Express } from 'express';
import { verifyToken } from './auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { storage } from './storage';

// Configure multer for file uploads
const uploadsDir = path.join(process.cwd(), 'uploads', 'notary-documents');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    const fieldName = file.fieldname;
    const userId = (req as any).user?.id || 'unknown';
    cb(null, `${userId}-${fieldName}-${uniqueSuffix}${fileExtension}`);
  }
});

const upload = multer({
  storage: uploadStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
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
   * Upload notary documents (commission, E&O, bond, certificate, NSA)
   */
  app.post('/api/notary/profile/upload-documents', verifyToken, upload.fields([
    { name: 'notaryCommissionFile', maxCount: 1 },
    { name: 'eoInsuranceFile', maxCount: 1 },
    { name: 'publicCertificateFile', maxCount: 1 },
    { name: 'bondFile', maxCount: 1 },
    { name: 'signingAgentFile', maxCount: 1 }
  ]), async (req: any, res) => {
    try {
      if (req.user.role !== 'notary') {
        return res.status(403).json({ message: 'Only notaries can upload documents' });
      }

      const files = req.files as any;
      const filePaths: any = {};

      // Process uploaded files
      if (files.notaryCommissionFile) {
        filePaths.notaryCommissionFile = `/uploads/notary-documents/${files.notaryCommissionFile[0].filename}`;
      }
      if (files.eoInsuranceFile) {
        filePaths.eoInsuranceFile = `/uploads/notary-documents/${files.eoInsuranceFile[0].filename}`;
      }
      if (files.publicCertificateFile) {
        filePaths.publicCertificateFile = `/uploads/notary-documents/${files.publicCertificateFile[0].filename}`;
      }
      if (files.bondFile) {
        filePaths.bondFile = `/uploads/notary-documents/${files.bondFile[0].filename}`;
      }
      if (files.signingAgentFile) {
        filePaths.signingAgentFile = `/uploads/notary-documents/${files.signingAgentFile[0].filename}`;
      }

      res.json({
        message: 'Files uploaded successfully',
        ...filePaths
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
      if (req.user.role !== 'notary') {
        return res.status(403).json({ message: 'Only notaries can complete profile' });
      }

      const {
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

      // Update user profile with comprehensive notary information
      const updateData = {
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
        eoInsuranceAmount, // Already in cents from frontend
        eoInsuranceExpiration,
        publicCertificateExpiration,
        publicCertificatePassword,
        bondCompanyName,
        bondAmount, // Already in cents from frontend
        bondExpiration,
        signingAgentCertified,
        signingAgentExpirationDate: signingAgentCertified ? signingAgentExpirationDate : null,
        foreignLanguages,
        // File paths
        notaryCommissionFile,
        eoInsuranceFile,
        publicCertificateFile,
        bondFile,
        signingAgentFile: signingAgentCertified ? signingAgentFile : null,
        // Update approval status and timestamps
        approvalStatus: 'pending', // Reset to pending for admin review
        lastProfileUpdate: new Date().toISOString(),
        // Mark profile as complete for initial checks
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
  app.get('/api/notary/profile/status', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'notary') {
        return res.status(403).json({ message: 'Only notaries can check profile status' });
      }

      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if profile is complete
      const requiredFields = [
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

      const requiredFiles = [
        'notaryCommissionFile',
        'eoInsuranceFile', 
        'publicCertificateFile',
        'bondFile'
      ];

      const missingFields = requiredFields.filter(field => !user[field]);
      const missingFiles = requiredFiles.filter(field => !user[field]);

      const profileComplete = missingFields.length === 0 && missingFiles.length === 0;

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
      if (req.user.role !== 'notary') {
        return res.status(403).json({ message: 'Only notaries can access profile data' });
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