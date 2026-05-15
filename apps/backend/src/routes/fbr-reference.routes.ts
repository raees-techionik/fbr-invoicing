import type { Request } from "express";
import { Router } from "express";
import {
  getDocumentTypes,
  getHsUoms,
  getItemDescriptions,
  getProvinces,
  getReferenceBootstrap,
  getRegistrationType,
  getSaleTypeRates,
  getSroItemCodes,
  getSroItems,
  getSroSchedules,
  getStatl,
  getTransactionTypes,
  getUoms,
} from "../services/fbr-reference.service.js";

export const fbrReferenceRouter = Router();

fbrReferenceRouter.get("/bootstrap", async (req, res, next) => {
  try {
    res.json({ data: await getReferenceBootstrap(forceRefresh(req)) });
  } catch (error) {
    next(error);
  }
});

fbrReferenceRouter.get("/provinces", async (req, res, next) => {
  try {
    res.json(await getProvinces(forceRefresh(req)));
  } catch (error) {
    next(error);
  }
});

fbrReferenceRouter.get("/document-types", async (req, res, next) => {
  try {
    res.json(await getDocumentTypes(forceRefresh(req)));
  } catch (error) {
    next(error);
  }
});

fbrReferenceRouter.get("/doctypes", async (req, res, next) => {
  try {
    res.json(await getDocumentTypes(forceRefresh(req)));
  } catch (error) {
    next(error);
  }
});

fbrReferenceRouter.get("/hs-codes", async (req, res, next) => {
  try {
    res.json(await getItemDescriptions(forceRefresh(req)));
  } catch (error) {
    next(error);
  }
});

fbrReferenceRouter.get("/hscodes", async (req, res, next) => {
  try {
    res.json(await getItemDescriptions(forceRefresh(req)));
  } catch (error) {
    next(error);
  }
});

fbrReferenceRouter.get("/uoms", async (req, res, next) => {
  try {
    res.json(await getUoms(forceRefresh(req)));
  } catch (error) {
    next(error); 
  }
});

fbrReferenceRouter.get("/uom", async (req, res, next) => {
  try {
    res.json(await getUoms(forceRefresh(req)));
  } catch (error) {
    next(error);
  }
});

fbrReferenceRouter.get("/sro-item-codes", async (req, res, next) => {
  try {
    res.json(await getSroItemCodes(forceRefresh(req)));
  } catch (error) {
    next(error);
  }
});

fbrReferenceRouter.get("/transaction-types", async (req, res, next) => {
  try {
    res.json(await getTransactionTypes(forceRefresh(req)));
  } catch (error) {
    next(error);
  }
});

fbrReferenceRouter.get("/transactiontypes", async (req, res, next) => {
  try {
    res.json(await getTransactionTypes(forceRefresh(req)));
  } catch (error) {
    next(error);
  }
});

fbrReferenceRouter.get("/sro-schedules", async (req, res, next) => {
  try {
    res.json(
      await getSroSchedules({
        rateId: requiredAnyQuery(req, ["rate_id", "rateId"]),
        date: requiredQuery(req, "date"),
        originationSupplier: requiredAnyQuery(req, ["origination_supplier", "originationSupplier", "supplier", "province"]),
        forceRefresh: forceRefresh(req),
      }),
    );
  } catch (error) {
    next(error);
  }
});

fbrReferenceRouter.get("/sroschedule", async (req, res, next) => {
  try {
    res.json(
      await getSroSchedules({
        rateId: requiredAnyQuery(req, ["rate_id", "rateId"]),
        date: requiredQuery(req, "date"),
        originationSupplier: requiredAnyQuery(req, ["origination_supplier", "originationSupplier", "supplier", "province"]),
        forceRefresh: forceRefresh(req),
      }),
    );
  } catch (error) {
    next(error);
  }
});

fbrReferenceRouter.get("/tax-rates", async (req, res, next) => {
  try {
    res.json(
      await getSaleTypeRates({
        transTypeId: requiredAnyQuery(req, ["transTypeId", "trans_type_id", "transactionTypeId"]),
        date: requiredQuery(req, "date"),
        originationSupplier: requiredAnyQuery(req, ["originationSupplier", "origination_supplier", "supplier", "province"]),
        forceRefresh: forceRefresh(req),
      }),
    );
  } catch (error) {
    next(error);
  }
});

fbrReferenceRouter.get("/rates", async (req, res, next) => {
  try {
    res.json(
      await getSaleTypeRates({
        transTypeId: requiredAnyQuery(req, ["transTypeId", "trans_type_id", "transactionTypeId"]),
        date: requiredQuery(req, "date"),
        originationSupplier: requiredAnyQuery(req, ["originationSupplier", "origination_supplier", "supplier", "province"]),
        forceRefresh: forceRefresh(req),
      }),
    );
  } catch (error) {
    next(error);
  }
});

fbrReferenceRouter.get("/hs-uom", async (req, res, next) => {
  try {
    res.json(
      await getHsUoms({
        hsCode: requiredAnyQuery(req, ["hs_code", "hsCode"]),
        annexureId: requiredAnyQuery(req, ["annexure_id", "annexureId"]),
        forceRefresh: forceRefresh(req),
      }),
    );
  } catch (error) {
    next(error);
  }
});

fbrReferenceRouter.get("/hsuom", async (req, res, next) => {
  try {
    res.json(
      await getHsUoms({
        hsCode: requiredAnyQuery(req, ["hs_code", "hsCode"]),
        annexureId: requiredAnyQuery(req, ["annexure_id", "annexureId"]),
        forceRefresh: forceRefresh(req),
      }),
    );
  } catch (error) {
    next(error);
  }
});

fbrReferenceRouter.get("/sro-items", async (req, res, next) => {
  try {
    res.json(
      await getSroItems({
        date: requiredQuery(req, "date"),
        sroId: requiredAnyQuery(req, ["sro_id", "sroId"]),
        forceRefresh: forceRefresh(req),
      }),
    );
  } catch (error) {
    next(error);
  }
});

fbrReferenceRouter.get("/sroitem", async (req, res, next) => {
  try {
    res.json(
      await getSroItems({
        date: requiredQuery(req, "date"),
        sroId: requiredAnyQuery(req, ["sro_id", "sroId"]),
        forceRefresh: forceRefresh(req),
      }),
    );
  } catch (error) {
    next(error);
  }
});

fbrReferenceRouter.get("/statl", async (req, res, next) => {
  try {
    res.json(
      await getStatl({
        regno: requiredAnyQuery(req, ["regno", "registrationNo", "Registration_No", "ntn", "cnic"]),
        date: requiredQuery(req, "date"),
        forceRefresh: forceRefresh(req),
      }),
    );
  } catch (error) {
    next(error);
  }
});

fbrReferenceRouter.get("/registration-type", async (req, res, next) => {
  try {
    res.json(
      await getRegistrationType({
        registrationNo: requiredAnyQuery(req, ["Registration_No", "registrationNo", "regno", "ntn", "cnic"]),
        forceRefresh: forceRefresh(req),
      }),
    );
  } catch (error) {
    next(error);
  }
});

fbrReferenceRouter.get("/regtype", async (req, res, next) => {
  try {
    res.json(
      await getRegistrationType({
        registrationNo: requiredAnyQuery(req, ["Registration_No", "registrationNo", "regno", "ntn", "cnic"]),
        forceRefresh: forceRefresh(req),
      }),
    );
  } catch (error) {
    next(error);
  }
});

function forceRefresh(req: Request): boolean {
  const value = optionalAnyQuery(req, ["forceRefresh", "force_refresh", "refresh"]);
  return value === "true" || value === "1";
}

function requiredQuery(req: Request, key: string): string {
  const value = queryString(req, key);

  if (!value) {
    const error = new Error(`Missing required query parameter: ${key}`) as Error & { status?: number };
    error.status = 400;
    throw error;
  }

  return value;
}

function requiredAnyQuery(req: Request, keys: string[]): string {
  const value = optionalAnyQuery(req, keys);

  if (!value) {
    const error = new Error(`Missing required query parameter: ${keys.join(" or ")}`) as Error & { status?: number };
    error.status = 400;
    throw error;
  }

  return value;
}

function optionalAnyQuery(req: Request, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = queryString(req, key);
    if (value) return value;
  }

  return undefined;
}

function queryString(req: Request, key: string): string | undefined {
  const value = req.query[key];

  if (Array.isArray(value)) {
    const [first] = value;
    return typeof first === "string" ? first : undefined;
  }

  return typeof value === "string" ? value : undefined;
}
