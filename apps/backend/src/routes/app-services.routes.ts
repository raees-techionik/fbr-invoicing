import { Router } from "express";
import {
  createService,
  deleteService,
  getService,
  listServices,
  updateService,
} from "../services/app-services.service.js";

export const appServicesRouter = Router();

appServicesRouter.get("/", async (req, res, next) => {
  try {
    res.json({
      data: await listServices(req.companyId!, {
        search: typeof req.query.search === "string" ? req.query.search : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      }),
    });
  } catch (error) {
    next(error);
  }
});

appServicesRouter.get("/:id", async (req, res, next) => {
  try {
    res.json({ data: await getService(req.companyId!, req.params.id) });
  } catch (error) {
    next(error);
  }
});

appServicesRouter.post("/", async (req, res, next) => {
  try {
    res.status(201).json({ data: await createService(req.companyId!, req.body) });
  } catch (error) {
    next(error);
  }
});

appServicesRouter.put("/:id", async (req, res, next) => {
  try {
    res.json({ data: await updateService(req.companyId!, req.params.id, req.body) });
  } catch (error) {
    next(error);
  }
});

appServicesRouter.delete("/:id", async (req, res, next) => {
  try {
    res.json({ data: await deleteService(req.companyId!, req.params.id) });
  } catch (error) {
    next(error);
  }
});
