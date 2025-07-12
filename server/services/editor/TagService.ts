import { db } from "../../db";
import { documentTags, editorSessions, users } from "../../../shared/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

export interface PlaceTagRequest {
  sessionId: string;
  documentId: string;
  tagType: string;
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
    pageNumber: number;
  };
  assignedUserId: string;
  placedBy: number;
}

export interface DocumentTagData {
  id: string;
  sessionId: string;
  documentId: string;
  tagType: string;
  assignedUserId: string;
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
    pageNumber: number;
  };
  displayLabel: string;
  colorCode: string;
  isCompleted: boolean;
  content?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class TagService {
  
  /**
   * Place a new tag on a document
   */
  static async placeTag(request: PlaceTagRequest): Promise<DocumentTagData> {
    try {
      // Validate coordinates to prevent NaN values
      const coords = request.coordinates;
      if (isNaN(coords.x) || isNaN(coords.y) || isNaN(coords.width) || isNaN(coords.height) || isNaN(coords.pageNumber)) {
        console.error('Invalid coordinates detected in placeTag:', coords);
        throw new Error('Invalid coordinates: NaN values not allowed');
      }
      
      // Ensure all coordinates are finite numbers
      if (!isFinite(coords.x) || !isFinite(coords.y) || !isFinite(coords.width) || !isFinite(coords.height) || !isFinite(coords.pageNumber)) {
        console.error('Non-finite coordinates detected in placeTag:', coords);
        throw new Error('Invalid coordinates: must be finite numbers');
      }
      
      // Ensure positive dimensions and valid page number
      if (coords.width <= 0 || coords.height <= 0 || coords.pageNumber <= 0) {
        console.error('Invalid dimensions or page number detected in placeTag:', coords);
        throw new Error('Invalid coordinates: width, height, and pageNumber must be positive');
      }

      // Get session to verify it exists and check status
      const [session] = await db
        .select()
        .from(editorSessions)
        .where(eq(editorSessions.sessionId, request.sessionId))
        .limit(1);
      
      if (!session) {
        throw new Error('Session not found');
      }
      
      // If session is completed, reactivate it since user is making changes
      // Only reactivate for tagging sessions, not for notary sessions
      if (session.status === 'completed' && session.sessionType === 'tagging') {
        await db
          .update(editorSessions)
          .set({ 
            status: 'in_progress',
            updatedAt: new Date()
          })
          .where(eq(editorSessions.sessionId, request.sessionId));
        
        console.log(`🔄 Reactivated completed tagging session: ${request.sessionId} (user making new changes)`);
      }
      
      // Get assigned user info for display
      console.log('🔍 Looking for assigned user with ID:', request.assignedUserId, 'parsed as:', parseInt(request.assignedUserId));
      
      const [assignedUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, parseInt(request.assignedUserId)))
        .limit(1);
      
      if (!assignedUser) {
        console.error('❌ Assigned user not found in database. Available users:');
        const allUsers = await db.select({ id: users.id, username: users.username, firstName: users.firstName }).from(users).limit(10);
        console.error('Available users:', allUsers);
        throw new Error('Assigned user not found');
      }
      
      // Generate display label and color
      const tagTypeInfo = this.getTagTypeInfo(request.tagType);
      const displayLabel = `${tagTypeInfo.icon} ${tagTypeInfo.label} - ${assignedUser.firstName} ${assignedUser.lastName}`;
      const colorCode = this.getUserColor(assignedUser);
      
      // Create tag data with correct schema fields
      const tagData = {
        documentId: parseInt(request.documentId),
        sessionId: session.id, // Use the actual session DB ID, not sessionId string
        tagType: request.tagType,
        assignedUserId: parseInt(request.assignedUserId),
        pageNumber: request.coordinates.pageNumber,
        xPosition: Math.round(request.coordinates.x),
        yPosition: Math.round(request.coordinates.y),
        width: Math.round(request.coordinates.width),
        height: Math.round(request.coordinates.height),
        isCompleted: false,
        createdBy: request.placedBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const [createdTag] = await db
        .insert(documentTags)
        .values(tagData)
        .returning();
      
      console.log(`✅ Tag placed: ${request.tagType} for ${assignedUser.firstName} ${assignedUser.lastName} at page ${request.coordinates.pageNumber}`);
      
      // Invalidate cache for this session and document
      await this.invalidateTagCache(request.sessionId, request.documentId);
      
      return this.convertToDocumentTagData(createdTag, displayLabel, colorCode);
      
    } catch (error) {
      console.error('Failed to place tag:', error);
      throw new Error(`Failed to place tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get all tags for a session
   */
  static async getSessionTags(sessionId: string): Promise<DocumentTagData[]> {
    try {
      // Get session first to get the DB ID
      const [session] = await db
        .select()
        .from(editorSessions)
        .where(eq(editorSessions.sessionId, sessionId))
        .limit(1);

      if (!session) {
        return [];
      }

      // Optimized query with JOIN to get user information in one query
      const tags = await db
        .select({
          id: documentTags.id,
          sessionId: documentTags.sessionId,
          documentId: documentTags.documentId,
          tagType: documentTags.tagType,
          assignedUserId: documentTags.assignedUserId,
          pageNumber: documentTags.pageNumber,
          xPosition: documentTags.xPosition,
          yPosition: documentTags.yPosition,
          width: documentTags.width,
          height: documentTags.height,
          isCompleted: documentTags.isCompleted,
          content: documentTags.content,
          contentType: documentTags.contentType,
          contentData: documentTags.contentData,
          createdAt: documentTags.createdAt,
          updatedAt: documentTags.updatedAt,
          // User information
          firstName: users.firstName,
          lastName: users.lastName,
          userRole: users.role
        })
        .from(documentTags)
        .leftJoin(users, eq(documentTags.assignedUserId, users.id))
        .where(eq(documentTags.sessionId, session.id));

      // Convert to DocumentTagData format
      const convertedTags = tags.map(tag => {
        let displayLabel = 'Unknown User';
        let colorCode = '#000000';
        
        if (tag.firstName && tag.lastName) {
          const tagTypeInfo = this.getTagTypeInfo(tag.tagType);
          displayLabel = `${tagTypeInfo.icon} ${tagTypeInfo.label} - ${tag.firstName} ${tag.lastName}`;
          colorCode = this.getUserColor({ role: tag.userRole, id: tag.assignedUserId });
        }
        
        return this.convertToDocumentTagData(tag, displayLabel, colorCode);
      });

      return convertedTags;
      
    } catch (error) {
      console.error('Failed to get session tags:', error);
      throw new Error(`Failed to get tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get tags for a specific document in a session
   */
  static async getDocumentTags(sessionId: string, documentId: string): Promise<DocumentTagData[]> {
    try {
      // Get session first to get the DB ID
      const [session] = await db
        .select()
        .from(editorSessions)
        .where(eq(editorSessions.sessionId, sessionId))
        .limit(1);

      if (!session) {
        return [];
      }

      // Optimized query with JOIN to get user information in one query, filtered by document
      const tags = await db
        .select({
          id: documentTags.id,
          sessionId: documentTags.sessionId,
          documentId: documentTags.documentId,
          tagType: documentTags.tagType,
          assignedUserId: documentTags.assignedUserId,
          pageNumber: documentTags.pageNumber,
          xPosition: documentTags.xPosition,
          yPosition: documentTags.yPosition,
          width: documentTags.width,
          height: documentTags.height,
          isCompleted: documentTags.isCompleted,
          content: documentTags.content,
          contentType: documentTags.contentType,
          contentData: documentTags.contentData,
          createdAt: documentTags.createdAt,
          updatedAt: documentTags.updatedAt,
          // User information
          firstName: users.firstName,
          lastName: users.lastName,
          userRole: users.role
        })
        .from(documentTags)
        .leftJoin(users, eq(documentTags.assignedUserId, users.id))
        .where(and(
          eq(documentTags.sessionId, session.id),
          eq(documentTags.documentId, parseInt(documentId))
        ));

      // Convert to DocumentTagData format
      const convertedTags = tags.map(tag => {
        let displayLabel = 'Unknown User';
        let colorCode = '#000000';
        
        if (tag.firstName && tag.lastName) {
          const tagTypeInfo = this.getTagTypeInfo(tag.tagType);
          displayLabel = `${tagTypeInfo.icon} ${tagTypeInfo.label} - ${tag.firstName} ${tag.lastName}`;
          colorCode = this.getUserColor({ role: tag.userRole, id: tag.assignedUserId });
        }
        
        return this.convertToDocumentTagData(tag, displayLabel, colorCode);
      });

      console.log(`🏷️ Retrieved ${convertedTags.length} tags for document ${documentId} in session ${sessionId}`);
      return convertedTags;
      
    } catch (error) {
      console.error('Failed to get document tags:', error);
      throw new Error(`Failed to get document tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Update a tag
   */
  static async updateTag(tagId: string, updates: any): Promise<DocumentTagData> {
    try {
      // Validate tag ID format
      if (!tagId || tagId.trim() === '') {
        throw new Error('Invalid tag ID: empty or null');
      }
      
      // Handle temporary tag IDs (these should not be updated in DB)
      if (tagId.startsWith('temp_')) {
        console.warn('Attempted to update temporary tag:', tagId);
        throw new Error('Cannot update temporary tag - please wait for tag to be saved first');
      }
      
      // Validate that tag ID can be parsed as integer
      const numericTagId = parseInt(tagId);
      if (isNaN(numericTagId) || !isFinite(numericTagId) || numericTagId <= 0) {
        console.error('Invalid tag ID detected:', tagId, 'parsed as:', numericTagId);
        throw new Error('Invalid tag ID: must be a positive integer');
      }
      // Validate coordinates to prevent NaN values
      if (updates.coordinates) {
        const coords = updates.coordinates;
        
        // Only validate properties that are actually present
        if (coords.x !== undefined && (isNaN(coords.x) || !isFinite(coords.x))) {
          console.error('Invalid x coordinate detected:', coords.x);
          throw new Error('Invalid coordinates: x must be a valid finite number');
        }
        
        if (coords.y !== undefined && (isNaN(coords.y) || !isFinite(coords.y))) {
          console.error('Invalid y coordinate detected:', coords.y);
          throw new Error('Invalid coordinates: y must be a valid finite number');
        }
        
        if (coords.width !== undefined && (isNaN(coords.width) || !isFinite(coords.width) || coords.width <= 0)) {
          console.error('Invalid width detected:', coords.width);
          throw new Error('Invalid coordinates: width must be a positive finite number');
        }
        
        if (coords.height !== undefined && (isNaN(coords.height) || !isFinite(coords.height) || coords.height <= 0)) {
          console.error('Invalid height detected:', coords.height);
          throw new Error('Invalid coordinates: height must be a positive finite number');
        }
        
        if (coords.pageNumber !== undefined && (isNaN(coords.pageNumber) || !isFinite(coords.pageNumber) || coords.pageNumber <= 0)) {
          console.error('Invalid pageNumber detected:', coords.pageNumber);
          throw new Error('Invalid coordinates: pageNumber must be a positive finite number');
        }
        
        console.log('✅ Coordinate validation passed for update:', coords);
      }
      
      const updateData: any = {
        updatedAt: new Date()
      };
      
      // Handle coordinate updates with validation
      if (updates.coordinates) {
        if (updates.coordinates.x !== undefined) {
          updateData.xPosition = Math.round(updates.coordinates.x);
        }
        if (updates.coordinates.y !== undefined) {
          updateData.yPosition = Math.round(updates.coordinates.y);
        }
        if (updates.coordinates.width !== undefined) {
          updateData.width = Math.round(updates.coordinates.width);
        }
        if (updates.coordinates.height !== undefined) {
          updateData.height = Math.round(updates.coordinates.height);
        }
        if (updates.coordinates.pageNumber !== undefined) {
          updateData.pageNumber = updates.coordinates.pageNumber;
        }
      }
      
      // Handle other updates
      if (updates.content !== undefined) updateData.content = updates.content;
      if (updates.isCompleted !== undefined) updateData.isCompleted = updates.isCompleted;
      if (updates.completedBy !== undefined) updateData.completedBy = updates.completedBy;
      if (updates.isCompleted && !updateData.completedAt) {
        updateData.completedAt = new Date();
      }
      
      // First, get the current tag to find its session
      const [currentTag] = await db
        .select()
        .from(documentTags)
        .where(eq(documentTags.id, numericTagId))
        .limit(1);
      
      if (!currentTag) {
        throw new Error('Tag not found');
      }
      
      // Check if session is completed and reactivate it
      const [session] = await db
        .select()
        .from(editorSessions)
        .where(eq(editorSessions.id, currentTag.sessionId))
        .limit(1);
      
      if (session && session.status === 'completed') {
        await db
          .update(editorSessions)
          .set({ 
            status: 'active',
            updatedAt: new Date()
          })
          .where(eq(editorSessions.id, currentTag.sessionId));
        
        console.log(`🔄 Reactivated completed session: ${session.sessionId} (tag update)`);
      }
      
      const [updatedTag] = await db
        .update(documentTags)
        .set(updateData)
        .where(eq(documentTags.id, numericTagId))
        .returning();
      
      if (!updatedTag) {
        throw new Error('Tag not found after update');
      }
      
      // Get display information
      let displayLabel = 'Unknown User';
      let colorCode = '#000000';
      
      if (updatedTag.assignedUserId) {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, updatedTag.assignedUserId))
          .limit(1);
        
        if (user) {
          const tagTypeInfo = this.getTagTypeInfo(updatedTag.tagType);
          displayLabel = `${tagTypeInfo.icon} ${tagTypeInfo.label} - ${user.firstName} ${user.lastName}`;
          colorCode = this.getUserColor(user);
        }
      }
      
      console.log(`✅ Tag updated: ${tagId}`);
      
      // Invalidate cache for this session and document
      if (session) {
        await this.invalidateTagCache(session.sessionId, updatedTag.documentId.toString());
      }
      
      return this.convertToDocumentTagData(updatedTag, displayLabel, colorCode);
      
    } catch (error) {
      console.error('Failed to update tag:', error);
      throw new Error(`Failed to update tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Delete a tag
   */
  static async deleteTag(tagId: string, deletedBy: number): Promise<void> {
    try {
      // Validate tag ID format
      if (!tagId || tagId.trim() === '') {
        throw new Error('Invalid tag ID: empty or null');
      }
      
      // Handle temporary tag IDs (these should not be deleted from DB)
      if (tagId.startsWith('temp_')) {
        console.log('Skipping delete for temporary tag:', tagId);
        throw new Error('Cannot delete temporary tag - tag not yet saved to database');
      }
      
      // Validate that tag ID can be parsed as integer
      const numericTagId = parseInt(tagId);
      if (isNaN(numericTagId) || !isFinite(numericTagId) || numericTagId <= 0) {
        console.error('Invalid tag ID detected:', tagId, 'parsed as:', numericTagId);
        throw new Error('Invalid tag ID: must be a positive integer');
      }
      
      // First, get the current tag to find its session
      const [currentTag] = await db
        .select()
        .from(documentTags)
        .where(eq(documentTags.id, numericTagId))
        .limit(1);
      
      if (!currentTag) {
        throw new Error('Tag not found');
      }
      
      // Check if session is completed and reactivate it
      const [session] = await db
        .select()
        .from(editorSessions)
        .where(eq(editorSessions.id, currentTag.sessionId))
        .limit(1);
      
      if (session && session.status === 'completed') {
        await db
          .update(editorSessions)
          .set({ 
            status: 'active',
            updatedAt: new Date()
          })
          .where(eq(editorSessions.id, currentTag.sessionId));
        
        console.log(`🔄 Reactivated completed session: ${session.sessionId} (tag deletion)`);
      }
      
      const result = await db
        .delete(documentTags)
        .where(eq(documentTags.id, numericTagId))
        .returning();
      
      if (!result.length) {
        throw new Error('Tag not found');
      }
      
      console.log(`✅ Tag deleted: ${tagId} by user ${deletedBy}`);
      
      // Invalidate cache for this session and document
      if (session && currentTag) {
        await this.invalidateTagCache(session.sessionId, currentTag.documentId.toString());
      }
      
    } catch (error) {
      console.error('Failed to delete tag:', error);
      throw new Error(`Failed to delete tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Replace all tags with content (for live signing mode)
   */
  static async replaceAllTagsWithContent(sessionId: string, userId: number): Promise<{ updatedCount: number }> {
    try {
      // Get session first
      const [session] = await db
        .select()
        .from(editorSessions)
        .where(eq(editorSessions.sessionId, sessionId))
        .limit(1);
      
      if (!session) {
        throw new Error('Session not found');
      }
      
      // Get all incomplete tags for the session
      const tags = await db
        .select()
        .from(documentTags)
        .where(and(
          eq(documentTags.sessionId, session.id),
          eq(documentTags.isCompleted, false)
        ));
      
      let updatedCount = 0;
      
      // Update each tag with default content
      for (const tag of tags) {
        const content = await this.getDefaultContentForTag(tag);
        
        await db
          .update(documentTags)
          .set({
            isCompleted: true,
            content,
            completedBy: userId,
            completedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(documentTags.id, tag.id));
        
        updatedCount++;
      }
      
      console.log(`✅ Replaced ${updatedCount} tags with content for session ${sessionId}`);
      
      return { updatedCount };
      
    } catch (error) {
      console.error('Failed to replace tags with content:', error);
      throw new Error(`Failed to replace tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Validate user profile completeness for different tag types
   */
  static async validateUserProfileForTags(userId: number, tagTypes: string[]): Promise<{
    isComplete: boolean;
    missingFields: { tagType: string; field: string; description: string }[];
    userProfile: any;
  }> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      
      if (!user) {
        return {
          isComplete: false,
          missingFields: [{ tagType: 'ALL', field: 'user', description: 'User profile not found' }],
          userProfile: null
        };
      }
      
      const missingFields: { tagType: string; field: string; description: string }[] = [];
      
      // Check each tag type for required profile data
      for (const tagType of tagTypes) {
        switch (tagType) {
          case 'A': // Name tag
            if (!user.firstName && !user.fullName) {
              missingFields.push({
                tagType: 'A',
                field: 'firstName',
                description: 'First name is required for name tags'
              });
            }
            if (!user.lastName && !user.fullName) {
              missingFields.push({
                tagType: 'A',
                field: 'lastName',
                description: 'Last name is required for name tags'
              });
            }
            break;
            
          case 'S': // Signature tag
            if (!user.signatureImage && !user.signatureData && !user.signatureTyped) {
              missingFields.push({
                tagType: 'S',
                field: 'signature',
                description: 'Signature image or typed signature is required'
              });
            }
            break;
            
          case 'I': // Initials tag
            if (!user.initialsImage && !user.initialData && !user.initialsTyped) {
              // Can generate from name if available
              if (!user.firstName || !user.lastName) {
                missingFields.push({
                  tagType: 'I',
                  field: 'initials',
                  description: 'Initials image/typed or first/last name for generation required'
                });
              }
            }
            break;
            
          case 'N': // Commission Number
            if (!user.commissionNumber) {
              missingFields.push({
                tagType: 'N',
                field: 'commissionNumber',
                description: 'Notary commission number is required'
              });
            }
            break;
            
          case 'X': // Commission Expiration
            if (!user.commissionExpiration) {
              missingFields.push({
                tagType: 'X',
                field: 'commissionExpiration',
                description: 'Notary commission expiration date is required'
              });
            }
            break;
            
          case 'O': // Disclosure
            if (!user.disclosure) {
              missingFields.push({
                tagType: 'O',
                field: 'disclosure',
                description: 'Notary disclosure statement is required'
              });
            }
            break;
            
          case 'E': // Notary Seal
            // Additional validation can be added for seal requirements
            break;
            
          // T, D, W don't require specific profile data
        }
      }
      
      return {
        isComplete: missingFields.length === 0,
        missingFields,
        userProfile: {
          id: user.id,
          name: user.fullName || `${user.firstName} ${user.lastName}`,
          email: user.email,
          role: user.role,
          hasSignature: !!(user.signatureImage || user.signatureData || user.signatureTyped),
          hasInitials: !!(user.initialsImage || user.initialData || user.initialsTyped),
          hasCommissionInfo: !!(user.commissionNumber && user.commissionExpiration),
          hasDisclosure: !!user.disclosure
        }
      };
      
    } catch (error) {
      console.error('Failed to validate user profile:', error);
      return {
        isComplete: false,
        missingFields: [{ tagType: 'ALL', field: 'validation', description: 'Profile validation failed' }],
        userProfile: null
      };
    }
  }
  
  // Helper methods
  
  private static convertToDocumentTagData(tag: any, displayLabel: string, colorCode: string): DocumentTagData {
    return {
      id: tag.id.toString(),
      sessionId: tag.sessionId.toString(),
      documentId: tag.documentId.toString(),
      tagType: tag.tagType,
      assignedUserId: tag.assignedUserId?.toString() || '',
      coordinates: {
        x: tag.xPosition,
        y: tag.yPosition,
        width: tag.width,
        height: tag.height,
        pageNumber: tag.pageNumber
      },
      displayLabel,
      colorCode,
      isCompleted: tag.isCompleted,
      content: tag.content,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt
    };
  }
  
  private static getTagTypeInfo(tagType: string) {
    const TAG_TYPE_INFO = {
      'A': { label: 'Name', icon: '✍️' },
      'S': { label: 'Signature', icon: '📝' },
      'I': { label: 'Initials', icon: '🔤' },
      'N': { label: 'Commission #', icon: '🆔' },
      'X': { label: 'Expiration', icon: '📅' },
      'O': { label: 'Disclosure', icon: '📋' },
      'E': { label: 'Seal', icon: '🔖' },
      'W': { label: 'Whiteout', icon: '⬜' },
      'T': { label: 'Text', icon: '📝' },
      'D': { label: 'Date', icon: '📆' },
    } as const;
    
    return TAG_TYPE_INFO[tagType as keyof typeof TAG_TYPE_INFO] || { label: 'Unknown', icon: '❓' };
  }
  
  private static getUserColor(user: any): string {
    // Color mapping based on user role and ID
    const USER_COLORS = {
      notary: '#FF6B6B',     // Coral Red
      admin: '#FF6B6B',      // Coral Red (same as notary)
      signer: '#4ECDC4',     // Turquoise (default for signers)
      witness: '#96CEB4',    // Sage Green
    };
    
    const baseColor = USER_COLORS[user.role as keyof typeof USER_COLORS] || USER_COLORS.signer;
    
    // For signers, vary the color based on user ID to give each signer a different color
    if (user.role === 'signer') {
      const signerColors = [
        '#4ECDC4', // Turquoise
        '#45B7D1', // Sky Blue
        '#96CEB4', // Sage Green
        '#FFEAA7', // Soft Yellow
        '#DDA0DD', // Plum
        '#98D8C8', // Mint
        '#F7DC6F', // Light Gold
        '#BB8FCE'  // Lavender
      ];
      return signerColors[(user.id - 1) % signerColors.length];
    }
    
    return baseColor;
  }
  
  /**
   * Invalidate cache for tag-related endpoints
   */
  private static async invalidateTagCache(sessionId: string, documentId?: string): Promise<void> {
    try {
      const { redisCache } = await import('../../services/redis-cache');
      
      // Invalidate session-wide tag cache
      await redisCache.delPattern(`*:session:${sessionId}:*`);
      
      // Invalidate document-specific tag cache if documentId provided
      if (documentId) {
        await redisCache.delPattern(`*:session:${sessionId}:doc:${documentId}:*`);
      }
      
      console.log(`🗑️ Cache invalidated for session ${sessionId}${documentId ? ` document ${documentId}` : ''}`);
    } catch (error) {
      console.error('Failed to invalidate tag cache:', error);
      // Don't throw error - cache invalidation failure shouldn't break the operation
    }
  }
  
  private static async getDefaultContentForTag(tag: any): Promise<string> {
    try {
      // Get user profile data for content generation
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, tag.assignedUserId))
        .limit(1);
      
      if (!user) {
        console.warn(`User not found for tag ${tag.id}, using fallback content`);
        return this.getFallbackContent(tag.tagType);
      }
      
      // Generate content based on tag type using actual profile data
      switch (tag.tagType) {
        case 'A': // Name tag
          if (user.fullName) return user.fullName;
          if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
          return user.firstName || 'Please enter name';
          
        case 'S': // Signature tag
          // Check for different signature formats based on user preference
          if (user.signatureImage) return user.signatureImage; // Base64 image
          if (user.signatureData) return user.signatureData; // Legacy base64 field
          if (user.signatureTyped) return user.signatureTyped; // Typed signature
          return '[Please upload signature]';
          
        case 'I': // Initials tag
          if (user.initialsImage) return user.initialsImage; // Base64 image
          if (user.initialData) return user.initialData; // Legacy base64 field
          if (user.initialsTyped) return user.initialsTyped; // Typed initials
          // Generate initials from name if none uploaded
          if (user.firstName && user.lastName) {
            return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
          }
          return '[Please upload initials]';
          
        case 'D': // Date tag
          return new Date().toLocaleDateString();
          
        case 'T': // Text tag
          return ''; // Leave blank for user input during session
          
        // Notary-specific tags
        case 'N': // Commission Number
          if (user.commissionNumber) return user.commissionNumber;
          return '[Commission number not set in profile]';
          
        case 'X': // Commission Expiration
          if (user.commissionExpiration) return user.commissionExpiration;
          return '[Expiration date not set in profile]';
          
        case 'O': // Disclosure statement
          if (user.disclosure) return user.disclosure;
          return '[Disclosure statement not set in profile]';
          
        case 'E': // Notary Seal (requires special handling)
          return '[Notary Seal - requires notarization type selection]';
          
        case 'W': // Whiteout
          return ''; // No content needed for whiteout tags
          
        default:
          console.warn(`Unknown tag type: ${tag.tagType}`);
          return '';
      }
      
    } catch (error) {
      console.error('Failed to get user profile content for tag:', error);
      return this.getFallbackContent(tag.tagType);
    }
  }
  
  private static getFallbackContent(tagType: string): string {
    // Fallback content when user profile data is unavailable
    switch (tagType) {
      case 'A': return '[Name required]';
      case 'S': return '[Signature required]';
      case 'I': return '[Initials required]';
      case 'D': return new Date().toLocaleDateString();
      case 'T': return '';
      case 'N': return '[Commission # required]';
      case 'X': return '[Expiration required]';
      case 'O': return '[Disclosure required]';
      case 'E': return '[Seal required]';
      case 'W': return '';
      default: return '';
    }
  }
}

export default TagService; 