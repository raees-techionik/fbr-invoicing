import { Router } from "express";
import {
  enqueueOfflineInvoice,
  getOfflineQueueSummary,
  listOfflineQueue,
  processOfflineQueue,
  retryOfflineQueueItem,
} from "../services/fbr-offline-queue.service.js";

export const fbrOfflineQueueRouter = Router();

fbrOfflineQueueRouter.get("/", async (req, res, next) => {
  try {
    res.json(await listOfflineQueue(req.companyId!, req.query));
  } catch (error) {
    next(error);
  }
});

fbrOfflineQueueRouter.post("/", async (req, res, next) => {
  try {
    res.status(201).json({ data: await enqueueOfflineInvoice(req.companyId!, req.body) });
  } catch (error) {
    next(error);
  }
});

fbrOfflineQueueRouter.post("/add", async (req, res, next) => {
  try {
    res.status(201).json({ data: await enqueueOfflineInvoice(req.companyId!, req.body) });
  } catch (error) {
    next(error);
  }
});

fbrOfflineQueueRouter.get("/summary", async (req, res, next) => {
  try {
    res.json({ data: await getOfflineQueueSummary(req.companyId!) });
  } catch (error) {
    next(error);
  }
});

fbrOfflineQueueRouter.get("/status", async (req, res, next) => {
  try {
    res.json({ data: await getOfflineQueueSummary(req.companyId!) });
  } catch (error) {
    next(error);
  }
});

fbrOfflineQueueRouter.get("/failed", async (req, res, next) => {
  try {
    res.json(await listOfflineQueue(req.companyId!, { ...req.query, status: "FAILED" }));
  } catch (error) {
    next(error);
  }
});

fbrOfflineQueueRouter.post("/process", async (req, res, next) => {
  try {
    res.json({ data: await processOfflineQueue(req.companyId!, req.body ?? {}) });
  } catch (error) {
    next(error);
  }
});

fbrOfflineQueueRouter.post("/retry/:id", async (req, res, next) => {
  try {
    res.json({ data: await retryOfflineQueueItem(req.companyId!, req.params.id, req.body?.settings) });
  } catch (error) {
    next(error);
  }
});

fbrOfflineQueueRouter.post("/:id/retry", async (req, res, next) => {
  try {
    res.json({ data: await retryOfflineQueueItem(req.companyId!, req.params.id, req.body?.settings) });
  } catch (error) {
    next(error);
  }
});
