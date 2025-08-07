import { Express } from 'express';
import { verifyToken } from '../auth';
import { db } from '../db';
import { documentTags } from '../../shared/schema';
import { eq, inArray } from 'drizzle-orm';

/**
 * Batch Update Routes: Strategic API calls with smart batching
 * Based on Google Docs batch request patterns for optimal performance
 */

export function registerBatchUpdateRoutes(app: Express) {
  
  // Batch update multiple tags in a single API call
  app.put('/api/editor/session/:sessionId/batch-update', verifyToken, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const { updates } = req.body;
      
      if (!updates || !Array.isArray(updates)) {
        return res.status(400).json({ 
          message: 'Updates array is required',
          error: 'invalid_request'
        });
      }
      
      console.log(`💾 Batch update request: ${updates.length} tags in session ${sessionId}`);
      
      const results = [];
      const errors = [];
      
      // Process each update in the batch
      for (const update of updates) {
        try {
          const { tagId, coordinates, content, priority, reason } = update;
          
          if (!tagId) {
            errors.push({ tagId: 'unknown', error: 'tagId is required' });
            continue;
          }
          
          // Build update object
          const updateData: any = {
            updatedBy: req.user.id,
            updatedAt: new Date()
          };
          
          // Add coordinates if provided
          if (coordinates) {
            updateData.coordinates = coordinates;
          }
          
          // Add content if provided  
          if (content !== undefined) {
            updateData.content = content;
            updateData.isCompleted = content.trim().length > 0;
            if (updateData.isCompleted) {
              updateData.completedAt = new Date();
              updateData.completedBy = req.user.id;
            }
          }
          
          // Update tag in database
          const [updatedTag] = await db
            .update(documentTags)
            .set(updateData)
            .where(eq(documentTags.id, parseInt(tagId)))
            .returning();
          
          if (!updatedTag) {
            errors.push({ tagId, error: 'Tag not found' });
            continue;
          }
          
          results.push({
            tagId,
            success: true,
            reason,
            priority,
            updatedAt: updateData.updatedAt
          });
          
          console.log(`✅ Updated tag ${tagId} (${reason}, ${priority})`);
          
        } catch (updateError) {
          console.error(`❌ Failed to update tag ${update.tagId}:`, updateError);
          errors.push({ 
            tagId: update.tagId, 
            error: updateError instanceof Error ? updateError.message : 'Update failed' 
          });
        }
      }
      
      // Broadcast batch update via WebSocket
      try {
        const { WebSocketService } = await import('../services/editor/WebSocketService');
        
        const syncMessage = {
          type: 'batch_update_completed',
          payload: {
            sessionId,
            updates: results,
            totalUpdates: results.length,
            errors: errors.length
          },
          userId: req.user.id.toString(),
          timestamp: Date.now()
        };
        
        WebSocketService.broadcastToSession(sessionId, syncMessage);
        console.log(`🔄 Batch update broadcasted: ${results.length} successful, ${errors.length} errors`);
        
      } catch (wsError) {
        console.warn('Failed to broadcast batch update via WebSocket:', wsError);
        // Don't fail the request if WebSocket broadcast fails
      }
      
      // Return results
      res.json({
        success: true,
        message: `Batch update completed: ${results.length} successful, ${errors.length} failed`,
        results: {
          successful: results,
          errors,
          totalProcessed: updates.length,
          successCount: results.length,
          errorCount: errors.length
        }
      });
      
    } catch (error) {
      console.error('Batch update error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Batch update failed',
        error: 'batch_update_failed'
      });
    }
  });
  
  // Get batch update statistics
  app.get('/api/editor/session/:sessionId/batch-stats', verifyToken, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      
      // Get recent update statistics
      const recentUpdates = await db
        .select({
          id: documentTags.id,
          updatedAt: documentTags.updatedAt,
          updatedBy: documentTags.updatedBy
        })
        .from(documentTags)
        .where(eq(documentTags.sessionId, parseInt(sessionId)))
        .orderBy(documentTags.updatedAt)
        .limit(100);
      
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const recentCount = recentUpdates.filter(update => 
        update.updatedAt && update.updatedAt > oneHourAgo
      ).length;
      
      res.json({
        success: true,
        stats: {
          totalTags: recentUpdates.length,
          recentUpdates: recentCount,
          lastUpdateTime: recentUpdates[0]?.updatedAt || null,
          sessionId
        }
      });
      
    } catch (error) {
      console.error('Batch stats error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to get batch stats',
        error: 'batch_stats_failed'
      });
    }
  });
}

export default registerBatchUpdateRoutes;