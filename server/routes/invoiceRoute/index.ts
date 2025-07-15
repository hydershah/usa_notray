import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "../../storage";

import {
  verifyToken,
  hasAdminPrivileges,
  hasNotaryPrivileges,
  type AuthUser,
} from "../../auth";
import { cacheUserData } from "../../middleware/cache-middleware";
import { Invoice } from "@shared/schema";

interface AuthenticatedRequest extends Express.Request {
  user: AuthUser;
}

export async function invoiceRoutes(app: Express): Promise<Server> {
  app.get(
    "/api/invoices",
    verifyToken,
    cacheUserData(300),
    async (req: any, res) => {
      try {
        let invoices: Invoice[];
        if (hasAdminPrivileges(req.user)) {
          invoices = [];
        } else if (req.user.role === "notary") {
          invoices = await storage.getInvoicesByNotaryId(req.user.id);
        } else {
          invoices = await storage.getInvoicesByClientId(req.user.id);
        }
        res.json(invoices);
      } catch (error) {
        console.error("Get invoices error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.post("/api/invoices", verifyToken, async (req: any, res) => {
    try {
      const invoiceNumber = await storage.generateInvoiceNumber();
      const invoice = await storage.createInvoice({
        ...req.body,
        invoiceNumber,
      });
      res.json(invoice);
    } catch (error) {
      console.error("Create invoice error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/invoices/:id", verifyToken, async (req: any, res) => {
    try {
      const invoiceId = parseInt(req.params.id);
      const invoice = await storage.updateInvoice(invoiceId, req.body);

      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      res.json(invoice);
    } catch (error) {
      console.error("Update invoice error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
