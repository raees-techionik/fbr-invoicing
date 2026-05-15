import type { Request } from "express";
import { Router } from "express";
import {
  bulkImportProductMappings,
  createProductMapping,
  deleteProductMapping,
  getProductAutofill,
  getProductMapping,
  listProductMappings,
  resolveHsInvoiceFields,
  searchHsCodeSuggestions,
  updateProductMapping,
} from "../services/fbr-product-mapping.service.js";

export const fbrProductMappingRouter = Router();

fbrProductMappingRouter.get("/", async (req, res, next) => {
  try {
    res.json({
      data: await listProductMappings({
        search: queryString(req, "search"),
        status: queryString(req, "status"),
        limit: numberQuery(req, "limit"),
      }),
    });
  } catch (error) {
    next(error);
  }
});

fbrProductMappingRouter.get("/hs-search", async (req, res, next) => {
  try {
    res.json(await searchHsCodeSuggestions(queryString(req, "query") ?? "", numberQuery(req, "limit") ?? 20));
  } catch (error) {
    next(error);
  }
});

fbrProductMappingRouter.get("/resolve", async (req, res, next) => {
  try {
    res.json({
      data: await resolveHsInvoiceFields({
        hsCode: requiredQuery(req, "hsCode"),
        saleType: queryString(req, "saleType"),
        invoiceDate: queryString(req, "invoiceDate"),
        originationSupplier: queryString(req, "originationSupplier"),
        annexureId: queryString(req, "annexureId"),
      }),
    });
  } catch (error) {
    next(error);
  }
});

fbrProductMappingRouter.get("/:id/autofill", async (req, res, next) => {
  try {
    res.json({ data: await getProductAutofill(req.params.id) });
  } catch (error) {
    next(error);
  }
});

fbrProductMappingRouter.get("/:id", async (req, res, next) => {
  try {
    res.json({ data: await getProductMapping(req.params.id) });
  } catch (error) {
    next(error);
  }
});

fbrProductMappingRouter.post("/bulk-import", async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body) ? req.body : req.body?.products;
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: "Request body must be a non-empty array of products, or { products: [...] }" });
      return;
    }
    res.json({ data: await bulkImportProductMappings(rows) });
  } catch (error) {
    next(error);
  }
});

fbrProductMappingRouter.post("/", async (req, res, next) => {
  try {
    res.status(201).json({ data: await createProductMapping(req.body) });
  } catch (error) {
    next(error);
  }
});

fbrProductMappingRouter.put("/:id", async (req, res, next) => {
  try {
    res.json({ data: await updateProductMapping(req.params.id, req.body) });
  } catch (error) {
    next(error);
  }
});

fbrProductMappingRouter.delete("/:id", async (req, res, next) => {
  try {
    res.json({ data: await deleteProductMapping(req.params.id) });
  } catch (error) {
    next(error);
  }
});

function requiredQuery(req: Request, key: string): string {
  const value = queryString(req, key);

  if (!value) {
    const error = new Error(`Missing required query parameter: ${key}`) as Error & { status?: number };
    error.status = 400;
    throw error;
  }

  return value;
}

function queryString(req: Request, key: string): string | undefined {
  const value = req.query[key];

  if (Array.isArray(value)) {
    const [first] = value;
    return typeof first === "string" ? first : undefined;
  }

  return typeof value === "string" ? value : undefined;
}

function numberQuery(req: Request, key: string): number | undefined {
  const value = queryString(req, key);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
