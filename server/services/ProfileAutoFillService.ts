import { db } from "../db";
import { users, editorSessions, notaryStamps } from "../../shared/schema";
import { eq } from "drizzle-orm";

export interface UserProfileData {
  // Basic info
  id: number;
  fullName: string;
  firstName: string;
  lastName: string;
  
  // Notary specific
  nameOnCommission: string;
  commissionNumber: string;
  commissionExpiration: string;
  commissionState: string;
  commissionCounty: string;
  disclosure: string;
  
  // Signature data
  signatureImage: string; // Base64
  initialsImage: string;  // Base64
  signatureTyped: string;
  initialsTyped: string;
  defaultSignatureType: 'draw' | 'type' | 'upload';
  
  // User role
  role: string;
  userType: string;
  
  // Notary stamps
  stamps: Array<{
    id: number;
    stampType: string;
    stampData: string;
    isActive: boolean;
  }>;
}

export interface AutoFillResult {
  success: boolean;
  content: string;
  contentType: string;
  contentData?: any;
  source: 'profile_auto_fill';
  message?: string;
}

export class ProfileAutoFillService {
  
  /**
   * Get comprehensive user profile data for auto-fill
   */
  static async getUserProfileData(userId: number): Promise<UserProfileData | null> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      
      if (!user) {
        console.warn(`User not found: ${userId}`);
        return null;
      }
      
      return {
        // Basic info
        id: user.id,
        fullName: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        
        // Notary specific
        nameOnCommission: user.nameOnCommission || '',
        commissionNumber: user.commissionNumber || '',
        commissionExpiration: user.commissionExpiration || '',
        commissionState: user.commissionState || '',
        commissionCounty: user.commissionCounty || '',
        disclosure: user.disclosure || '',
        
        // Signature data
        signatureImage: user.signatureImage || '',
        initialsImage: user.initialsImage || '',
        signatureTyped: user.signatureTyped || '',
        initialsTyped: user.initialsTyped || '',
        defaultSignatureType: (user.defaultSignatureType as any) || 'draw',
        
        // User role
        role: user.role || '',
        userType: user.role || '', // Use role as userType for now
        
        // Notary stamps (fetch if user is a notary)
        stamps: user.role === 'notary' ? await this.getNotaryStamps(userId) : []
      };
    } catch (error) {
      console.error('Failed to get user profile data:', error);
      return null;
    }
  }
  
  /**
   * Get notary stamps for a notary user
   */
  private static async getNotaryStamps(userId: number): Promise<Array<{ id: number; stampType: string; stampData: string; isActive: boolean; }>> {
    try {
      const stampRecords = await db
        .select()
        .from(notaryStamps)
        .where(eq(notaryStamps.notaryId, userId));
      
      const stamps = stampRecords.map(stamp => ({
        id: stamp.id,
        stampType: stamp.stampType || 'notary',
        stampData: stamp.stampData || '',
        isActive: stamp.isActive || false
      }));
      
      console.log(`📸 Found ${stamps.length} stamps for notary ID ${userId}`);
      return stamps;
    } catch (error) {
      console.warn('Failed to fetch notary stamps:', error);
      return [];
    }
  }
  
  /**
   * Get auto-fill data for specific tag type
   * ⚠️ IMPORTANT: Only works in SIGNING mode, not tagging mode!
   */
  static async getTagAutoFillData(
    tagType: string, 
    userId: number, 
    sessionId: string
  ): Promise<AutoFillResult> {
    try {
      // 🔒 CRITICAL: Verify this is a signing session, not tagging
      const sessionCheck = await this.validateSigningSession(sessionId);
      if (!sessionCheck.isSigningSession) {
        return {
          success: false,
          content: '',
          contentType: 'error',
          source: 'profile_auto_fill',
          message: 'Auto-fill only works in signing sessions, not tagging sessions'
        };
      }
      
      // Get user profile data
      const profile = await this.getUserProfileData(userId);
      if (!profile) {
        return {
          success: false,
          content: '',
          contentType: 'error',
          source: 'profile_auto_fill',
          message: 'User profile not found'
        };
      }
      
      // Map tag type to profile data
      return this.mapTagTypeToProfileData(tagType, profile);
      
    } catch (error) {
      console.error('Failed to get tag auto-fill data:', error);
      return {
        success: false,
        content: '',
        contentType: 'error',
        source: 'profile_auto_fill',
        message: 'Auto-fill service error'
      };
    }
  }
  
  /**
   * 🔒 Validate that this is a signing session, not tagging session
   */
  private static async validateSigningSession(sessionId: string): Promise<{
    isSigningSession: boolean;
    sessionType: string;
  }> {
    try {
      const [session] = await db
        .select()
        .from(editorSessions)
        .where(eq(editorSessions.sessionId, sessionId))
        .limit(1);
      
      if (!session) {
        console.warn(`Session not found: ${sessionId}`);
        return { isSigningSession: false, sessionType: 'unknown' };
      }
      
      // Only allow auto-fill in 'notary' (signing) sessions
      const isSigningSession = session.sessionType === 'notary';
      
      console.log(`🔍 Session validation: ${sessionId} - Type: ${session.sessionType}, Auto-fill allowed: ${isSigningSession}`);
      
      return {
        isSigningSession,
        sessionType: session.sessionType || 'unknown'
      };
    } catch (error) {
      console.error('Failed to validate session:', error);
      return { isSigningSession: false, sessionType: 'error' };
    }
  }
  
  /**
   * Map tag types to specific profile data
   */
  private static mapTagTypeToProfileData(tagType: string, profile: UserProfileData): AutoFillResult {
    const isNotary = profile.role === 'notary';
    
    switch (tagType) {
      case 'S': // Signature
        if (profile.signatureImage) {
          return {
            success: true,
            content: profile.signatureImage,
            contentType: 'image',
            contentData: {
              type: 'signature',
              value: profile.signatureImage,
              signatureType: profile.defaultSignatureType
            },
            source: 'profile_auto_fill',
            message: `Auto-filled signature for ${profile.fullName}`
          };
        } else if (profile.signatureTyped) {
          return {
            success: true,
            content: profile.signatureTyped,
            contentType: 'text',
            contentData: {
              type: 'typed_signature',
              value: profile.signatureTyped
            },
            source: 'profile_auto_fill',
            message: `Auto-filled typed signature for ${profile.fullName}`
          };
        } else {
          // GRACEFUL FALLBACK: Use name as signature when no signature image/typed available
          const fallbackSignature = profile.nameOnCommission || profile.fullName || `${profile.firstName} ${profile.lastName}`;
          return {
            success: true,
            content: fallbackSignature,
            contentType: 'text',
            contentData: {
              type: 'signature_fallback',
              value: fallbackSignature,
              note: 'Generated from name - user should upload actual signature'
            },
            source: 'profile_auto_fill',
            message: `Auto-filled signature with name: ${fallbackSignature} (Add signature image in profile for better results)`
          };
        }
      
      case 'A': // Name
        const nameToUse = isNotary ? 
          (profile.nameOnCommission || profile.fullName) : 
          profile.fullName;
        
        if (nameToUse) {
          return {
            success: true,
            content: nameToUse,
            contentType: 'text',
            contentData: {
              type: 'name',
              value: nameToUse,
              isNotaryName: isNotary
            },
            source: 'profile_auto_fill',
            message: `Auto-filled name: ${nameToUse}`
          };
        } else {
          return {
            success: false,
            content: '[Name not set in profile]',
            contentType: 'text',
            source: 'profile_auto_fill',
            message: 'No name found in profile'
          };
        }
      
      case 'I': // Initials
        if (profile.initialsImage) {
          return {
            success: true,
            content: profile.initialsImage,
            contentType: 'image',
            contentData: {
              type: 'initials',
              value: profile.initialsImage
            },
            source: 'profile_auto_fill',
            message: `Auto-filled initials for ${profile.fullName}`
          };
        } else if (profile.initialsTyped) {
          return {
            success: true,
            content: profile.initialsTyped,
            contentType: 'text',
            contentData: {
              type: 'typed_initials',
              value: profile.initialsTyped
            },
            source: 'profile_auto_fill',
            message: `Auto-filled typed initials for ${profile.fullName}`
          };
        } else {
          // GRACEFUL FALLBACK: Generate initials from first/last name
          const generatedInitials = `${profile.firstName?.[0] || ''}${profile.lastName?.[0] || ''}`.toUpperCase();
          return {
            success: true,
            content: generatedInitials || 'XX',
            contentType: 'text',
            contentData: {
              type: 'initials_generated',
              value: generatedInitials || 'XX',
              note: 'Generated from name - user should upload actual initials'
            },
            source: 'profile_auto_fill',
            message: `Auto-filled initials: ${generatedInitials || 'XX'} (Add initials image in profile for better results)`
          };
        }
      
      case 'N': // Commission Number (Notary only)
        if (!isNotary) {
          return {
            success: false,
            content: '[Commission number - Notary only]',
            contentType: 'text',
            source: 'profile_auto_fill',
            message: 'Commission number is for notaries only'
          };
        }
        
        if (profile.commissionNumber) {
          return {
            success: true,
            content: profile.commissionNumber,
            contentType: 'text',
            contentData: {
              type: 'commission_number',
              value: profile.commissionNumber,
              state: profile.commissionState
            },
            source: 'profile_auto_fill',
            message: `Auto-filled commission number: ${profile.commissionNumber}`
          };
        } else {
          // GRACEFUL FALLBACK: Provide placeholder that notary can replace
          return {
            success: true,
            content: '[Enter Commission Number]',
            contentType: 'text',
            contentData: {
              type: 'commission_number_placeholder',
              value: '[Enter Commission Number]',
              note: 'Placeholder - notary should update profile with actual commission number'
            },
            source: 'profile_auto_fill',
            message: 'Commission number placeholder filled (Please add actual commission number in profile)'
          };
        }
      
      case 'X': // Commission Expiration (Notary only)
        if (!isNotary) {
          return {
            success: false,
            content: '[Commission expiration - Notary only]',
            contentType: 'text',
            source: 'profile_auto_fill',
            message: 'Commission expiration is for notaries only'
          };
        }
        
        if (profile.commissionExpiration) {
          return {
            success: true,
            content: profile.commissionExpiration,
            contentType: 'date',
            contentData: {
              type: 'commission_expiration',
              value: profile.commissionExpiration,
              state: profile.commissionState
            },
            source: 'profile_auto_fill',
            message: `Auto-filled commission expiration: ${profile.commissionExpiration}`
          };
        } else {
          // GRACEFUL FALLBACK: Provide placeholder date
          return {
            success: true,
            content: '[Enter Expiration Date]',
            contentType: 'date',
            contentData: {
              type: 'commission_expiration_placeholder',
              value: '[Enter Expiration Date]',
              note: 'Placeholder - notary should update profile with actual expiration date'
            },
            source: 'profile_auto_fill',
            message: 'Commission expiration placeholder filled (Please add actual expiration in profile)'
          };
        }
      
      case 'D': // Date
        const currentDate = this.formatDateForTag();
        return {
          success: true,
          content: currentDate,
          contentType: 'date',
          contentData: {
            type: 'current_date',
            value: currentDate,
            timestamp: new Date().toISOString()
          },
          source: 'profile_auto_fill',
          message: `Auto-filled current date: ${currentDate}`
        };
      
      case 'O': // Disclosure (Notary only)
        if (!isNotary) {
          return {
            success: false,
            content: '[Disclosure - Notary only]',
            contentType: 'text',
            source: 'profile_auto_fill',
            message: 'Disclosure is for notaries only'
          };
        }
        
        if (profile.disclosure) {
          return {
            success: true,
            content: profile.disclosure,
            contentType: 'text',
            contentData: {
              type: 'notary_disclosure',
              value: profile.disclosure
            },
            source: 'profile_auto_fill',
            message: `Auto-filled disclosure statement`
          };
        } else {
          // GRACEFUL FALLBACK: Provide placeholder disclosure
          return {
            success: true,
            content: '[Enter Disclosure Statement]',
            contentType: 'text',
            contentData: {
              type: 'disclosure_placeholder',
              value: '[Enter Disclosure Statement]',
              note: 'Placeholder - notary should update profile with actual disclosure statement'
            },
            source: 'profile_auto_fill',
            message: 'Disclosure placeholder filled (Please add actual disclosure in profile)'
          };
        }
      
      case 'T': // Text tags should NOT be auto-filled
        return {
          success: false,
          content: '',
          contentType: 'text',
          source: 'profile_auto_fill',
          message: 'Text tags use inline editing, not auto-fill'
        };
      
      case 'E': // Seal/Stamp - Return available stamps for selection
        if (!isNotary) {
          return {
            success: false,
            content: '[Seal/Stamp - Notary only]',
            contentType: 'seal',
            source: 'profile_auto_fill',
            message: 'Notary stamps are for notaries only'
          };
        }
        
        // Return available stamps for frontend selection
        const activeStamps = profile.stamps.filter(stamp => stamp.isActive);
        
        if (activeStamps.length > 0) {
          return {
            success: true,
            content: '', // Will be filled when user selects a stamp
            contentType: 'stamp_selection',
            contentData: {
              type: 'stamp_selection',
              availableStamps: activeStamps,
              requiresSelection: true,
              note: 'Select a stamp and configure notarization details'
            },
            source: 'profile_auto_fill',
            message: `Found ${activeStamps.length} available stamps - please select one`
          };
        } else {
          return {
            success: true,
            content: '[No stamps available - upload stamps in profile]',
            contentType: 'text',
            contentData: {
              type: 'stamp_missing',
              note: 'Notary should upload stamp images in profile settings'
            },
            source: 'profile_auto_fill',
            message: 'No notary stamps found in profile - please upload stamps'
          };
        }
      
      default:
        return {
          success: false,
          content: `[Unknown tag type: ${tagType}]`,
          contentType: 'text',
          source: 'profile_auto_fill',
          message: `Unknown tag type: ${tagType}`
        };
    }
  }
  
  /**
   * Detect if content is an image (base64 or URL)
   */
  private static isImageContent(content: string): boolean {
    if (!content) return false;
    
    // Check if it's a base64 image
    if (content.startsWith('data:image/')) {
      return true;
    }
    
    // Check if it's a URL pointing to an image
    if (content.startsWith('http') && /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(content)) {
      return true;
    }
    
    // Check if it's a Vultr storage URL
    if (content.includes('vultrobjects.com') || content.includes('/api/documents/')) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Format current date for tags
   */
  static formatDateForTag(): string {
    const now = new Date();
    return now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }
  
  /**
   * Check if tag type supports auto-fill
   */
  static isAutoFillTag(tagType: string): boolean {
    const autoFillTags = ['S', 'A', 'I', 'N', 'X', 'D', 'O'];
    return autoFillTags.includes(tagType);
  }
  
  /**
   * Check if tag type requires dialog (not auto-fill)
   */
  static isDialogTag(tagType: string): boolean {
    const dialogTags = ['E']; // Seal tags
    return dialogTags.includes(tagType);
  }
  
  /**
   * Check if tag type uses inline editing
   */
  static isInlineEditTag(tagType: string): boolean {
    const inlineEditTags = ['T']; // Text tags
    return inlineEditTags.includes(tagType);
  }
} 