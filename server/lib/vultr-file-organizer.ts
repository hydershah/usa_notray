/**
 * Vultr File Organization System
 * Creates intelligent folder structure for easy management and retrieval
 */

export interface FileMetadata {
  fileType: 'document' | 'signature' | 'stamp' | 'certificate' | 'profile_image' | 'recording';
  userId?: number;
  userRole?: string; // 'notary', 'signer', 'admin', 'title_company'
  jobId?: number;
  notaryId?: number;
  originalFilename: string;
  contentType?: string;
  sessionId?: string;
}

export interface OrganizedPath {
  vultrKey: string;
  folder: string;
  filename: string;
  fullPath: string;
}

export class VultrFileOrganizer {
  
  /**
   * Generate organized Vultr key with intelligent folder structure
   * 
   * Professional Structure:
   * /{environment}/{fileType}/{year}/{month}/{category}/{unique_filename}
   * 
   * Examples:
   * - production/documents/2025/01/notarizations/job-123/20250102_doc_123abc_purchase_agreement.pdf
   * - production/signatures/2025/01/notarizations/job-123/20250102_sig_456def_signer-789_signature.png
   * - production/certificates/2025/01/notary-profiles/notary-101/20250102_cert_789ghi_commission_certificate.pdf
   * - production/recordings/2025/01/notarizations/job-123/20250102_rec_321xyz_notarization_session.webm
   */
  static generateOrganizedKey(metadata: FileMetadata): OrganizedPath {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const timestamp = Date.now();
    
    // Generate unique identifier
    const uniqueId = Math.random().toString(36).substring(2, 8);
    
    // Clean filename (remove special characters, limit length)
    const cleanFilename = this.sanitizeFilename(metadata.originalFilename);
    const fileExtension = this.getFileExtension(cleanFilename);
    const baseFilename = this.getBaseFilename(cleanFilename);
    
    // Determine professional category structure
    const category = this.determineProfessionalCategory(metadata);
    
    // Generate organized filename with professional naming
    const organizedFilename = this.generateProfessionalFilename({
      date: `${year}${month}${day}`,
      timestamp,
      uniqueId,
      fileType: metadata.fileType,
      userId: metadata.userId,
      userRole: metadata.userRole,
      jobId: metadata.jobId,
      notaryId: metadata.notaryId,
      baseFilename,
      fileExtension
    });
    
    // Environment prefix for multi-environment support
    const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
    
    // Construct professional folder structure
    const folder = `${environment}/${metadata.fileType}/${year}/${month}/${category}`;
    const vultrKey = `${folder}/${organizedFilename}`;
    
    return {
      vultrKey,
      folder,
      filename: organizedFilename,
      fullPath: vultrKey
    };
  }
  
  /**
   * Determine professional category for better organization
   */
  private static determineProfessionalCategory(metadata: FileMetadata): string {
    const { fileType, jobId, notaryId, userId, userRole } = metadata;
    
    switch (fileType) {
      case 'document':
        if (jobId) {
          return `notarizations/job-${jobId}`;
        } else if (userRole === 'notary') {
          return `notary-documents/notary-${notaryId || userId}`;
        } else if (userRole === 'title_company') {
          return `title-company-documents/company-${userId}`;
        } else {
          return `client-documents/user-${userId || 'unknown'}`;
        }
        
      case 'signature':
        if (jobId) {
          return `notarizations/job-${jobId}/signatures`;
        } else {
          return `personal-signatures/user-${userId || 'unknown'}`;
        }
        
      case 'stamp':
        return `notary-stamps/notary-${notaryId || userId || 'unknown'}`;
        
      case 'certificate':
        if (userRole === 'notary') {
          return `notary-profiles/notary-${notaryId || userId}/credentials`;
        } else {
          return `user-certificates/user-${userId || 'unknown'}`;
        }
        
      case 'profile_image':
        if (userRole === 'notary') {
          return `notary-profiles/notary-${notaryId || userId}/photos`;
        } else {
          return `user-profiles/user-${userId}/photos`;
        }
        
      case 'recording':
        if (jobId) {
          return `notarizations/job-${jobId}/recordings`;
        } else {
          return `general-recordings`;
        }
        
      default:
        return 'miscellaneous';
    }
  }
  
  /**
   * Generate professional filename with clear metadata embedded
   */
  private static generateProfessionalFilename(params: {
    date: string;
    timestamp: number;
    uniqueId: string;
    fileType: string;
    userId?: number;
    userRole?: string;
    jobId?: number;
    notaryId?: number;
    baseFilename: string;
    fileExtension: string;
  }): string {
    const {
      date,
      timestamp,
      uniqueId,
      fileType,
      userId,
      userRole,
      jobId,
      notaryId,
      baseFilename,
      fileExtension
    } = params;
    
    // Generate professional file type prefix
    const typePrefix = this.getFileTypePrefix(fileType);
    
    // Build filename components with professional structure
    const components = [date, typePrefix, uniqueId];
    
    // Add context-specific identifiers
    if (jobId) components.push(`job${jobId}`);
    if (notaryId) components.push(`notary${notaryId}`);
    if (userId && !notaryId && !jobId) components.push(`user${userId}`);
    
    // Add cleaned base filename (truncated if too long)
    const maxFilenameLength = 30;
    const truncatedFilename = baseFilename.length > maxFilenameLength 
      ? baseFilename.substring(0, maxFilenameLength) 
      : baseFilename;
    components.push(truncatedFilename);
    
    return `${components.join('_')}${fileExtension}`;
  }
  
  /**
   * Get professional file type prefix for filenames
   */
  private static getFileTypePrefix(fileType: string): string {
    const prefixes: Record<string, string> = {
      'document': 'doc',
      'signature': 'sig',
      'stamp': 'stamp',
      'certificate': 'cert',
      'profile_image': 'profile',
      'recording': 'rec'
    };
    
    return prefixes[fileType] || 'file';
  }
  
  /**
   * Sanitize filename for safe storage
   */
  private static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
      .replace(/_+/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, '') // Remove leading/trailing underscores
      .substring(0, 100); // Limit length
  }
  
  /**
   * Extract file extension
   */
  private static getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.substring(lastDot) : '';
  }
  
  /**
   * Get base filename without extension
   */
  private static getBaseFilename(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.substring(0, lastDot) : filename;
  }
  
  /**
   * Parse Vultr key to extract metadata
   */
  static parseVultrKey(vultrKey: string): {
    fileType: string;
    year: string;
    month: string;
    category: string;
    filename: string;
    metadata?: {
      date?: string;
      timestamp?: number;
      userId?: number;
      jobId?: number;
      notaryId?: number;
    };
  } {
    const parts = vultrKey.split('/');
    
    if (parts.length < 4) {
      throw new Error('Invalid Vultr key format');
    }
    
    const [fileType, year, month, category, filename] = parts;
    
    // Parse filename metadata
    const filenameParts = filename.split('_');
    const metadata: any = {};
    
    if (filenameParts.length >= 3) {
      metadata.date = filenameParts[0];
      metadata.timestamp = parseInt(filenameParts[1]);
      
      // Extract IDs from filename parts
      for (const part of filenameParts) {
        if (part.startsWith('user-')) {
          metadata.userId = parseInt(part.replace('user-', ''));
        } else if (part.startsWith('job-')) {
          metadata.jobId = parseInt(part.replace('job-', ''));
        } else if (part.startsWith('notary-')) {
          metadata.notaryId = parseInt(part.replace('notary-', ''));
        }
      }
    }
    
    return {
      fileType,
      year,
      month,
      category,
      filename,
      metadata
    };
  }
  
  /**
   * Generate search patterns for file discovery
   */
  static generateSearchPatterns(criteria: {
    fileType?: string;
    year?: number;
    month?: number;
    jobId?: number;
    userId?: number;
    notaryId?: number;
  }): string[] {
    const patterns: string[] = [];
    const { fileType, year, month, jobId, userId, notaryId } = criteria;
    
    let basePath = '';
    
    if (fileType) basePath += `${fileType}/`;
    if (year) basePath += `${year}/`;
    if (month) basePath += `${String(month).padStart(2, '0')}/`;
    
    if (jobId) patterns.push(`${basePath}job-${jobId}/`);
    if (notaryId) patterns.push(`${basePath}notary-${notaryId}/`);
    if (userId) patterns.push(`${basePath}user-${userId}/`);
    
    if (patterns.length === 0) {
      patterns.push(basePath || '');
    }
    
    return patterns;
  }
  
  /**
   * Get content type from file extension
   */
  static getContentType(filename: string): string {
    const ext = this.getFileExtension(filename).toLowerCase();
    
    const contentTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.wav': 'audio/wav',
      '.mp3': 'audio/mpeg',
    };
    
    return contentTypes[ext] || 'application/octet-stream';
  }
}

/**
 * Helper function for easy use in upload handlers
 */
export function generateVultrKey(
  fileType: FileMetadata['fileType'],
  originalFilename: string,
  options: {
    userId?: number;
    userRole?: string;
    jobId?: number;
    notaryId?: number;
    sessionId?: string;
  } = {}
): OrganizedPath {
  return VultrFileOrganizer.generateOrganizedKey({
    fileType,
    originalFilename,
    ...options
  });
} 