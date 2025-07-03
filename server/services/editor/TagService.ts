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

      // Get session to verify it exists
      const [session] = await db
        .select()
        .from(editorSessions)
        .where(eq(editorSessions.sessionId, request.sessionId))
        .limit(1);
      
      if (!session) {
        throw new Error('Session not found');
      }
      
      // Get assigned user info for display
      const [assignedUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, parseInt(request.assignedUserId)))
        .limit(1);
      
      if (!assignedUser) {
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
      
      const tags = await db
        .select()
        .from(documentTags)
        .where(eq(documentTags.sessionId, session.id));
      
      // Convert each tag and add display information
      const convertedTags = [];
      for (const tag of tags) {
        // Get user info for display
        let displayLabel = 'Unknown User';
        let colorCode = '#000000';
        
        if (tag.assignedUserId) {
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, tag.assignedUserId))
            .limit(1);
          
          if (user) {
            const tagTypeInfo = this.getTagTypeInfo(tag.tagType);
            displayLabel = `${tagTypeInfo.icon} ${tagTypeInfo.label} - ${user.firstName} ${user.lastName}`;
            colorCode = this.getUserColor(user);
          }
        }
        
        convertedTags.push(this.convertToDocumentTagData(tag, displayLabel, colorCode));
      }
      
      return convertedTags;
      
    } catch (error) {
      console.error('Failed to get session tags:', error);
      throw new Error(`Failed to get tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Update a tag
   */
  static async updateTag(tagId: string, updates: any): Promise<DocumentTagData> {
    try {
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
        updateData.xPosition = Math.round(updates.coordinates.x);
        updateData.yPosition = Math.round(updates.coordinates.y);
        updateData.width = Math.round(updates.coordinates.width);
        updateData.height = Math.round(updates.coordinates.height);
        updateData.pageNumber = updates.coordinates.pageNumber;
      }
      
      // Handle other updates
      if (updates.content !== undefined) updateData.content = updates.content;
      if (updates.isCompleted !== undefined) updateData.isCompleted = updates.isCompleted;
      if (updates.completedBy !== undefined) updateData.completedBy = updates.completedBy;
      if (updates.isCompleted && !updateData.completedAt) {
        updateData.completedAt = new Date();
      }
      
      const [updatedTag] = await db
        .update(documentTags)
        .set(updateData)
        .where(eq(documentTags.id, parseInt(tagId)))
        .returning();
      
      if (!updatedTag) {
        throw new Error('Tag not found');
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
      const result = await db
        .delete(documentTags)
        .where(eq(documentTags.id, parseInt(tagId)))
        .returning();
      
      if (!result.length) {
        throw new Error('Tag not found');
      }
      
      console.log(`✅ Tag deleted: ${tagId} by user ${deletedBy}`);
      
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
        const content = this.getDefaultContentForTag(tag);
        
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
  
  private static getDefaultContentForTag(tag: any): string {
    // Generate default content based on tag type
    switch (tag.tagType) {
      case 'A': // Name
        return 'John Doe'; // Would come from user profile
      case 'S': // Signature
        return '[Signature Image]'; // Would be replaced with actual signature
      case 'I': // Initials
        return '[Initials Image]'; // Would be replaced with actual initials
      case 'D': // Date
        return new Date().toLocaleDateString();
      case 'T': // Text
        return 'Sample text';
      case 'N': // Commission Number
        return 'Commission #123456'; // Would come from notary profile
      case 'X': // Expiration
        return '12/31/2025'; // Would come from notary profile
      case 'O': // Disclosure
        return 'Notary disclosure statement...'; // Would come from notary profile
      default:
        return '';
    }
  }
}

export default TagService; 