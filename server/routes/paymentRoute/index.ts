import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "../../storage";

import { verifyToken, hasAdminPrivileges, type AuthUser } from "../../auth";
import {  cacheUserData, cacheCompanyData, cacheJobData } from "../../middleware/cache-middleware";
interface AuthenticatedRequest extends Express.Request {
  user: AuthUser;
}

import { 

  type Payment,

} from "@shared/schema";


export async function paymentRoutes(app: Express): Promise<Server> {


  app.get('/api/payments', verifyToken, cacheUserData(300), async (req: any, res) => {
    try {
      let payments: Payment[];
      if (hasAdminPrivileges(req.user)) {
        payments = [];
      } else {
        payments = await storage.getPaymentsByUserId(req.user.id);
      }
      res.json(payments);
    } catch (error) {
      console.error('Get payments error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/payments', verifyToken, async (req: any, res) => {
    try {
      const payment = await storage.createPayment({
        ...req.body,
        payerId: req.user.id
      });
      res.json(payment);
    } catch (error) {
      console.error('Create payment error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/payments/:id', verifyToken, async (req: any, res) => {
    try {
      const paymentId = parseInt(req.params.id);
      const payment = await storage.updatePayment(paymentId, req.body);
      
      if (!payment) {
        return res.status(404).json({ message: 'Payment not found' });
      }
      
      res.json(payment);
    } catch (error) {
      console.error('Update payment error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

}