import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { registerCompanyRoutes } from "./company-routes";
import { registerUserManagementRoutes } from "./user-management-routes";
import { registerNotaryProfileRoutes } from "./notary-profile-routes";
import { registerApprovalWorkflowRoutes } from "./approval-workflow-routes";
import { registerFeeRoutes } from "./fee-routes";
import { registerTitleCompanyNotaryRoutes } from "./title-company-notary-routes";
import { registerAdminVerificationRoutes } from "./routes/admin-verification-routes";
import adminLogsRoutes from "./routes/admin-logs-routes";
import notaryVerificationRoutes from "./routes/notary-verification-routes";
import notaryJobApprovalRoutes from "./routes/notary-job-approval-routes";
import screenRecordingRoutes from "./routes/screen-recording-api";
import { auditLoggingService } from "./services/audit-logging-service";
import { verifyToken, type AuthUser } from "./auth";

interface AuthenticatedRequest extends Express.Request {
  user: AuthUser;
}

import {
  getAllTemplates,
  getTemplate,
  getTemplateVariables,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  previewTemplate,
  sendTestEmail,
  getEmailLogs,
  getTemplateCategories,
} from "./email-template-routes";

import { authenticationRoutes } from "./routes/authenticationRoute/index";
import { registerUsersRoutes } from "./routes/userManagement/index";
import { titleCompanyRoutes } from "./routes/titleCompanyManagement";
import { jobManagementRoutes } from "./routes/jobManagementRoute";
import { closingTypeRoutes } from "./routes/closingTYpeRoute";
import { participantRoutes } from "./routes/participantRoute";
import { calandarRoutes } from "./routes/calenderRoute";
import { invoiceRoutes } from "./routes/invoiceRoute";
import { paymentRoutes } from "./routes/paymentRoute";
import { uploadSystemRoutes } from "./routes/uploadSystemRoutes";
import { emailSettingsRoutes } from "./routes/emailSettingRoute";
import { adminVerificationRoutes } from "./routes/adminVerificationRoute";
import { certificate_KBARoutes } from "./routes/certificate_KBARoute";
import { liveSigningRoutes } from "./routes/liveSigningRoute";
import { editorRoutes } from "./routes/editorRoute";
import { userCertificateRoutes } from "./routes/userCertificateRoute";

export async function registerRoutes(app: Express): Promise<Server> {
  authenticationRoutes(app);
  registerUsersRoutes(app);
  titleCompanyRoutes(app);
  jobManagementRoutes(app);
  closingTypeRoutes(app);
  participantRoutes(app);
  calandarRoutes(app);
  invoiceRoutes(app);
  paymentRoutes(app);
  uploadSystemRoutes(app);
  emailSettingsRoutes(app);
  adminVerificationRoutes(app);
  certificate_KBARoutes(app);
  liveSigningRoutes(app);
  editorRoutes(app);
  userCertificateRoutes(app);

  registerUserManagementRoutes(app);
  registerCompanyRoutes(app);
  registerTitleCompanyNotaryRoutes(app);
  registerApprovalWorkflowRoutes(app);
  registerNotaryProfileRoutes(app);
  registerFeeRoutes(app);
  registerAdminVerificationRoutes(app);

  app.get("/", (req, res, next) => {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.SERVE_STATIC_FILES !== "false"
    ) {
      return next();
    }

    res.json({
      status: "ok",
      message: "Notary API Server",
      version: "1.0.0",
      endpoints: {
        api: "/api",
        health: "/health",
        docs: "/api/docs",
      },
    });
  });

  app.get("/favicon.ico", (req, res) => {
    res.status(204).send(); // No content
  });

  app.use((req: any, res: any, next: any) => {
    auditLoggingService.auditMiddleware()(req, res, next);
  });

  const { registerTextTagRoutes } = await import("./routes/text-tag-routes");
  registerTextTagRoutes(app);

  app.use("/api/admin", adminLogsRoutes);
  app.use("/api/notary", notaryVerificationRoutes);
  app.use("/api/notary", notaryJobApprovalRoutes);
  app.use("/api", screenRecordingRoutes);

  // Email Template Management Routes
  app.get("/api/email-templates", verifyToken, getAllTemplates);
  app.get(
    "/api/email-templates/variables/all",
    verifyToken,
    getTemplateVariables
  );
  app.get(
    "/api/email-templates/categories/all",
    verifyToken,
    getTemplateCategories
  );
  app.get("/api/email-templates/logs/all", verifyToken, getEmailLogs);
  app.get("/api/email-templates/:template_key", verifyToken, getTemplate);
  app.post("/api/email-templates", verifyToken, createTemplate);
  app.put("/api/email-templates/:id", verifyToken, updateTemplate);
  app.delete("/api/email-templates/:id", verifyToken, deleteTemplate);
  app.post(
    "/api/email-templates/:template_key/preview",
    verifyToken,
    previewTemplate
  );
  app.post("/api/email-templates/send-test", verifyToken, sendTestEmail);

  const httpServer = createServer(app);
  return httpServer;
}
