import { Router } from "express";
import { getCompanyProfile, updateCompanyProfile } from "../services/company-profile.service.js";

export const companyProfileRouter = Router();

companyProfileRouter.get("/", async (_req, res, next) => {
  try {
    res.json({ data: await getCompanyProfile() });
  } catch (error) {
    next(error);
  }
});

companyProfileRouter.put("/", async (req, res, next) => {
  try {
    res.json({ data: await updateCompanyProfile(req.body) });
  } catch (error) {
    next(error);
  }
});
