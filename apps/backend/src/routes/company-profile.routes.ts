import { Router } from "express";
import { getCompanyProfile, updateCompanyProfile } from "../services/company-profile.service.js";

export const companyProfileRouter = Router();

companyProfileRouter.get("/", async (req, res, next) => {
  try {
    res.json({ data: await getCompanyProfile(req.companyId!) });
  } catch (error) {
    next(error);
  }
});

companyProfileRouter.put("/", async (req, res, next) => {
  try {
    res.json({ data: await updateCompanyProfile(req.companyId!, req.body) });
  } catch (error) {
    next(error);
  }
});
