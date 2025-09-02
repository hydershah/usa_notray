/**
 * Professional Text Input API Routes
 * RESTful endpoints for text input management with validation and error handling
 */

import type { Express, Request, Response } from 'express';
import { TextInputService } from '../services/textInput/TextInputService';
import type { 
  TextInputCreateRequest, 
  TextInputUpdateRequest 
} from '../../client/src/types/textInput';
import { WebSocketService } from '../services/editor/WebSocketService';
import type { AuthUser } from '../auth';

// Request type definitions
interface CreateTextInputRequest extends Request {
  body: TextInputCreateRequest & {
    createdBy?: number;
  };
  user?: AuthUser;
}

interface UpdateTextInputRequest extends Request {
  params: {
    textInputId: string;
  };
  body: TextInputUpdateRequest & {
    updatedBy?: number;
  };
  user?: AuthUser;
}

interface DeleteTextInputRequest extends Request {
  params: {
    textInputId: string;
  };
  user?: AuthUser;
}

interface GetTextInputsRequest extends Request {
  params: {
    sessionId: string;
  };
}

interface GetTextInputRequest extends Request {
  params: {
    textInputId: string;
  };
}

interface BulkUpdateRequest extends Request {
  body: {
    updates: Array<{
      textInputId: string;
      updates: TextInputUpdateRequest;
    }>;
    updatedBy?: number;
  };
}

export function registerTextInputRoutes(app: Express) {
  
  /**
   * Create a new text input
   * POST /api/text-inputs
   */
  app.post('/api/text-inputs', async (request: CreateTextInputRequest, response: Response) => {
    try {
      const { body } = request;
      
      // Validate required fields
      if (!body.sessionId || !body.documentId || !body.coordinates || !body.assignedUserId) {
        return response.status(400).json({
          success: false,
          error: 'Missing required fields: sessionId, documentId, coordinates, assignedUserId'
        });
      }

      // Use authenticated user ID if available
      const createdBy = body.createdBy || body.assignedUserId;

      const result = await TextInputService.createTextInput({
        ...body,
        assignedUserId: createdBy,
      });

      if (!result.success) {
        return response.status(result.code || 500).json(result);
      }

      // Broadcast to WebSocket clients
      if (result.data) {
              WebSocketService.broadcastToSession(body.sessionId, {
        type: 'text_input_created',
        payload: result.data,
        userId: createdBy.toString(),
        sessionId: body.sessionId,
        timestamp: Date.now(),
      });
      }

      console.log(`✅ Text input created via API: ${result.data?.id}`);
      return response.status(201).json(result);

    } catch (error) {
      console.error('❌ Error in POST /api/text-inputs:', error);
      return response.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Get all text inputs for a session
   * GET /api/text-inputs/session/:sessionId
   */
  app.get('/api/text-inputs/session/:sessionId', async (request: GetTextInputsRequest, response: Response) => {
    try {
      const { sessionId } = request.params;

      const result = await TextInputService.getTextInputsForSession(sessionId);

      if (!result.success) {
        return response.status(result.code || 500).json(result);
      }

      return response.json(result);

    } catch (error) {
      console.error('❌ Error in GET /api/text-inputs/session/:sessionId:', error);
      return response.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Get a specific text input by ID
   * GET /api/text-inputs/:textInputId
   */
  app.get('/api/text-inputs/:textInputId', async (request: GetTextInputRequest, response: Response) => {
    try {
      const { textInputId } = request.params;

      const result = await TextInputService.getTextInputById(textInputId);

      if (!result.success) {
        return response.status(result.code || 500).json(result);
      }

      return response.json(result);

    } catch (error) {
      console.error('❌ Error in GET /api/text-inputs/:textInputId:', error);
      return response.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Update a text input
   * PUT /api/text-inputs/:textInputId
   */
  app.put('/api/text-inputs/:textInputId', async (request: UpdateTextInputRequest, response: Response) => {
    try {
      const { textInputId } = request.params;
      const { body } = request;

      // Use authenticated user ID if available
      const updatedBy = body.updatedBy || 1; // Default to system user if not provided

      const result = await TextInputService.updateTextInput(textInputId, body, updatedBy);

      if (!result.success) {
        return response.status(result.code || 500).json(result);
      }

      // Broadcast to WebSocket clients
      if (result.data) {
        WebSocketService.broadcastToSession(result.data.sessionId, {
          type: 'text_input_updated',
          payload: result.data,
          userId: updatedBy.toString(),
          sessionId: result.data.sessionId,
          timestamp: Date.now(),
        });
      }

      console.log(`✅ Text input updated via API: ${textInputId}`);
      return response.json(result);

    } catch (error) {
      console.error('❌ Error in PUT /api/text-inputs/:textInputId:', error);
      return response.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Delete a text input
   * DELETE /api/text-inputs/:textInputId
   */
  app.delete('/api/text-inputs/:textInputId', async (request: DeleteTextInputRequest, response: Response) => {
    try {
      const { textInputId } = request.params;

      // Get the text input first to get session info for WebSocket broadcast
      const getResult = await TextInputService.getTextInputById(textInputId);
      if (!getResult.success) {
        return response.status(getResult.code || 500).json(getResult);
      }

      const textInput = getResult.data!;
      const result = await TextInputService.deleteTextInput(textInputId);

      if (!result.success) {
        return response.status(result.code || 500).json(result);
      }

      // Broadcast to WebSocket clients
      WebSocketService.broadcastToSession(textInput.sessionId, {
        type: 'text_input_deleted',
        payload: { textInputId },
        userId: (request.user as AuthUser)?.id?.toString() || 'system', // Use actual user ID who performed the deletion
        sessionId: textInput.sessionId,
        timestamp: Date.now(),
      });

      console.log(`✅ Text input deleted via API: ${textInputId}`);
      return response.status(204).send();

    } catch (error) {
      console.error('❌ Error in DELETE /api/text-inputs/:textInputId:', error);
      return response.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Bulk update text inputs for real-time collaboration
   * POST /api/text-inputs/bulk-update
   */
  app.post('/api/text-inputs/bulk-update', async (request: BulkUpdateRequest, response: Response) => {
    try {
      const { updates, updatedBy = 1 } = request.body;

      if (!Array.isArray(updates) || updates.length === 0) {
        return response.status(400).json({
          success: false,
          error: 'Updates array is required and must not be empty'
        });
      }

      const result = await TextInputService.bulkUpdateTextInputs(updates, updatedBy);

      if (!result.success) {
        return response.status(result.code || 500).json(result);
      }

      // Group by session for efficient WebSocket broadcasting
      const sessionGroups = new Map<string, any[]>();
      result.data?.forEach(textInput => {
        if (!sessionGroups.has(textInput.sessionId)) {
          sessionGroups.set(textInput.sessionId, []);
        }
        sessionGroups.get(textInput.sessionId)!.push(textInput);
      });

      // Broadcast to each session
      sessionGroups.forEach((textInputs, sessionId) => {
        WebSocketService.broadcastToSession(sessionId, {
          type: 'text_inputs_bulk_updated',
          payload: textInputs,
          userId: updatedBy.toString(),
          sessionId: sessionId,
          timestamp: Date.now(),
        });
      });

      console.log(`✅ Bulk updated ${result.data?.length || 0} text inputs via API`);
      return response.json(result);

    } catch (error) {
      console.error('❌ Error in POST /api/text-inputs/bulk-update:', error);
      return response.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Update text input content (lightweight endpoint for frequent updates)
   * PATCH /api/text-inputs/:textInputId/content
   */
  app.patch('/api/text-inputs/:textInputId/content', async (request: any, response: Response) => {
    try {
      const { textInputId } = request.params;
      const { content, updatedBy = 1 } = request.body;

      if (typeof content !== 'string') {
        return response.status(400).json({
          success: false,
          error: 'Content must be a string'
        });
      }

      const result = await TextInputService.updateTextInput(textInputId, { content }, updatedBy);

      if (!result.success) {
        return response.status(result.code || 500).json(result);
      }

      // Broadcast lightweight content update
      if (result.data) {
        WebSocketService.broadcastToSession(result.data.sessionId, {
          type: 'text_input_content_updated',
          payload: {
            textInputId,
            content,
            updatedAt: result.data.updatedAt,
          },
          userId: updatedBy.toString(),
          sessionId: result.data.sessionId,
          timestamp: Date.now(),
        });
      }

      return response.json({
        success: true,
        data: {
          textInputId,
          content,
          updatedAt: result.data?.updatedAt,
        }
      });

    } catch (error) {
      console.error('❌ Error in PATCH /api/text-inputs/:textInputId/content:', error);
      return response.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Update text input position (lightweight endpoint for drag operations)
   * PATCH /api/text-inputs/:textInputId/position
   */
  app.patch('/api/text-inputs/:textInputId/position', async (request: any, response: Response) => {
    try {
      const { textInputId } = request.params;
      const { coordinates, updatedBy = 1 } = request.body;

      if (!coordinates || typeof coordinates !== 'object') {
        return response.status(400).json({
          success: false,
          error: 'Coordinates object is required'
        });
      }

      const result = await TextInputService.updateTextInput(textInputId, { coordinates }, updatedBy);

      if (!result.success) {
        return response.status(result.code || 500).json(result);
      }

      // Broadcast lightweight position update
      if (result.data) {
        WebSocketService.broadcastToSession(result.data.sessionId, {
          type: 'text_input_position_updated',
          payload: {
            textInputId,
            coordinates: result.data.coordinates,
            updatedAt: result.data.updatedAt,
          },
          userId: updatedBy.toString(),
          sessionId: result.data.sessionId,
          timestamp: Date.now(),
        });
      }

      return response.json({
        success: true,
        data: {
          textInputId,
          coordinates: result.data?.coordinates,
          updatedAt: result.data?.updatedAt,
        }
      });

    } catch (error) {
      console.error('❌ Error in PATCH /api/text-inputs/:textInputId/position:', error);
      return response.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  console.log('✅ Text input routes registered');
}
