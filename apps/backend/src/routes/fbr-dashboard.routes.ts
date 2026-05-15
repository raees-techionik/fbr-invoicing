import { Router } from "express";
import {
  createInvoiceRecord,
  deleteInvoiceRecord,
  getInvoiceChartData,
  getInvoiceRecord,
  getInvoiceSummary,
  listInvoiceRecords,
  seedMockInvoiceRecords,
  updateInvoiceClaimStatus,
} from "../services/fbr-dashboard.service.js";

export const fbrDashboardRouter = Router();

fbrDashboardRouter.get("/summary", async (req, res, next) => {
  try {
    res.json({ data: await getInvoiceSummary(req.query) });
  } catch (error) {
    next(error);
  }
});

fbrDashboardRouter.get("/invoices", async (req, res, next) => {
  try {
    res.json(await listInvoiceRecords(req.query));
  } catch (error) {
    next(error);
  }
});

fbrDashboardRouter.get("/invoices/:id", async (req, res, next) => {
  try {
    res.json({ data: await getInvoiceRecord(req.params.id) });
  } catch (error) {
    next(error);
  }
});

fbrDashboardRouter.post("/invoices", async (req, res, next) => {
  try {
    res.status(201).json({ data: await createInvoiceRecord(req.body) });
  } catch (error) {
    next(error);
  }
});

fbrDashboardRouter.delete("/invoices/:id", async (req, res, next) => {
  try {
    await deleteInvoiceRecord(req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

fbrDashboardRouter.patch("/invoices/:id/claimed", async (req, res, next) => {
  try {
    res.json({ data: await updateInvoiceClaimStatus(req.params.id, req.body?.claimed) });
  } catch (error) {
    next(error);
  }
});

fbrDashboardRouter.get("/charts", async (req, res, next) => {
  try {
    res.json({ data: await getInvoiceChartData(req.query) });
  } catch (error) {
    next(error);
  }
});

fbrDashboardRouter.post("/seed-mock", async (_req, res, next) => {
  try {
    res.json({ data: await seedMockInvoiceRecords() });
  } catch (error) {
    next(error);
  }
});
