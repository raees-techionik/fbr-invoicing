import { Router } from "express";
import {
  clearSandboxResults,
  getAllSandboxResults,
  getSandboxPreflight,
  getSandboxScenarios,
  getSandboxStatus,
  runScenario,
  runScenarios,
  type SandboxOperationType,
  type SandboxRunOptions,
} from "../services/fbr-sandbox.service.js";
import type { FbrInvoiceSettings } from "../services/fbr-invoice.service.js";

export const fbrSandboxRouter = Router();

// GET /scenarios — all scenario fixtures with current pass/fail status
fbrSandboxRouter.get("/scenarios", async (req, res, next) => {
  try {
    const [scenarios, status] = await Promise.all([
      Promise.resolve(getSandboxScenarios()),
      getSandboxStatus(req.companyId!),
    ]);
    const statusMap = new Map(status.scenarios.map((s) => [s.scenarioId, s]));
    const data = scenarios.map((scenario) => {
      const s = statusMap.get(scenario.id);
      return {
        ...scenario,
        overallStatus: s?.overallStatus ?? "not_run",
        lastResult: s?.lastResult ?? null,
      };
    });
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

// GET /status — I9 completion dashboard (mirrors what PRAL sandbox shows)
fbrSandboxRouter.get("/status", async (req, res, next) => {
  try {
    res.json({ data: await getSandboxStatus(req.companyId!) });
  } catch (error) {
    next(error);
  }
});

// GET /summary — alias of /status for guide-compatible route naming
fbrSandboxRouter.get("/summary", async (req, res, next) => {
  try {
    res.json({ data: await getSandboxStatus(req.companyId!) });
  } catch (error) {
    next(error);
  }
});

// GET /results — retrieve all stored scenario run results
fbrSandboxRouter.get("/preflight", async (req, res, next) => {
  try {
    res.json({ data: await getSandboxPreflight(req.companyId!) });
  } catch (error) {
    next(error);
  }
});

fbrSandboxRouter.get("/results", async (req, res, next) => {
  try {
    const results = await getAllSandboxResults(req.companyId!);
    res.json({ data: results });
  } catch (error) {
    next(error);
  }
});

// POST /run — I8 test runner: run all (or a named subset via body.scenarioIds)
fbrSandboxRouter.post("/run", async (req, res, next) => {
  try {
    const options = parseRunOptions(req.body);
    res.json({ data: await runScenarios(req.companyId!, options) });
  } catch (error) {
    next(error);
  }
});

// POST /run/:scenarioId — I8 test runner: run one scenario
fbrSandboxRouter.post("/run/:scenarioId", async (req, res, next) => {
  try {
    const options = parseRunOptions(req.body);
    res.json({ data: await runScenario(req.companyId!, req.params.scenarioId, options) });
  } catch (error) {
    next(error);
  }
});

// DELETE /results — wipe stored results so all scenarios return to "not_run"
fbrSandboxRouter.delete("/results", async (req, res, next) => {
  try {
    res.json({ data: await clearSandboxResults(req.companyId!) });
  } catch (error) {
    next(error);
  }
});

function parseRunOptions(body: unknown): SandboxRunOptions {
  const raw = asRecord(body);
  return {
    operation: parseOperation(raw.operation),
    settings: (asRecord(raw.settings) as FbrInvoiceSettings) ?? {},
    scenarioIds: Array.isArray(raw.scenarioIds)
      ? (raw.scenarioIds as unknown[]).filter((id): id is string => typeof id === "string")
      : undefined,
  };
}

function parseOperation(value: unknown): SandboxOperationType {
  return String(value ?? "").toLowerCase() === "submit" ? "submit" : "validate";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
