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

export async function participantRoutes(app: Express): Promise<Server> {
  app.get(
    "/api/participant-roles",
    verifyToken,
    cacheAdminData(600),
    async (req: any, res) => {
      try {
        const roles = await storage.getParticipantRoles();
        res.json(roles);
      } catch (error) {
        console.error("Get participant roles error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.get(
    "/api/participant-roles/active",
    verifyToken,
    async (req: any, res) => {
      try {
        const roles = await storage.getActiveParticipantRoles();
        res.json(roles);
      } catch (error) {
        console.error("Get active participant roles error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.post("/api/participant-roles", verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const roleData = req.body;
      const role = await storage.createParticipantRole(roleData);
      res.status(201).json(role);
    } catch (error) {
      console.error("Create participant role error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/participant-roles/:id", verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const roleId = parseInt(req.params.id);
      const updateData = req.body;
      const role = await storage.updateParticipantRole(roleId, updateData);

      if (!role) {
        return res.status(404).json({ message: "Participant role not found" });
      }

      res.json(role);
    } catch (error) {
      console.error("Update participant role error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(
    "/api/participant-roles/:id",
    verifyToken,
    async (req: any, res) => {
      try {
        if (!hasAdminPrivileges(req.user)) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const roleId = parseInt(req.params.id);
        const deleted = await storage.deleteParticipantRole(roleId);

        if (!deleted) {
          return res
            .status(404)
            .json({ message: "Participant role not found" });
        }

        res.json({ message: "Participant role deleted successfully" });
      } catch (error) {
        console.error("Delete participant role error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );
}
