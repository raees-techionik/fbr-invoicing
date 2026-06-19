import { Router } from "express";
import {
  createStaffMember,
  deleteStaffMember,
  getStaffMember,
  listStaff,
  updateStaffMember,
} from "../services/staff.service.js";

export const staffRouter = Router();

staffRouter.get("/", async (req, res, next) => {
  try {
    res.json({
      data: await listStaff(req.companyId!, {
        search: typeof req.query.search === "string" ? req.query.search : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      }),
    });
  } catch (error) {
    next(error);
  }
});

staffRouter.get("/:id", async (req, res, next) => {
  try {
    res.json({ data: await getStaffMember(req.companyId!, req.params.id) });
  } catch (error) {
    next(error);
  }
});

staffRouter.post("/", async (req, res, next) => {
  try {
    res.status(201).json({ data: await createStaffMember(req.companyId!, req.body) });
  } catch (error) {
    next(error);
  }
});

staffRouter.put("/:id", async (req, res, next) => {
  try {
    res.json({ data: await updateStaffMember(req.companyId!, req.params.id, req.body) });
  } catch (error) {
    next(error);
  }
});

staffRouter.delete("/:id", async (req, res, next) => {
  try {
    res.json({ data: await deleteStaffMember(req.companyId!, req.params.id) });
  } catch (error) {
    next(error);
  }
});
