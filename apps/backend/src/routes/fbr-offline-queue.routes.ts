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
    res.json(await listOfflineQueue(req.query));
  } catch (error) {
    next(error);
  }
});

fbrOfflineQueueRouter.post("/", async (req, res, next) => {
  try {
    res.status(201).json({ data: await enqueueOfflineInvoice(req.body) });
  } catch (error) {
    next(error);
  }
});

fbrOfflineQueueRouter.post("/add", async (req, res, next) => {
  try {
    res.status(201).json({ data: await enqueueOfflineInvoice(req.body) });
  } catch (error) {
    next(error);
  }
});

fbrOfflineQueueRouter.get("/summary", async (_req, res, next) => {
  try {
    res.json({ data: await getOfflineQueueSummary() });
  } catch (error) {
    next(error);
  }
});

fbrOfflineQueueRouter.get("/status", async (_req, res, next) => {
  try {
    res.json({ data: await getOfflineQueueSummary() });
  } catch (error) {
    next(error);
  }
});

fbrOfflineQueueRouter.get("/failed", async (req, res, next) => {
  try {
    res.json(await listOfflineQueue({ ...req.query, status: "FAILED" }));
  } catch (error) {
    next(error);
  }
});

fbrOfflineQueueRouter.post("/process", async (req, res, next) => {
  try {
    res.json({ data: await processOfflineQueue(req.body ?? {}) });
  } catch (error) {
    next(error);
  }
});

fbrOfflineQueueRouter.post("/retry/:id", async (req, res, next) => {
  try {
    res.json({ data: await retryOfflineQueueItem(req.params.id, req.body?.settings) });
  } catch (error) {
    next(error);
  }
});

fbrOfflineQueueRouter.post("/:id/retry", async (req, res, next) => {
  try {
    res.json({ data: await retryOfflineQueueItem(req.params.id, req.body?.settings) });
  } catch (error) {
    next(error);
  }
});
