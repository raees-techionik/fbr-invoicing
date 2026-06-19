import { Router } from "express";
import { listInvoiceRecords } from "../services/fbr-dashboard.service.js";
import {
  getInvoiceById,
  saveFailedInvoiceRecord,
  saveNormalizedInvoiceRecord,
} from "../services/fbr-invoice-persistence.service.js";
import {
  lookupReferenceInvoice,
  previewFormattedInvoice,
  submitInvoiceToFbr,
  validateInvoiceWithFbr,
  type FbrInvoiceInput,
  type FbrInvoiceSettings,
} from "../services/fbr-invoice.service.js";

export const fbrInvoiceRouter = Router();

fbrInvoiceRouter.get("/", async (req, res, next) => {
  try {
    res.json(await listInvoiceRecords(req.companyId!, req.query));
  } catch (error) {
    next(error);
  }
});

fbrInvoiceRouter.post("/format", async (req, res, next) => {
  try {
    res.json({ data: await previewFormattedInvoice(req.companyId!, invoiceBody(req.body), settingsBody(req.body)) });
  } catch (error) {
    next(error);
  }
});

fbrInvoiceRouter.post("/validate", async (req, res, next) => {
  try {
    res.json({ data: await validateInvoiceWithFbr(req.companyId!, invoiceBody(req.body), settingsBody(req.body)) });
  } catch (error) {
    next(error);
  }
});

fbrInvoiceRouter.post("/submit", async (req, res, next) => {
  let invoice: FbrInvoiceInput | undefined;
  try {
    invoice = invoiceBody(req.body);
    const result = await submitInvoiceToFbr(req.companyId!, invoice, settingsBody(req.body));
    const normalizedInvoice = await saveNormalizedInvoiceRecord(req.companyId!, invoice, result);
    res.json({ data: { ...result, normalizedInvoice, dashboardRecord: normalizedInvoice } });
  } catch (error) {
    if (invoice) {
      try {
        await saveFailedInvoiceRecord(req.companyId!, invoice, toError(error));
      } catch (saveError) {
        console.error("[invoice-save-failed]", saveError);
      }
    }
    next(error);
  }
});

fbrInvoiceRouter.get("/reference-lookup", async (req, res, next) => {
  try {
    res.json({
      data: await lookupReferenceInvoice(req.companyId!, req.query.invoiceRefNo, settingsFromQuery(req.query)),
    });
  } catch (error) {
    next(error);
  }
});

fbrInvoiceRouter.get("/:id", async (req, res, next) => {
  try {
    res.json({ data: await getInvoiceById(req.companyId!, req.params.id) });
  } catch (error) {
    next(error);
  }
});

function invoiceBody(body: unknown): FbrInvoiceInput {
  if (body && typeof body === "object" && "invoice" in body) {
    return (body as { invoice: FbrInvoiceInput }).invoice;
  }

  return body as FbrInvoiceInput;
}

function toError(error: unknown): Error & { status?: number; code?: string } {
  if (error instanceof Error) {
    return error as Error & { status?: number; code?: string };
  }

  return new Error("Invoice submission failed.");
}

function settingsBody(body: unknown): FbrInvoiceSettings {
  if (body && typeof body === "object" && "settings" in body) {
    return (body as { settings: FbrInvoiceSettings }).settings ?? {};
  }

  return {};
}

function settingsFromQuery(query: Record<string, unknown>): FbrInvoiceSettings {
  return {
    environment: query.environment,
    token: query.token,
    sandboxToken: query.sandboxToken,
    productionToken: query.productionToken,
    useMock: query.useMock,
  };
}
