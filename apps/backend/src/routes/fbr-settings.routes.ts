import { Router } from "express";
import {
  getOutboundIp,
  getPublicFbrSettings,
  getTokenStatus,
  updateFbrSettings,
} from "../services/fbr-settings.service.js";

export const fbrSettingsRouter = Router();

fbrSettingsRouter.get("/", async (req, res, next) => {
  try {
    res.json({ data: await getPublicFbrSettings(req.query.checkLive === "true") });
  } catch (error) {
    next(error);
  }
});

fbrSettingsRouter.put("/", async (req, res, next) => {
  try {
    res.json({ data: await updateFbrSettings(req.body) });
  } catch (error) {
    next(error);
  }
});

fbrSettingsRouter.post("/", async (req, res, next) => {
  try {
    res.status(201).json({ data: await updateFbrSettings(req.body) });
  } catch (error) {
    next(error);
  }
});

fbrSettingsRouter.get("/token-status", async (req, res, next) => {
  try {
    const environment = req.query.environment === "production" ? "production" : "sandbox";
    res.json({ data: await getTokenStatus(environment, req.query.checkLive === "true") });
  } catch (error) {
    next(error);
  }
});

fbrSettingsRouter.get("/status", async (req, res, next) => {
  try {
    const settings = await getPublicFbrSettings(req.query.checkLive === "true");
    res.json({
      data: {
        environment: settings.environment,
        useMock: settings.useMock,
        sandbox: settings.tokenStatus.sandbox,
        production: settings.tokenStatus.production,
        active: settings.tokenStatus.active,
        hasActiveToken: settings.tokenStatus.active.status !== "missing",
      },
    });
  } catch (error) {
    next(error);
  }
});

fbrSettingsRouter.get("/outbound-ip", async (_req, res, next) => {
  try {
    res.json({ data: await getOutboundIp() });
  } catch (error) {
    next(error);
  }
});
