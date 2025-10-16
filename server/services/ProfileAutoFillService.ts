import { db } from "../db";
import { users, editorSessions, notaryStamps, userSignatures } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";

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
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          role: users.role,
          privileges: users.privileges,
          firstName: users.firstName,
          lastName: users.lastName,
          fullName: users.fullName,
          phoneNumber: users.phoneNumber,
          nameOnCommission: users.nameOnCommission,
          commissionNumber: users.commissionNumber,
          commissionExpiration: users.commissionExpiration,
          commissionState: users.commissionState,
          commissionCounty: users.commissionCounty,
          disclosure: users.disclosure,
          signatureImage: users.signatureImage,
          initialsImage: users.initialsImage,
          signatureTyped: users.signatureTyped,
          initialsTyped: users.initialsTyped,
          defaultSignatureType: users.defaultSignatureType
        })
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
        
        // Notary stamps (fetch if user is a notary or has notary privileges)
        stamps: await this.determineAndFetchStamps(user, userId)
      };
    } catch (error) {
      console.error('Failed to get user profile data:', error);
      return null;
    }
  }

  /**
   * Determine if user should have stamps and fetch them
   */
  private static async determineAndFetchStamps(user: any, userId: number): Promise<Array<{ id: number; stampType: string; stampData: string; isActive: boolean; }>> {
    try {
      // Check if user has notary role or notary privileges
      const hasNotaryRole = user.role === 'notary';
      const hasNotaryPrivileges = user.privileges && Array.isArray(user.privileges) && user.privileges.includes('notary');
      const shouldFetchStamps = hasNotaryRole || hasNotaryPrivileges;
      
      console.log('🔍 Stamp fetching decision for user:', {
        userId,
        role: user.role,
        privileges: user.privileges,
        hasNotaryRole,
        hasNotaryPrivileges,
        shouldFetchStamps
      });
      
      if (shouldFetchStamps) {
        const stamps = await this.getNotaryStamps(userId);
        console.log(`📸 Fetched ${stamps.length} stamps for user ${userId}`);
        return stamps;
      } else {
        console.log(`❌ User ${userId} does not have notary role or privileges, skipping stamp fetch`);
        return [];
      }
    } catch (error) {
      console.error(`Failed to determine/fetch stamps for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get user signatures from userSignatures table
   */
  static async getUserSignatures(userId: number): Promise<any[]> {
    try {
      console.log(`📝 getUserSignatures called for userId: ${userId}`);
      const signatures = await db
        .select()
        .from(userSignatures)
        .where(eq(userSignatures.userId, userId));
      
      console.log(`📊 Found ${signatures.length} signatures for user ${userId}:`, 
        signatures.map(s => ({
          id: s.id,
          type: s.signatureType,
          isDefault: s.isDefault,
          hasImageUrl: !!s.imageUrl,
          imageUrlLength: s.imageUrl?.length || 0,
          startsWithData: s.imageUrl?.startsWith('data:') || false
        }))
      );
      
      return signatures;
    } catch (error) {
      console.error('Failed to get user signatures:', error);
      return [];
    }
  }

  /**
   * 🚀 PERFORMANCE OPTIMIZED: Get ONLY the first signature/initials for a user
   * Avoids fetching all signatures when only one is needed
   */
  private static async getFirstActiveSignature(userId: number, signatureType: 'signature' | 'initials'): Promise<any | null> {
    try {
      console.log(`🔍 Querying first ${signatureType} for user ID: ${userId}`);
      
      // Query for ONLY the first default signature, or first signature if no default
      const signatureRecords = await db.execute(sql`
        SELECT 
          id,
          user_id as "userId",
          signature_type as "signatureType",
          image_url as "imageUrl",
          name,
          type,
          is_default as "isDefault",
          created_at as "createdAt"
        FROM user_signatures 
        WHERE user_id = ${userId}
        AND signature_type = ${signatureType}
        ORDER BY is_default DESC, created_at DESC
        LIMIT 1
      `);
      
      const signature = signatureRecords.rows?.[0] as any;
      
      if (!signature || !signature.imageUrl) {
        console.log(`❌ No ${signatureType} found for user ${userId}`);
        return null;
      }
      
      console.log(`✅ ${signatureType} ${signature.id}: Retrieved successfully (${signature.imageUrl.length} bytes)`);
      
      return signature;
    } catch (error) {
      console.error(`Failed to fetch first ${signatureType}:`, error);
      return null;
    }
  }

  /**
   * 🚀 PERFORMANCE OPTIMIZED: Get ONLY the first active stamp for a user
   * This avoids fetching and generating signed URLs for all stamps when only one is needed
   */
  private static async getFirstActiveStamp(userId: number): Promise<{ id: number; stampType: string; stampData: string; isActive: boolean; } | null> {
    try {
      console.log(`🔍 Querying first stamp for notary ID: ${userId}`);
      
      // Query for ONLY the first active stamp
      const stampRecords = await db.execute(sql`
        SELECT 
          id,
          notary_id as "notaryId",
          stamp_type as "stampType",
          stamp_data as "stampData", 
          is_active as "isActive",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM notary_stamps 
        WHERE notary_id = ${userId}
        AND is_active = true
        ORDER BY created_at DESC
        LIMIT 1
      `);
      
      const stamp = stampRecords.rows?.[0] as any;
      
      if (!stamp || !stamp.stampData) {
        console.log(`❌ No active stamps found for notary ${userId}`);
        return null;
      }
      
      // 🚀 PERFORMANCE: Stamps are stored as base64 - use directly
      console.log(`✅ Stamp ${stamp.id}: Using base64 data directly (${stamp.stampData.length} bytes)`);
      
      return {
        id: stamp.id,
        stampType: stamp.stampType || 'notary',
        stampData: stamp.stampData, // Use directly - should be base64
        isActive: stamp.isActive || false
      };
    } catch (error) {
      console.error('Failed to fetch first notary stamp:', error);
      return null;
    }
  }

  /**
   * Get notary stamps for a user
   */
  private static async getNotaryStamps(userId: number): Promise<Array<{ id: number; stampType: string; stampData: string; isActive: boolean; }>> {
    try {
      // Use raw SQL query to match the correct database column names (like routes.ts does)
      console.log(`🔍 Querying stamps for notary ID: ${userId}`);
      
      const stampRecords = await db.execute(sql`
        SELECT 
          id,
          notary_id as "notaryId",
          stamp_type as "stampType",
          stamp_data as "stampData", 
          is_active as "isActive",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM notary_stamps 
        WHERE notary_id = ${userId}
        AND is_active = true
        ORDER BY created_at DESC
      `);
      
      console.log(`📊 Database returned ${stampRecords.rows?.length || 0} stamp records for notary ${userId}`);
      
      // Process stamps to include proper image URLs (like routes.ts does)
      const { cloudStorage } = await import('../lib/cloud-storage-service');
      
      const stamps = await Promise.all((stampRecords.rows || []).map(async (stamp: any) => {
        let imageUrl = '';
        
        if (stamp?.stampData && typeof stamp.stampData === 'string') {
          // Check if it's base64 data or Vultr key
          if (stamp.stampData.startsWith('data:image/')) {
            // Already base64 data, use directly
            imageUrl = stamp.stampData;
            console.log(`✅ Stamp ${stamp.id}: Using base64 data directly`);
          } else {
            // Vultr key, generate signed URL - try without fileExists check first
            try {
              console.log(`🔍 Stamp ${stamp.id}: Generating Vultr signed URL for key: ${stamp.stampData.substring(0, 50)}...`);
              const signedUrl = await cloudStorage.getSignedUrl(stamp.stampData, 3600); // 1 hour expiry
              if (signedUrl) {
                imageUrl = signedUrl;
                console.log(`✅ Stamp ${stamp.id}: Generated signed URL successfully`);
              } else {
                console.warn(`⚠️ Stamp ${stamp.id}: getSignedUrl returned null/empty`);
              }
            } catch (vultrError) {
              console.error(`❌ Stamp ${stamp.id}: Failed to generate Vultr URL:`, vultrError);
            }
          }
        }
        
        return {
          id: stamp?.id || 0,
          stampType: stamp?.stampType || 'notary',
          stampData: imageUrl,
          isActive: stamp?.isActive || false,
          hasError: imageUrl === '' && stamp?.stampData ? true : false
        };
      }));
      
      // Don't filter out stamps - return all active stamps even if URL generation failed
      // The client can show a "reload" option for stamps with errors
      const validStamps = stamps.filter(stamp => stamp.isActive);
      
      console.log(`📸 Found ${validStamps.length} active stamps with valid data for notary ID ${userId}:`, validStamps.map(s => ({
        id: s.id,
        type: s.stampType,
        hasData: !!s.stampData,
        isBase64: s.stampData.startsWith('data:image/'),
        isVultrUrl: s.stampData.includes('vultrobjects.com')
      })));
      
      return validStamps;
    } catch (error) {
      console.error('Failed to fetch notary stamps:', error);
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
    sessionId: string,
    options?: { allowInTagging?: boolean; userWithPrivileges?: any }
  ): Promise<AutoFillResult> {
    try {
      // 🔒 CRITICAL: Verify this is a signing session, not tagging
      const sessionCheck = await this.validateSigningSession(sessionId);
      const allowInTagging = options?.allowInTagging === true;
      if (!sessionCheck.isSigningSession && !allowInTagging) {
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
      
      // Map tag type to profile data (now async)
      return await this.mapTagTypeToProfileData(tagType, profile, options?.userWithPrivileges);
      
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
  private static async mapTagTypeToProfileData(tagType: string, profile: UserProfileData, userWithPrivileges?: any): Promise<AutoFillResult> {
    // Import auth functions for proper privilege checking
    const { hasNotaryPrivileges } = await import('../auth');
    
    // Check for notary privileges using the user object with privileges if available
    let isNotary = profile.role === 'notary';
    
    if (userWithPrivileges && hasNotaryPrivileges) {
      isNotary = isNotary || hasNotaryPrivileges(userWithPrivileges);
    }
    
    switch (tagType) {
      case 'S': // Signature
        // First check for signature in users table
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
        } 
        
        // 🚀 PERFORMANCE: Fetch ONLY the first signature (not all signatures)
        const signatureRecord = await ProfileAutoFillService.getFirstActiveSignature(profile.id, 'signature');
        
        if (signatureRecord && signatureRecord.imageUrl) {
          // Check if it's base64 or Vultr URL
          let imageUrl = signatureRecord.imageUrl;
          
          // If not base64, might be Vultr key - generate signed URL
          if (!imageUrl.startsWith('data:image/')) {
            try {
              let key: string | null = null;
              if (/^https?:\/\//i.test(imageUrl) && imageUrl.includes('vultrobjects.com')) {
                const url = new URL(imageUrl);
                key = url.pathname.replace(/^\//, '');
              } else if (!/^https?:\/\//i.test(imageUrl)) {
                key = imageUrl;
              }
              if (key) {
                const { VultrUploadHandler } = await import('../vultr-upload-handler');
                const access = await VultrUploadHandler.getFileUrl(key, 24 * 30);
                imageUrl = access.url;
              }
            } catch (e) {
              console.warn('Failed to generate Vultr URL, using original:', e);
            }
          }
          
          console.log('✅ Found signature in userSignatures table:', {
            id: signatureRecord.id,
            name: signatureRecord.name,
            type: signatureRecord.type,
            hasImageUrl: !!imageUrl,
            isDefault: signatureRecord.isDefault
          });
          
          return {
            success: true,
            content: imageUrl,
            contentType: 'image',
            contentData: {
              type: 'signature',
              value: imageUrl,
              signatureType: signatureRecord.type || 'uploaded'
            },
            source: 'profile_auto_fill',
            message: `Auto-filled signature for ${profile.fullName} (from signature library)`
          };
        } 
        
        // Check typed signature
        else if (profile.signatureTyped) {
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
        // First check for initials in users table
        if (profile.initialsImage) {
          return {
            success: true,
            content: profile.initialsImage,
            contentType: 'image',
            contentData: {
              type: 'initials',
              value: profile.initialsImage,
              signatureType: profile.defaultSignatureType
            },
            source: 'profile_auto_fill',
            message: `Auto-filled initials for ${profile.fullName}`
          };
        } 
        
        // 🚀 PERFORMANCE: Fetch ONLY the first initials (not all initials)
        const initialsRecord = await ProfileAutoFillService.getFirstActiveSignature(profile.id, 'initials');
        
        if (initialsRecord && initialsRecord.imageUrl) {
          // Check if it's base64 or Vultr URL
          let imageUrl = initialsRecord.imageUrl;
          
          // If not base64, might be Vultr key - generate signed URL
          if (!imageUrl.startsWith('data:image/')) {
            try {
              let key: string | null = null;
              if (/^https?:\/\//i.test(imageUrl) && imageUrl.includes('vultrobjects.com')) {
                const url = new URL(imageUrl);
                key = url.pathname.replace(/^\//, '');
              } else if (!/^https?:\/\//i.test(imageUrl)) {
                key = imageUrl;
              }
              if (key) {
                const { VultrUploadHandler } = await import('../vultr-upload-handler');
                const access = await VultrUploadHandler.getFileUrl(key, 24 * 30);
                imageUrl = access.url;
              }
            } catch (e) {
              console.warn('Failed to generate Vultr URL, using original:', e);
            }
          }
          
          console.log('✅ Found initials in userSignatures table:', {
            id: initialsRecord.id,
            name: initialsRecord.name,
            type: initialsRecord.type,
            hasImageUrl: !!imageUrl,
            isDefault: initialsRecord.isDefault
          });
          
          return {
            success: true,
            content: imageUrl,
            contentType: 'image',
            contentData: {
              type: 'initials',
              value: imageUrl,
              signatureType: initialsRecord.type || 'uploaded'
            },
            source: 'profile_auto_fill',
            message: `Auto-filled initials for ${profile.fullName} (from signature library)`
          };
        } 
        
        // Check typed initials
        else if (profile.initialsTyped) {
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
          // GRACEFUL FALLBACK: Generate initials from name
          if (profile.firstName && profile.lastName) {
            const generatedInitials = `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`;
            return {
              success: true,
              content: generatedInitials,
              contentType: 'text',
              contentData: {
                type: 'initials_fallback',
                value: generatedInitials,
                note: 'Generated from name - user should upload actual initials image'
              },
              source: 'profile_auto_fill',
              message: `Auto-filled initials with name: ${generatedInitials} (Add initials image in profile for better results)`
            };
          } else {
            return {
              success: true,
              content: '[Please upload initials]',
              contentType: 'text',
              contentData: {
                type: 'initials_missing',
                note: 'User should upload initials image'
              },
              source: 'profile_auto_fill',
              message: 'Please upload initials image in profile'
            };
          }
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
      
      case 'E': // Seal/Stamp - Auto-apply first available stamp (optimized)
        if (!isNotary) {
          return {
            success: false,
            content: '[Seal/Stamp - Notary only]',
            contentType: 'seal',
            source: 'profile_auto_fill',
            message: 'Notary stamps are for notaries only'
          };
        }
        
        // 🚀 PERFORMANCE FIX: Fetch ONLY the first active stamp instead of all stamps
        // This avoids unnecessary Vultr API calls for unused stamps
        const firstActiveStamp = await this.getFirstActiveStamp(profile.id);
        
        if (firstActiveStamp) {
          return {
            success: true,
            content: firstActiveStamp.stampData,
            contentType: 'image',
            contentData: {
              type: 'stamp',
              value: firstActiveStamp.stampData,
              stampType: firstActiveStamp.stampType,
              stampId: firstActiveStamp.id
            },
            source: 'profile_auto_fill',
            message: `Auto-applied notary stamp: ${firstActiveStamp.stampType}`
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
      
      case 'W': // Whiteout - Instant completion with white background
        return {
          success: true,
          content: '',
          contentType: 'whiteout',
          contentData: {
            type: 'whiteout',
            value: '',
            backgroundColor: '#FFFFFF',
            isInstant: true,
            note: 'Solid white rectangle to cover content'
          },
          source: 'profile_auto_fill',
          message: 'Whiteout applied instantly'
        };
      
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
    const autoFillTags = ['S', 'A', 'I', 'N', 'X', 'D', 'O', 'E'];
    return autoFillTags.includes(tagType);
  }
  
  static isInstantTag(tagType: string): boolean {
    const instantTags = ['W']; // Whiteout tags complete instantly
    return instantTags.includes(tagType);
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