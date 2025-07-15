import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "../../storage";
import { db } from "../../db";

import { verifyToken, hasAdminPrivileges, type AuthUser } from "../../auth";
import { cacheAdminData } from "../../middleware/cache-middleware";

interface AuthenticatedRequest extends Express.Request {
  user: AuthUser;
}
import { redisCache } from "../../services/redis-cache";

import { insertCompanySchema } from "@shared/schema";

export async function titleCompanyRoutes(app: Express): Promise<Server> {
  app.get(
    "/api/companies",
    verifyToken,
    cacheAdminData(300),
    async (req, res) => {
      try {
        const companies = await storage.getCompanies();
        res.json(companies);
      } catch (error) {
        console.error("Get companies error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.post("/api/companies", verifyToken, async (req: any, res) => {
    try {
      if (!req.user || !hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const companyData = insertCompanySchema.parse(req.body);
      const company = await storage.createCompany(companyData);
      try {
        await redisCache.delPattern(`admin:*`);
        await redisCache.delPattern(`api:*companies*`);
        console.log(
          `🧹 Invalidated company caches after creating company ${company.id}`
        );
      } catch (cacheError) {
        console.error(
          "Failed to invalidate cache after company creation:",
          cacheError
        );
      }

      res.status(201).json(company);
    } catch (error) {
      console.error("Create company error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/companies/:id", verifyToken, async (req: any, res) => {
    try {
      if (!req.user || !hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const companyId = parseInt(req.params.id);
      const updateData = req.body;

      const company = await storage.updateCompany(companyId, updateData);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      try {
        await redisCache.delPattern(`admin:*`);
        await redisCache.delPattern(`api:*companies*`);
        console.log(
          `🧹 Invalidated company caches after updating company ${companyId}`
        );
      } catch (cacheError) {
        console.error(
          "Failed to invalidate cache after company update:",
          cacheError
        );
      }

      res.json(company);
    } catch (error) {
      console.error("Update company error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/companies/:id", verifyToken, async (req: any, res) => {
    try {
      if (!req.user || !hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const companyId = parseInt(req.params.id);
      const deleted = await storage.deleteCompany(companyId);
      if (!deleted) {
        return res.status(404).json({ message: "Company not found" });
      }
      try {
        await redisCache.delPattern(`admin:*`);
        await redisCache.delPattern(`api:*companies*`);
        console.log(
          `🧹 Invalidated company caches after deleting company ${companyId}`
        );
      } catch (cacheError) {
        console.error(
          "Failed to invalidate cache after company deletion:",
          cacheError
        );
      }
      res.json({ message: "Company deleted successfully" });
    } catch (error) {
      console.error("Delete company error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
