import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "../../storage";
import { db } from "../../db";

import { auditLoggingService } from "../../services/audit-logging-service";
import { verifyToken, hasAdminPrivileges, type AuthUser } from "../../auth";
import { cacheAdminData, cacheUserData } from "../../middleware/cache-middleware";

interface AuthenticatedRequest extends Express.Request {
  user: AuthUser;
}
import { eq, and, sql } from "drizzle-orm";

import { 
 
  type Invoice,
  
} from "@shared/schema";



export async function registerInvoicesRoutes(app: Express): Promise<Server> {


  app.use((req: any, res: any, next: any) => {
    auditLoggingService.auditMiddleware()(req, res, next);
  });

  app.get('/api/admin/revenue-stats', verifyToken, cacheAdminData(300), async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      // Calculate revenue from payments and invoices
      const currentMonth = new Date();
      const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      
      const revenue = await db.execute(sql`
        SELECT 
          COALESCE(SUM(p.amount), 0) as monthly_revenue,
          COUNT(CASE WHEN p.status = 'pending' THEN 1 END) as pending_payments,
          COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as completed_payments
        FROM payments p
        WHERE p.created_at >= ${firstDayOfMonth.toISOString()}
      `);

      res.json(revenue.rows[0]);
    } catch (error) {
      console.error('Get revenue stats error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/invoices', verifyToken, cacheUserData(300), async (req: any, res) => {
    try {
      let invoices: Invoice[];
      if (hasAdminPrivileges(req.user)) {
        // Admin gets all invoices - for demo purposes, return empty array
        invoices = [];
      } else if (req.user.role === 'notary') {
        invoices = await storage.getInvoicesByNotaryId(req.user.id);
      } else {
        invoices = await storage.getInvoicesByClientId(req.user.id);
      }
      res.json(invoices);
    } catch (error) {
      console.error('Get invoices error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/invoices', verifyToken, async (req: any, res) => {
    try {
      const invoiceNumber = await storage.generateInvoiceNumber();
      const invoice = await storage.createInvoice({
        ...req.body,
        invoiceNumber
      });
      res.json(invoice);
    } catch (error) {
      console.error('Create invoice error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/invoices/:id', verifyToken, async (req: any, res) => {
    try {
      const invoiceId = parseInt(req.params.id);
      const invoice = await storage.updateInvoice(invoiceId, req.body);
      
      if (!invoice) {
        return res.status(404).json({ message: 'Invoice not found' });
      }
      
      res.json(invoice);
    } catch (error) {
      console.error('Update invoice error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

}