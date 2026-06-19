import { Router, type Request } from "express";
import {
  acceptCompanyInvitation,
  createBusinessCompany,
  getCompanyOnboarding,
  getCurrentCompany,
  inviteCompanyMember,
  listCompanyActivity,
  listCompanies,
  listCompanyInvitations,
  listCompanyMembers,
  removeCompanyMember,
  revokeCompanyInvitation,
  setDefaultCompany,
  updateCompanyMemberRole,
  updateCompanyOnboarding,
  updateCurrentCompany,
  type CompanyActor,
} from "../services/company-management.service.js";

export const companiesRouter = Router();

companiesRouter.get("/", async (req, res, next) => {
  try {
    res.json({ data: await listCompanies(actor(req), req.query.all === "true") });
  } catch (error) { next(error); }
});

companiesRouter.post("/", async (req, res, next) => {
  try {
    res.status(201).json({ data: await createBusinessCompany(actor(req), req.body) });
  } catch (error) { next(error); }
});

companiesRouter.get("/current", async (req, res, next) => {
  try {
    res.json({ data: await getCurrentCompany(req.companyId!) });
  } catch (error) { next(error); }
});

companiesRouter.patch("/current", async (req, res, next) => {
  try {
    res.json({ data: await updateCurrentCompany(req.companyId!, actor(req), req.body) });
  } catch (error) { next(error); }
});

companiesRouter.patch("/:companyId/default", async (req, res, next) => {
  try {
    res.json({ data: await setDefaultCompany(req.auth!.userId, req.params.companyId) });
  } catch (error) { next(error); }
});

companiesRouter.get("/current/members", async (req, res, next) => {
  try {
    res.json({ data: await listCompanyMembers(req.companyId!) });
  } catch (error) { next(error); }
});

companiesRouter.patch("/current/members/:membershipId", async (req, res, next) => {
  try {
    res.json({ data: await updateCompanyMemberRole(req.companyId!, actor(req), req.params.membershipId, req.body) });
  } catch (error) { next(error); }
});

companiesRouter.delete("/current/members/:membershipId", async (req, res, next) => {
  try {
    res.json({ data: await removeCompanyMember(req.companyId!, actor(req), req.params.membershipId) });
  } catch (error) { next(error); }
});

companiesRouter.get("/current/invitations", async (req, res, next) => {
  try {
    res.json({ data: await listCompanyInvitations(req.companyId!, actor(req)) });
  } catch (error) { next(error); }
});

companiesRouter.post("/current/invitations", async (req, res, next) => {
  try {
    res.status(201).json({ data: await inviteCompanyMember(req.companyId!, actor(req), req.body) });
  } catch (error) { next(error); }
});

companiesRouter.delete("/current/invitations/:invitationId", async (req, res, next) => {
  try {
    res.json({ data: await revokeCompanyInvitation(req.companyId!, actor(req), req.params.invitationId) });
  } catch (error) { next(error); }
});

companiesRouter.post("/invitations/:token/accept", async (req, res, next) => {
  try {
    res.json({
      data: await acceptCompanyInvitation(actor(req), req.params.token, req.body?.makeDefault === true),
    });
  } catch (error) { next(error); }
});

companiesRouter.get("/current/onboarding", async (req, res, next) => {
  try {
    res.json({ data: await getCompanyOnboarding(req.companyId!) });
  } catch (error) { next(error); }
});

companiesRouter.get("/current/activity", async (req, res, next) => {
  try {
    res.json({ data: await listCompanyActivity(req.companyId!, actor(req), req.query.limit) });
  } catch (error) { next(error); }
});

companiesRouter.patch("/current/onboarding", async (req, res, next) => {
  try {
    res.json({ data: await updateCompanyOnboarding(req.companyId!, actor(req), req.body) });
  } catch (error) { next(error); }
});

function actor(req: Request): CompanyActor {
  return {
    userId: req.auth!.userId,
    email: req.auth!.email,
    isSuperAdmin: req.auth!.isSuperAdmin,
    membershipRole: req.activeCompany!.membershipRole,
  };
}
