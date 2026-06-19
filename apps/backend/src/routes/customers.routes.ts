import { Router } from "express";
import {
  createCustomer,
  deleteCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} from "../services/customers.service.js";

export const customersRouter = Router();

customersRouter.get("/", async (req, res, next) => {
  try {
    res.json({
      data: await listCustomers(req.companyId!, {
        search: typeof req.query.search === "string" ? req.query.search : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      }),
    });
  } catch (error) {
    next(error);
  }
});

customersRouter.get("/:id", async (req, res, next) => {
  try {
    res.json({ data: await getCustomer(req.companyId!, req.params.id) });
  } catch (error) {
    next(error);
  }
});

customersRouter.post("/", async (req, res, next) => {
  try {
    res.status(201).json({ data: await createCustomer(req.companyId!, req.body) });
  } catch (error) {
    next(error);
  }
});

customersRouter.put("/:id", async (req, res, next) => {
  try {
    res.json({ data: await updateCustomer(req.companyId!, req.params.id, req.body) });
  } catch (error) {
    next(error);
  }
});

customersRouter.delete("/:id", async (req, res, next) => {
  try {
    res.json({ data: await deleteCustomer(req.companyId!, req.params.id) });
  } catch (error) {
    next(error);
  }
});
