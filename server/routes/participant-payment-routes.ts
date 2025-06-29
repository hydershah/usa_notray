import { Express } from 'express';
import { verifyToken } from '../lib/auth';
import { ParticipantPaymentService } from '../services/participant-payment-service';

const participantPaymentService = new ParticipantPaymentService();

export function registerParticipantPaymentRoutes(app: Express) {
  
  // Get participant payment summary
  app.get('/api/participant-payments/summary/:userId', verifyToken, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      // Verify user can access this data (only their own or admin)
      if (req.user.id !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const summary = await participantPaymentService.getParticipantPaymentSummary(userId);
      res.json(summary);
    } catch (error) {
      console.error('Error fetching participant payment summary:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get pending payments for participant
  app.get('/api/participant-payments/pending/:userId', verifyToken, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      // Verify user can access this data
      if (req.user.id !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const pendingPayments = await participantPaymentService.getPendingPayments(userId);
      res.json(pendingPayments);
    } catch (error) {
      console.error('Error fetching pending payments:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Create participant payment (admin only)
  app.post('/api/participant-payments/create', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { participantId, jobId, sessionId, participantRole, sessionDuration } = req.body;

      const payment = await participantPaymentService.createParticipantPayment(
        participantId,
        jobId,
        sessionId,
        participantRole,
        sessionDuration
      );

      res.json({ success: true, payment });
    } catch (error) {
      console.error('Error creating participant payment:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Process participant payout (admin only)
  app.post('/api/participant-payments/payout/:paymentId', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const paymentId = parseInt(req.params.paymentId);
      const { stripeTransferId, paymentMethod } = req.body;

      const success = await participantPaymentService.processParticipantPayout(
        paymentId,
        stripeTransferId,
        paymentMethod
      );

      if (success) {
        res.json({ success: true, message: 'Payout processed successfully' });
      } else {
        res.status(400).json({ message: 'Failed to process payout' });
      }
    } catch (error) {
      console.error('Error processing payout:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Mark payments as available (automated process, admin only)
  app.post('/api/participant-payments/mark-available', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const updatedCount = await participantPaymentService.markPaymentsAvailable();
      res.json({ 
        success: true, 
        message: `${updatedCount} payments marked as available for payout` 
      });
    } catch (error) {
      console.error('Error marking payments available:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
} 