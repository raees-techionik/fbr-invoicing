import { ZodError } from "zod";
import cors from "cors";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { authRouter } from "./routes/auth.routes.js";
import { companyProfileRouter } from "./routes/company-profile.routes.js";
import { companiesRouter } from "./routes/companies.routes.js";
import { customersRouter } from "./routes/customers.routes.js";
import { appServicesRouter } from "./routes/app-services.routes.js";
import { staffRouter } from "./routes/staff.routes.js";
import { fbrDashboardRouter } from "./routes/fbr-dashboard.routes.js";
import { fbrInvoiceRouter } from "./routes/fbr-invoice.routes.js";
import { fbrOfflineQueueRouter } from "./routes/fbr-offline-queue.routes.js";
import { fbrProductMappingRouter } from "./routes/fbr-product-mapping.routes.js";
import { fbrReferenceRouter } from "./routes/fbr-reference.routes.js";
import { fbrSandboxRouter } from "./routes/fbr-sandbox.routes.js";
import { fbrSettingsRouter } from "./routes/fbr-settings.routes.js";
import { swaggerSpec } from "./swagger.js";
import { requireAuth } from "./middleware/auth.js";

export const app = express();

app.use(cors());
app.use(express.json());

const deploymentApiPrefix = process.env.API_BASE_PATH || "/api/fbr-einvoicing-backend";

app.use((req, _res, next) => {
  if (deploymentApiPrefix !== "/" && req.url.startsWith(`${deploymentApiPrefix}/`)) {
    req.url = req.url.slice(deploymentApiPrefix.length);
  } else if (req.url === deploymentApiPrefix) {
    req.url = "/";
  }
  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "fbr-einvoicing-api" });
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/api-docs.json", (_req, res) => {
  res.json(swaggerSpec);
});

app.use("/api/auth", authRouter);
app.use("/api/companies", requireAuth, companiesRouter);
app.use("/api/company-profile", requireAuth, companyProfileRouter);
app.use("/api/customers", requireAuth, customersRouter);
app.use("/api/services", requireAuth, appServicesRouter);
app.use("/api/staff-members", requireAuth, staffRouter);
app.use("/api/fbr/reference", requireAuth, fbrReferenceRouter);
app.use("/api/fbr/invoices", requireAuth, fbrInvoiceRouter);
app.use("/api/fbr/settings", requireAuth, fbrSettingsRouter);
app.use("/api/fbr/product-mappings", requireAuth, fbrProductMappingRouter);
app.use("/api/fbr/dashboard", requireAuth, fbrDashboardRouter);
app.use("/api/fbr/offline-queue", requireAuth, fbrOfflineQueueRouter);
app.use("/api/fbr/sandbox", requireAuth, fbrSandboxRouter);

app.use("/api/ref", requireAuth, fbrReferenceRouter);
app.use("/api/invoice", requireAuth, fbrInvoiceRouter);
app.use("/api/invoices", requireAuth, fbrInvoiceRouter);
app.use("/api/token", requireAuth, fbrSettingsRouter);
app.use("/api/products", requireAuth, fbrProductMappingRouter);
app.use("/api/queue", requireAuth, fbrOfflineQueueRouter);
app.use("/api/sandbox", requireAuth, fbrSandboxRouter);
app.use("/api/dashboard", requireAuth, fbrDashboardRouter);

app.use(
  (
    err: Error & { status?: number; details?: string; code?: string; action?: string },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "Validation failed", issues: err.flatten() });
      return;
    }
    const status = err.status ?? 500;
    if (status >= 500) {
      console.error("[api-error]", {
        status,
        message: err.message,
        code: err.code,
        details: err.details,
      });
    }
    res.status(status).json({
      error: status === 500 ? "Internal server error" : err.message,
      code: err.code,
      action: err.action,
    });
  },
);
