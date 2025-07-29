import multer from 'multer';

// Professional multer configuration optimized for Vultr cloud storage
export const upload = multer({
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

// Export auth functions
export { verifyToken, hasAdminPrivileges, hasNotaryPrivileges } from '../auth'; 