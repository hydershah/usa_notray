import type { Express } from "express";
import { verifyToken } from "../auth";
import { db } from "../db";
import { documentTags, editorSessions, users } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { textTagContentDeduplication, tagPositionDeduplication } from "../middleware/request-deduplication";

/**
 * Enhanced Text Tag Routes
 * Handles streamlined text placement, immediate editing, and font management
 */
export function registerTextTagRoutes(app: Express) {

  // Place text tag with immediate edit mode
  app.post('/api/editor/session/:sessionId/place-text-tag', verifyToken, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const { documentId, coordinates, assignedUserId, immediateEdit = true, fontSize } = req.body;
      
      if (!documentId || !coordinates || !assignedUserId) {
        return res.status(400).json({ message: 'Missing required fields: documentId, coordinates, assignedUserId' });
      }

      // Validate coordinates
      const coords = coordinates;
      if (isNaN(coords.x) || isNaN(coords.y) || isNaN(coords.width) || isNaN(coords.height) || isNaN(coords.pageNumber)) {
        return res.status(400).json({ message: 'Invalid coordinates: all values must be numbers' });
      }

      // Get session to verify it exists
      const [session] = await db
        .select()
        .from(editorSessions)
        .where(eq(editorSessions.sessionId, sessionId))
        .limit(1);
      
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }

      // Get assigned user info
      const [assignedUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, parseInt(assignedUserId)))
        .limit(1);
      
      if (!assignedUser) {
        return res.status(404).json({ message: 'Assigned user not found' });
      }

      // Generate display label and color for text tag
      const displayLabel = `✏️ Text - ${assignedUser.firstName} ${assignedUser.lastName}`;
      const colorCode = getUserColor(assignedUser);

      // ✅ FIX: Use provided font size from client, fallback to 16px if not provided
      const defaultFontSize = fontSize && !isNaN(parseInt(fontSize)) ? parseInt(fontSize) : 16;
      
      // Create text tag with default styling in contentData
      const defaultStyling = {
        type: 'text',
        value: '', // Start with empty content
        fontSize: defaultFontSize, // Use client-provided font size or 16px default
        fontFamily: 'Arial', // Default font family
        textColor: '#000000', // Default text color
        immediateEdit: immediateEdit, // Flag for immediate editing
        timestamp: new Date().toISOString()
      };

      console.log('🔍 DEBUG: Server received coordinates:', coordinates);
      console.log('🔍 DEBUG: Server received width:', coordinates.width);
      console.log('🔍 DEBUG: Server received height:', coordinates.height);
      
      const tagData = {
        documentId: parseInt(documentId),
        sessionId: session.id,
        tagType: 'T', // Text tag type
        assignedUserId: parseInt(assignedUserId),
        pageNumber: coordinates.pageNumber,
        xPosition: Math.round(coordinates.x),
        yPosition: Math.round(coordinates.y),
        width: Math.round(coordinates.width),
        height: Math.round(coordinates.height),
        isCompleted: false,
        content: '', // Start with empty content
        contentType: 'text',
        contentData: JSON.stringify(defaultStyling), // Store styling in JSON field
        createdBy: req.user.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const [createdTag] = await db
        .insert(documentTags)
        .values(tagData)
        .returning();

      console.log(`✅ Text tag placed for ${assignedUser.firstName} ${assignedUser.lastName} at page ${coordinates.pageNumber}`);

      // Parse contentData for response
      let parsedContentData = defaultStyling;
      try {
        parsedContentData = JSON.parse(createdTag.contentData || '{}');
      } catch (e) {
        console.warn('Could not parse contentData, using defaults');
      }

      // 🚀 REAL-TIME SYNC: Broadcast text tag placement to all session participants
      try {
        const { WebSocketService } = await import('../services/editor/WebSocketService');
        
        const syncMessage = {
          type: 'tag_placed',
          payload: { 
            tag: {
              id: createdTag.id.toString(),
              sessionId: session.id,
              documentId: createdTag.documentId,
              tagType: 'T',
              assignedUserId: createdTag.assignedUserId,
              coordinates: {
                x: createdTag.xPosition,
                y: createdTag.yPosition,
                width: createdTag.width,
                height: createdTag.height,
                pageNumber: createdTag.pageNumber
              },
              displayLabel: `✏️ Text - ${assignedUser.firstName} ${assignedUser.lastName}`,
              colorCode: colorCode,
              isCompleted: false,
              content: createdTag.content || '',
              contentType: 'text',
              contentData: createdTag.contentData,
              createdAt: createdTag.createdAt,
              updatedAt: createdTag.updatedAt
            }
          },
          userId: req.user.id.toString(),
          sessionId: session.sessionId,
          timestamp: Date.now()
        };

        WebSocketService.broadcastToSession(session.sessionId, syncMessage);
        console.log(`🔄 Text tag placement broadcasted for new tag ${createdTag.id} in session ${session.sessionId}`);
        
      } catch (wsError) {
        console.warn('Failed to broadcast text tag placement via WebSocket:', wsError);
        // Don't fail the request if WebSocket broadcast fails
      }

      res.json({
        success: true,
        tag: {
          id: createdTag.id.toString(),
          sessionId: session.sessionId,
          documentId: createdTag.documentId.toString(),
          tagType: createdTag.tagType,
          assignedUserId: createdTag.assignedUserId,
          coordinates: {
            x: createdTag.xPosition,
            y: createdTag.yPosition,
            width: createdTag.width,
            height: createdTag.height,
            pageNumber: createdTag.pageNumber
          },
          displayLabel,
          colorCode,
          isCompleted: createdTag.isCompleted,
          content: createdTag.content,
                     fontSize: parsedContentData.fontSize || 16,
          fontFamily: parsedContentData.fontFamily || 'Arial',
          textColor: parsedContentData.textColor || '#000000',
          immediateEdit: parsedContentData.immediateEdit || true,
          contentData: parsedContentData,
          createdAt: createdTag.createdAt,
          updatedAt: createdTag.updatedAt
        },
        message: 'Text tag placed successfully - ready for immediate editing'
      });

    } catch (error) {
      console.error('Place text tag error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to place text tag',
        error: 'text_tag_place_failed'
      });
    }
  });

  // Update text content (save on Enter key press)
  app.put('/api/editor/session/:sessionId/text-tag/:tagId/content', verifyToken, textTagContentDeduplication, async (req: any, res) => {
    try {
      const { sessionId, tagId } = req.params;
      const { content, fontSize, fontFamily, textColor } = req.body;
      
      if (content === undefined || content === null) {
        return res.status(400).json({ message: 'Content is required' });
      }

      // Validate tagId
      const numericTagId = parseInt(tagId);
      if (isNaN(numericTagId)) {
        return res.status(400).json({ message: 'Invalid tag ID' });
      }

      // Enhanced content data with styling
      const contentData = {
        type: 'text',
        value: content.toString(),
                 fontSize: fontSize || 16,
        fontFamily: fontFamily || 'Arial',
        textColor: textColor || '#000000',
        timestamp: new Date().toISOString()
      };

      // Update tag with content and styling
      const updateData: any = {
        content: content.toString(),
        contentType: 'text',
        contentData: JSON.stringify(contentData),
        isCompleted: content.toString().trim().length > 0, // Completed if has content
        updatedBy: req.user.id,
        updatedAt: new Date()
      };

      // If completing the tag, add completion info
      if (updateData.isCompleted) {
        updateData.completedBy = req.user.id;
        updateData.completedAt = new Date();
      }

      const [updatedTag] = await db
        .update(documentTags)
        .set(updateData)
        .where(eq(documentTags.id, numericTagId))
        .returning();

      if (!updatedTag) {
        return res.status(404).json({ message: 'Tag not found' });
      }

      // Get user info for response
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, updatedTag.assignedUserId))
        .limit(1);

      const displayLabel = user ? `✏️ Text - ${user.firstName} ${user.lastName}` : 'Text Tag';
      const colorCode = user ? getUserColor(user) : '#000000';

      // Parse updated contentData for response
      let responseContentData = contentData;
      try {
        responseContentData = JSON.parse(updatedTag.contentData || '{}');
      } catch (e) {
        console.warn('Could not parse updated contentData');
      }

      console.log(`✅ Text content updated for tag ${tagId}: "${content}"`);

      // 🎯 SMART CACHE: Invalidate only content-related caches
      try {
        const { smartCache } = await import('../services/smart-cache-invalidation');
        await smartCache.onTagContentChanged(sessionId, updatedTag.documentId.toString(), tagId);
      } catch (cacheError) {
        console.warn('Smart cache invalidation failed for text content:', cacheError);
      }

      // 🚀 REAL-TIME SYNC: Broadcast text content update to all session participants
      try {
        const { WebSocketService } = await import('../services/editor/WebSocketService');
        
        const syncMessage = {
          type: 'tag_content_updated',
          payload: {
            tagId: updatedTag.id.toString(),
            tagType: 'T', // Text tag type
            content: updatedTag.content,
            contentType: 'text',
            contentData: responseContentData,
            isCompleted: updatedTag.isCompleted,
            completedBy: req.user.id,
            completedAt: updatedTag.completedAt,
            updatedBy: req.user.id,
            source: 'text_input'
          },
          userId: req.user.id.toString(),
          sessionId,
          timestamp: Date.now()
        };

        WebSocketService.broadcastToSession(sessionId, syncMessage);
        console.log(`🔄 Text content update broadcasted for tag ${tagId} in session ${sessionId}`);
        
      } catch (wsError) {
        console.warn('Failed to broadcast text content update via WebSocket:', wsError);
        // Don't fail the request if WebSocket broadcast fails
      }

      res.json({
        success: true,
        tag: {
          id: updatedTag.id.toString(),
          content: updatedTag.content,
          fontSize: responseContentData.fontSize || 12,
          fontFamily: responseContentData.fontFamily || 'Arial',
          textColor: responseContentData.textColor || '#000000',
          isCompleted: updatedTag.isCompleted,
          displayLabel,
          colorCode,
          contentData: responseContentData,
          updatedAt: updatedTag.updatedAt
        },
        message: 'Text content saved successfully'
      });

    } catch (error) {
      console.error('Update text content error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to update text content',
        error: 'text_content_update_failed'
      });
    }
  });

  // Update font size from properties panel
  app.put('/api/editor/session/:sessionId/text-tag/:tagId/font-size', verifyToken, async (req: any, res) => {
    try {
      const { sessionId, tagId } = req.params;
      const { fontSize, fontFamily, textColor } = req.body;
      
      if (!fontSize) {
        return res.status(400).json({ message: 'Font size is required' });
      }

      const numericTagId = parseInt(tagId);
      const numericFontSize = parseInt(fontSize);
      
      if (isNaN(numericTagId) || isNaN(numericFontSize)) {
        return res.status(400).json({ message: 'Invalid tag ID or font size' });
      }

      if (numericFontSize < 6 || numericFontSize > 72) {
        return res.status(400).json({ message: 'Font size must be between 6 and 72' });
      }

      // Get current tag to update contentData
      const [currentTag] = await db
        .select()
        .from(documentTags)
        .where(eq(documentTags.id, numericTagId))
        .limit(1);

      if (!currentTag) {
        return res.status(404).json({ message: 'Tag not found' });
      }

      // Parse existing contentData and update styling
      let contentData: { type: string; value: string; fontSize: number; fontFamily: string; textColor: string; timestamp?: string } = {
        type: 'text',
        value: currentTag.content || '',
        fontSize: 16,
        fontFamily: 'Arial',
        textColor: '#000000'
      };

      if (currentTag.contentData) {
        try {
          contentData = { ...contentData, ...JSON.parse(currentTag.contentData) };
        } catch (e) {
          console.warn('Could not parse existing contentData, using defaults');
        }
      }

      // Update styling
      contentData.fontSize = numericFontSize;
      if (fontFamily) contentData.fontFamily = fontFamily;
      if (textColor) contentData.textColor = textColor;
      contentData.timestamp = new Date().toISOString();

      // Update tag styling via contentData
      const updateData: any = {
        contentData: JSON.stringify(contentData),
        updatedBy: req.user.id,
        updatedAt: new Date()
      };

      const [updatedTag] = await db
        .update(documentTags)
        .set(updateData)
        .where(eq(documentTags.id, numericTagId))
        .returning();

      if (!updatedTag) {
        return res.status(404).json({ message: 'Tag not found' });
      }

      console.log(`✅ Font size updated for tag ${tagId}: ${numericFontSize}px`);

      res.json({
        success: true,
        tag: {
          id: updatedTag.id.toString(),
          fontSize: contentData.fontSize,
          fontFamily: contentData.fontFamily,
          textColor: contentData.textColor,
          contentData: contentData,
          updatedAt: updatedTag.updatedAt
        },
        message: 'Font styling updated successfully'
      });

    } catch (error) {
      console.error('Update font size error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to update font size',
        error: 'font_size_update_failed'
      });
    }
  });

  // Update text tag position
  app.put('/api/editor/session/:sessionId/text-tag/:tagId/position', verifyToken, tagPositionDeduplication, async (req: any, res) => {
    try {
      const { sessionId, tagId } = req.params;
      const { x, y } = req.body;
      
      if (x === undefined || y === undefined || isNaN(x) || isNaN(y)) {
        return res.status(400).json({ message: 'Valid x and y coordinates are required' });
      }

      const numericTagId = parseInt(tagId);
      if (isNaN(numericTagId)) {
        return res.status(400).json({ message: 'Invalid tag ID' });
      }

      // Update tag position
      const updateData = {
        xPosition: Math.round(x),
        yPosition: Math.round(y),
        updatedBy: req.user.id,
        updatedAt: new Date()
      };

      const [updatedTag] = await db
        .update(documentTags)
        .set(updateData)
        .where(and(
          eq(documentTags.id, numericTagId),
          eq(documentTags.tagType, 'T') // Ensure it's a text tag
        ))
        .returning();

      if (!updatedTag) {
        return res.status(404).json({ message: 'Text tag not found' });
      }

      console.log(`✅ Text tag position updated: ${tagId} -> (${x}, ${y})`);

      // 🎯 SMART CACHE: Invalidate only position-related caches
      try {
        const { smartCache } = await import('../services/smart-cache-invalidation');
        await smartCache.onTagPositionChanged(sessionId, updatedTag.documentId.toString(), tagId);
      } catch (cacheError) {
        console.warn('Smart cache invalidation failed for text position:', cacheError);
      }

      // 🚀 REAL-TIME SYNC: Broadcast text tag position update to all session participants
      try {
        const { WebSocketService } = await import('../services/editor/WebSocketService');
        
                 const syncMessage = {
           type: 'text_input_position_updated',
           payload: {
             textInputId: updatedTag.id.toString(),
             coordinates: {
               x: updatedTag.xPosition,
               y: updatedTag.yPosition,
               width: updatedTag.width,
               height: updatedTag.height,
               pageNumber: updatedTag.pageNumber
             },
             updatedBy: req.user.id,
             updatedByName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || undefined
           },
           userId: req.user.id.toString(),
           sessionId,
           timestamp: Date.now()
         };

        WebSocketService.broadcastToSession(sessionId, syncMessage);
        console.log(`🔄 Text tag position update broadcasted for tag ${tagId} in session ${sessionId}`);
        
      } catch (wsError) {
        console.warn('Failed to broadcast text tag position update via WebSocket:', wsError);
        // Don't fail the request if WebSocket broadcast fails
      }

      res.json({
        success: true,
        tag: {
          id: updatedTag.id.toString(),
          coordinates: {
            x: updatedTag.xPosition,
            y: updatedTag.yPosition,
            width: updatedTag.width,
            height: updatedTag.height,
            pageNumber: updatedTag.pageNumber
          },
          updatedAt: updatedTag.updatedAt
        },
        message: 'Text tag position updated successfully'
      });

    } catch (error) {
      console.error('Update text tag position error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to update position',
        error: 'text_tag_position_update_failed'
      });
    }
  });

  // Update text tag dimensions (position and size)
  app.put('/api/editor/session/:sessionId/text-tag/:tagId/dimensions', verifyToken, async (req: any, res) => {
    try {
      const { sessionId, tagId } = req.params;
      const { x, y, width, height } = req.body;
      
      if (x === undefined || y === undefined || width === undefined || height === undefined ||
          isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height)) {
        return res.status(400).json({ message: 'Valid x, y, width, and height are required' });
      }

      const numericTagId = parseInt(tagId);
      if (isNaN(numericTagId)) {
        return res.status(400).json({ message: 'Invalid tag ID' });
      }

      // Validate dimensions
      if (width <= 0 || height <= 0) {
        return res.status(400).json({ message: 'Width and height must be positive numbers' });
      }

      // Update tag dimensions and position
      const updateData = {
        xPosition: Math.round(x),
        yPosition: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
        updatedBy: req.user.id,
        updatedAt: new Date()
      };

      const [updatedTag] = await db
        .update(documentTags)
        .set(updateData)
        .where(and(
          eq(documentTags.id, numericTagId),
          eq(documentTags.tagType, 'T') // Ensure it's a text tag
        ))
        .returning();

      if (!updatedTag) {
        return res.status(404).json({ message: 'Text tag not found' });
      }

      console.log(`✅ Text tag dimensions updated: ${tagId} -> (${x}, ${y}, ${width}x${height})`);

      // 🚀 REAL-TIME SYNC: Broadcast text tag dimensions update to all session participants
      try {
        const { WebSocketService } = await import('../services/editor/WebSocketService');
        
        const syncMessage = {
          type: 'text_input_position_updated',
          payload: {
            textInputId: updatedTag.id.toString(),
            coordinates: {
              x: updatedTag.xPosition,
              y: updatedTag.yPosition,
              width: updatedTag.width,
              height: updatedTag.height,
              pageNumber: updatedTag.pageNumber
            },
            updatedBy: req.user.id,
            updatedByName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || undefined
          },
          userId: req.user.id.toString(),
          sessionId,
          timestamp: Date.now()
        };

        WebSocketService.broadcastToSession(sessionId, syncMessage);
        console.log(`🔄 Text tag dimensions update broadcasted for tag ${tagId} in session ${sessionId}`);
        
      } catch (wsError) {
        console.warn('Failed to broadcast text tag dimensions update via WebSocket:', wsError);
        // Don't fail the request if WebSocket broadcast fails
      }

      res.json({
        success: true,
        tag: {
          id: updatedTag.id.toString(),
          coordinates: {
            x: updatedTag.xPosition,
            y: updatedTag.yPosition,
            width: updatedTag.width,
            height: updatedTag.height,
            pageNumber: updatedTag.pageNumber
          },
          updatedAt: updatedTag.updatedAt
        },
        message: 'Text tag dimensions updated successfully'
      });

    } catch (error) {
      console.error('Update text tag dimensions error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to update dimensions',
        error: 'text_tag_dimensions_update_failed'
      });
    }
  });

  // Create whiteout overlay (immediate white rectangle, not a tag)
  app.post('/api/editor/session/:sessionId/whiteout-overlay', verifyToken, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const { documentId, coordinates } = req.body;
      
      if (!documentId || !coordinates) {
        return res.status(400).json({ message: 'Missing required fields: documentId, coordinates' });
      }

      // Validate coordinates
      const coords = coordinates;
      if (isNaN(coords.x) || isNaN(coords.y) || isNaN(coords.width) || isNaN(coords.height) || isNaN(coords.pageNumber)) {
        return res.status(400).json({ message: 'Invalid coordinates: all values must be numbers' });
      }

      // Get session to verify it exists
      const [session] = await db
        .select()
        .from(editorSessions)
        .where(eq(editorSessions.sessionId, sessionId))
        .limit(1);
      
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }

      // Create whiteout overlay as a special completed tag
      const whiteoutData = {
        documentId: parseInt(documentId),
        sessionId: session.id,
        tagType: 'W',
        assignedUserId: req.user.id, // Current user
        pageNumber: coordinates.pageNumber,
        xPosition: Math.round(coordinates.x),
        yPosition: Math.round(coordinates.y),
        width: Math.round(coordinates.width),
        height: Math.round(coordinates.height),
        isCompleted: true, // Whiteout is immediately completed
        content: 'WHITEOUT',
        contentType: 'whiteout',
        contentData: JSON.stringify({
          type: 'whiteout',
          value: 'WHITEOUT',
          timestamp: new Date().toISOString()
        }),
        createdBy: req.user.id,
        completedBy: req.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date()
      };

      const [createdOverlay] = await db
        .insert(documentTags)
        .values(whiteoutData)
        .returning();

      console.log(`✅ Whiteout overlay created at page ${coordinates.pageNumber}: (${coordinates.x}, ${coordinates.y}, ${coordinates.width}x${coordinates.height})`);

      res.json({
        success: true,
        overlay: {
          id: createdOverlay.id.toString(),
          documentId: createdOverlay.documentId.toString(),
          coordinates: {
            x: createdOverlay.xPosition,
            y: createdOverlay.yPosition,
            width: createdOverlay.width,
            height: createdOverlay.height,
            pageNumber: createdOverlay.pageNumber
          },
          sessionId: sessionId,
          createdAt: createdOverlay.createdAt
        },
        message: 'Whiteout overlay created successfully'
      });

    } catch (error) {
      console.error('Create whiteout overlay error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to create whiteout overlay',
        error: 'whiteout_overlay_creation_failed'
      });
    }
  });

  // Get text tag details (for editing)
  app.get('/api/editor/session/:sessionId/text-tag/:tagId', verifyToken, async (req: any, res) => {
    try {
      const { sessionId, tagId } = req.params;
      
      const numericTagId = parseInt(tagId);
      if (isNaN(numericTagId)) {
        return res.status(400).json({ message: 'Invalid tag ID' });
      }

      const [tag] = await db
        .select()
        .from(documentTags)
        .where(and(
          eq(documentTags.id, numericTagId),
          eq(documentTags.tagType, 'T') // Ensure it's a text tag
        ))
        .limit(1);

      if (!tag) {
        return res.status(404).json({ message: 'Text tag not found' });
      }

      // Get user info
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, tag.assignedUserId))
        .limit(1);

      const displayLabel = user ? `✏️ Text - ${user.firstName} ${user.lastName}` : 'Text Tag';
      const colorCode = user ? getUserColor(user) : '#000000';

      // Parse contentData if available
      let contentData = null;
      if (tag.contentData) {
        try {
          contentData = JSON.parse(tag.contentData);
        } catch (e) {
          console.warn('Could not parse contentData');
        }
      }

      res.json({
        success: true,
        tag: {
          id: tag.id.toString(),
          content: tag.content || '',
          fontSize: contentData?.fontSize || 12,
          fontFamily: contentData?.fontFamily || 'Arial',
          textColor: contentData?.textColor || '#000000',
          isCompleted: tag.isCompleted,
          displayLabel,
          colorCode,
          coordinates: {
            x: tag.xPosition,
            y: tag.yPosition,
            width: tag.width,
            height: tag.height,
            pageNumber: tag.pageNumber
          },
          contentData
        }
      });

    } catch (error) {
      console.error('Get text tag error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to get text tag',
        error: 'text_tag_get_failed'
      });
    }
  });

  // Delete text tag
  app.delete('/api/editor/session/:sessionId/text-tag/:tagId', verifyToken, async (req: any, res) => {
    try {
      const { sessionId, tagId } = req.params;
      
      const numericTagId = parseInt(tagId);
      if (isNaN(numericTagId)) {
        return res.status(400).json({ message: 'Invalid tag ID' });
      }

      // Verify it's a text tag before deleting
      const [tag] = await db
        .select()
        .from(documentTags)
        .where(and(
          eq(documentTags.id, numericTagId),
          eq(documentTags.tagType, 'T')
        ))
        .limit(1);

      if (!tag) {
        return res.status(404).json({ message: 'Text tag not found' });
      }

      // Delete the tag
      await db
        .delete(documentTags)
        .where(eq(documentTags.id, numericTagId));

      console.log(`✅ Text tag deleted: ${tagId}`);

      // 🚀 REAL-TIME SYNC: Broadcast text tag deletion to all session participants
      try {
        const { WebSocketService } = await import('../services/editor/WebSocketService');
        
        const syncMessage = {
          type: 'tag_deleted',
          payload: { tagId: tagId.toString() },
          userId: req.user.id.toString(),
          sessionId,
          timestamp: Date.now()
        };

        WebSocketService.broadcastToSession(sessionId, syncMessage);
        console.log(`🔄 Text tag deletion broadcasted for tag ${tagId} in session ${sessionId}`);
        
      } catch (wsError) {
        console.warn('Failed to broadcast text tag deletion via WebSocket:', wsError);
        // Don't fail the request if WebSocket broadcast fails
      }

      res.json({
        success: true,
        message: 'Text tag deleted successfully'
      });

    } catch (error) {
      console.error('Delete text tag error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to delete text tag',
        error: 'text_tag_delete_failed'
      });
    }
  });
}

// Helper function to generate user color (you might want to move this to a shared utility)
function getUserColor(user: any): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA'
  ];
  
  // Generate consistent color based on user ID
  const colorIndex = (user.id || 0) % colors.length;
  return colors[colorIndex];
} 