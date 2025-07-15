import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "../../storage";

import {
  verifyToken,
  hasAdminPrivileges,
  hasNotaryPrivileges,
  type AuthUser,
} from "../../auth";
import { cacheAdminData } from "../../middleware/cache-middleware";

interface AuthenticatedRequest extends Express.Request {
  user: AuthUser;
}

export async function closingTypeRoutes(app: Express): Promise<Server> {
  app.get(
    "/api/closing-types",
    verifyToken,
    cacheAdminData(600),
    async (req: any, res) => {
      try {
        const closingTypes = await storage.getClosingTypes();
        res.json(closingTypes);
      } catch (error) {
        console.error("Get closing types error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.get("/api/closing-types/active", verifyToken, async (req: any, res) => {
    try {
      const closingTypes = await storage.getActiveClosingTypes();
      res.json(closingTypes);
    } catch (error) {
      console.error("Get active closing types error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/closing-types", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const closingType = await storage.createClosingType(req.body);
      res.json(closingType);
    } catch (error) {
      console.error("Create closing type error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/closing-types/:id", verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const closingTypeId = parseInt(req.params.id);
      const closingType = await storage.updateClosingType(
        closingTypeId,
        req.body
      );

      if (!closingType) {
        return res.status(404).json({ message: "Closing type not found" });
      }

      res.json(closingType);
    } catch (error) {
      console.error("Update closing type error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/closing-types/:id", verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const closingTypeId = parseInt(req.params.id);
      const deleted = await storage.deleteClosingType(closingTypeId);

      if (!deleted) {
        return res.status(404).json({ message: "Closing type not found" });
      }

      res.json({ message: "Closing type deleted successfully" });
    } catch (error) {
      console.error("Delete closing type error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
