import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getCache } from "../lib/cache.js";
import {
  submitInvoiceToFbr,
  validateInvoiceWithFbr,
  type FbrInvoiceInput,
  type FbrInvoiceSettings,
} from "./fbr-invoice.service.js";

export type SandboxOperationType = "validate" | "submit";
export type SandboxOverallStatus = "not_run" | "passed" | "failed" | "placeholder";
export type SandboxCategory = "general" | "sector-specific";

export interface SandboxScenario {
  id: string;
  name: string;
  description: string;
  category: SandboxCategory;
  isPlaceholder: boolean;
  invoice: FbrInvoiceInput;
}

export interface SandboxRunResult {
  scenarioId: string;
  scenarioName: string;
  passed: boolean;
  statusCode: string;
  invoiceNumber: string;
  errors: unknown[];
  runAt: string;
  durationMs: number;
  operationType: SandboxOperationType;
  raw: unknown;
}

export interface SandboxScenarioStatus {
  scenarioId: string;
  scenarioName: string;
  description: string;
  category: SandboxCategory;
  isPlaceholder: boolean;
  overallStatus: SandboxOverallStatus;
  lastResult?: SandboxRunResult;
}

export interface SandboxCompletionSummary {
  total: number;
  ready: number;
  placeholder: number;
  passed: number;
  failed: number;
  notRun: number;
  pralProgress: string;
  eligibleForProduction: boolean;
  scenarios: SandboxScenarioStatus[];
}

export interface SandboxBatchResult {
  processed: number;
  passed: number;
  failed: number;
  skipped: number;
  results: SandboxRunResult[];
}

export interface SandboxRunOptions {
  operation?: SandboxOperationType;
  settings?: FbrInvoiceSettings;
  scenarioIds?: string[];
}

const SANDBOX_RESULTS_CACHE_KEY = "fbr:sandbox:results";

// ─── Seller / Buyer shared blocks ────────────────────────────────────────────

const BASE_SELLER = {
  sellerNTNCNIC: "0788762",
  sellerBusinessName: "TEST SELLER COMPANY (PVT) LTD",
  sellerProvince: "7",
  sellerAddress: "123 Model Town, Lahore",
};

const BASE_BUYER_REGISTERED = {
  buyerNTNCNIC: "0123456",
  buyerBusinessName: "TEST BUYER COMPANY (PVT) LTD",
  buyerProvince: "7",
  buyerAddress: "456 Gulberg, Lahore",
  buyerRegistrationType: "Registered",
};

const BASE_BUYER_UNREGISTERED = {
  buyerNTNCNIC: "35201-1234567-1",
  buyerBusinessName: "UNREGISTERED TEST BUYER",
  buyerProvince: "8",
  buyerAddress: "789 Saddar, Karachi",
  buyerRegistrationType: "Unregistered",
};

function placeholderInvoice(scenarioId: string): FbrInvoiceInput {
  return { invoiceType: "Sale Invoice", scenarioId, items: [] };
}

// ─── Scenario Fixtures (I1 – I7) ─────────────────────────────────────────────

const SANDBOX_SCENARIOS: SandboxScenario[] = [
  // I1 — SN001: Goods at standard rate, registered buyer
  {
    id: "SN001",
    name: "Goods at Standard Rate — Registered Buyer",
    description: "Standard 18% sales tax on goods, buyer is registered with FBR.",
    category: "general",
    isPlaceholder: false,
    invoice: {
      invoiceType: "Sale Invoice",
      ...BASE_SELLER,
      ...BASE_BUYER_REGISTERED,
      scenarioId: "SN001",
      items: [
        {
          hsCode: "8432.1010",
          productDescription: "Test Goods — Standard Rate",
          rate: "18%",
          uoM: "KG",
          quantity: 10,
          valueSalesExcludingST: 100000,
          salesTaxApplicable: 18000,
          furtherTax: 0,
          extraTax: "",
          fedPayable: 0,
          discount: 0,
          totalValues: 118000,
          fixedNotifiedValueOrRetailPrice: 0,
          salesTaxWithheldAtSource: 0,
          saleType: "Goods at standard rate (default)",
          sroScheduleNo: "",
          sroItemSerialNo: "",
        },
      ],
    },
  },

  // I2 — SN002: Goods at standard rate, unregistered buyer
  {
    id: "SN002",
    name: "Goods at Standard Rate — Unregistered Buyer",
    description: "Standard 18% sales tax on goods, buyer is unregistered. Further tax (1%) applies.",
    category: "general",
    isPlaceholder: false,
    invoice: {
      invoiceType: "Sale Invoice",
      ...BASE_SELLER,
      ...BASE_BUYER_UNREGISTERED,
      scenarioId: "SN002",
      items: [
        {
          hsCode: "8432.1010",
          productDescription: "Test Goods — Standard Rate (Unregistered Buyer)",
          rate: "18%",
          uoM: "KG",
          quantity: 5,
          valueSalesExcludingST: 50000,
          salesTaxApplicable: 9000,
          furtherTax: 500,
          extraTax: "",
          fedPayable: 0,
          discount: 0,
          totalValues: 59500,
          fixedNotifiedValueOrRetailPrice: 0,
          salesTaxWithheldAtSource: 0,
          saleType: "Goods at standard rate (default)",
          sroScheduleNo: "",
          sroItemSerialNo: "",
        },
      ],
    },
  },

  // I3 — SN005: Reduced rate goods
  {
    id: "SN005",
    name: "Goods at Reduced Rate",
    description: "Goods taxed at a reduced SRO rate (5%) rather than the standard 18%.",
    category: "general",
    isPlaceholder: false,
    invoice: {
      invoiceType: "Sale Invoice",
      ...BASE_SELLER,
      ...BASE_BUYER_REGISTERED,
      scenarioId: "SN005",
      items: [
        {
          hsCode: "0101.2100",
          productDescription: "Test Goods — Reduced Rate",
          rate: "5%",
          uoM: "KG",
          quantity: 20,
          valueSalesExcludingST: 200000,
          salesTaxApplicable: 10000,
          furtherTax: 0,
          extraTax: "",
          fedPayable: 0,
          discount: 0,
          totalValues: 210000,
          fixedNotifiedValueOrRetailPrice: 0,
          salesTaxWithheldAtSource: 0,
          saleType: "Goods at Reduced Rate",
          sroScheduleNo: "SRO 1125(I)/2011",
          sroItemSerialNo: "9",
        },
      ],
    },
  },

  // I3 — SN006: Exempt goods
  {
    id: "SN006",
    name: "Exempt Goods",
    description: "Goods that are fully exempt from sales tax under the Fifth Schedule. Zero tax.",
    category: "general",
    isPlaceholder: false,
    invoice: {
      invoiceType: "Sale Invoice",
      ...BASE_SELLER,
      ...BASE_BUYER_REGISTERED,
      scenarioId: "SN006",
      items: [
        {
          hsCode: "0101.2100",
          productDescription: "Test Goods — Exempt",
          rate: "0%",
          uoM: "KG",
          quantity: 100,
          valueSalesExcludingST: 500000,
          salesTaxApplicable: 0,
          furtherTax: 0,
          extraTax: "",
          fedPayable: 0,
          discount: 0,
          totalValues: 500000,
          fixedNotifiedValueOrRetailPrice: 0,
          salesTaxWithheldAtSource: 0,
          saleType: "Exempt Goods",
          sroScheduleNo: "",
          sroItemSerialNo: "",
        },
      ],
    },
  },

  // I3 — SN007: Zero rated goods
  {
    id: "SN007",
    name: "Zero Rated Goods",
    description: "Goods taxed at zero rate (exports or specific zero-rated categories, e.g. 5th Schedule).",
    category: "general",
    isPlaceholder: false,
    invoice: {
      invoiceType: "Sale Invoice",
      ...BASE_SELLER,
      ...BASE_BUYER_REGISTERED,
      scenarioId: "SN007",
      items: [
        {
          hsCode: "0101.2100",
          productDescription: "Test Goods — Zero Rated",
          rate: "0%",
          uoM: "KG",
          quantity: 50,
          valueSalesExcludingST: 300000,
          salesTaxApplicable: 0,
          furtherTax: 0,
          extraTax: "",
          fedPayable: 0,
          discount: 0,
          totalValues: 300000,
          fixedNotifiedValueOrRetailPrice: 0,
          salesTaxWithheldAtSource: 0,
          saleType: "Zero Rated Goods",
          sroScheduleNo: "",
          sroItemSerialNo: "",
        },
      ],
    },
  },

  // I4 — SN008: Third schedule goods (tax on fixed notified / retail price)
  {
    id: "SN008",
    name: "Third Schedule Goods",
    description: "Goods in the Third Schedule where tax is charged on fixed notified value or retail price, not the sale value.",
    category: "general",
    isPlaceholder: false,
    invoice: {
      invoiceType: "Sale Invoice",
      ...BASE_SELLER,
      ...BASE_BUYER_REGISTERED,
      scenarioId: "SN008",
      items: [
        {
          hsCode: "8432.1010",
          productDescription: "Test Goods — Third Schedule",
          rate: "18%",
          uoM: "EACH",
          quantity: 100,
          valueSalesExcludingST: 80000,
          fixedNotifiedValueOrRetailPrice: 100000,
          salesTaxApplicable: 18000,
          furtherTax: 0,
          extraTax: "",
          fedPayable: 0,
          discount: 0,
          totalValues: 98000,
          salesTaxWithheldAtSource: 0,
          saleType: "Third Schedule Goods",
          sroScheduleNo: "",
          sroItemSerialNo: "",
        },
      ],
    },
  },

  // I5 — SN017: FED in ST mode (goods)
  {
    id: "SN017",
    name: "FED in ST Mode — Goods",
    description: "Goods subject to Federal Excise Duty collected in Sales Tax mode. fedPayable is non-zero.",
    category: "general",
    isPlaceholder: false,
    invoice: {
      invoiceType: "Sale Invoice",
      ...BASE_SELLER,
      ...BASE_BUYER_REGISTERED,
      scenarioId: "SN017",
      items: [
        {
          hsCode: "8432.1010",
          productDescription: "Test Goods — FED in ST Mode",
          rate: "18%",
          uoM: "KG",
          quantity: 10,
          valueSalesExcludingST: 100000,
          salesTaxApplicable: 18000,
          furtherTax: 0,
          extraTax: "",
          fedPayable: 10000,
          discount: 0,
          totalValues: 128000,
          fixedNotifiedValueOrRetailPrice: 0,
          salesTaxWithheldAtSource: 0,
          saleType: "Goods at standard rate (default)",
          sroScheduleNo: "",
          sroItemSerialNo: "",
        },
      ],
    },
  },

  // I5 — SN018: FED in ST mode (services)
  {
    id: "SN018",
    name: "FED in ST Mode — Services",
    description: "Services subject to Federal Excise Duty collected in Sales Tax mode.",
    category: "general",
    isPlaceholder: false,
    invoice: {
      invoiceType: "Sale Invoice",
      ...BASE_SELLER,
      ...BASE_BUYER_REGISTERED,
      scenarioId: "SN018",
      items: [
        {
          hsCode: "9803.9900",
          productDescription: "Test Services — FED in ST Mode",
          rate: "16%",
          uoM: "SERVICE",
          quantity: 1,
          valueSalesExcludingST: 150000,
          salesTaxApplicable: 24000,
          furtherTax: 0,
          extraTax: "",
          fedPayable: 15000,
          discount: 0,
          totalValues: 189000,
          fixedNotifiedValueOrRetailPrice: 0,
          salesTaxWithheldAtSource: 0,
          saleType: "Services",
          sroScheduleNo: "",
          sroItemSerialNo: "",
        },
      ],
    },
  },

  // I6 — SN019: Services
  {
    id: "SN019",
    name: "Services",
    description: "Standard services invoice subject to sales tax on services.",
    category: "general",
    isPlaceholder: false,
    invoice: {
      invoiceType: "Sale Invoice",
      ...BASE_SELLER,
      ...BASE_BUYER_REGISTERED,
      scenarioId: "SN019",
      items: [
        {
          hsCode: "9803.9900",
          productDescription: "Test Services — Standard",
          rate: "16%",
          uoM: "SERVICE",
          quantity: 1,
          valueSalesExcludingST: 200000,
          salesTaxApplicable: 32000,
          furtherTax: 0,
          extraTax: "",
          fedPayable: 0,
          discount: 0,
          totalValues: 232000,
          fixedNotifiedValueOrRetailPrice: 0,
          salesTaxWithheldAtSource: 0,
          saleType: "Services",
          sroScheduleNo: "",
          sroItemSerialNo: "",
        },
      ],
    },
  },

  // I7 — Sector-specific placeholders (fill in once business type confirmed by client)
  {
    id: "SN003",
    name: "Steel Sector — Placeholder",
    description: "Steel sector goods. Fill in HS codes, SRO details, and rates once client business type is confirmed.",
    category: "sector-specific",
    isPlaceholder: true,
    invoice: placeholderInvoice("SN003"),
  },
  {
    id: "SN009",
    name: "Textile Sector — Placeholder",
    description: "Textile sector goods. Fill in HS codes, SRO details, and rates once client business type is confirmed.",
    category: "sector-specific",
    isPlaceholder: true,
    invoice: placeholderInvoice("SN009"),
  },
  {
    id: "SN010",
    name: "Telecom Sector — Placeholder",
    description: "Telecom sector services. Fill in service codes and FED/ST treatment once client business type is confirmed.",
    category: "sector-specific",
    isPlaceholder: true,
    invoice: placeholderInvoice("SN010"),
  },
  {
    id: "SN012",
    name: "Petroleum Sector — Placeholder",
    description: "Petroleum sector goods. Fill in HS codes, FED rates, and SRO details once client business type is confirmed.",
    category: "sector-specific",
    isPlaceholder: true,
    invoice: placeholderInvoice("SN012"),
  },
];

// ─── Public API ───────────────────────────────────────────────────────────────

export function getSandboxScenarios(): SandboxScenario[] {
  return SANDBOX_SCENARIOS;
}

export async function getSandboxStatus(): Promise<SandboxCompletionSummary> {
  const results = await loadResults();

  const scenarios: SandboxScenarioStatus[] = SANDBOX_SCENARIOS.map((scenario) => {
    if (scenario.isPlaceholder) {
      return {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        description: scenario.description,
        category: scenario.category,
        isPlaceholder: true,
        overallStatus: "placeholder" as SandboxOverallStatus,
      };
    }

    const lastResult = results[scenario.id];
    const overallStatus: SandboxOverallStatus = !lastResult ? "not_run" : lastResult.passed ? "passed" : "failed";

    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      description: scenario.description,
      category: scenario.category,
      isPlaceholder: false,
      overallStatus,
      lastResult,
    };
  });

  const ready = scenarios.filter((s) => !s.isPlaceholder).length;
  const placeholder = scenarios.filter((s) => s.isPlaceholder).length;
  const passed = scenarios.filter((s) => s.overallStatus === "passed").length;
  const failed = scenarios.filter((s) => s.overallStatus === "failed").length;
  const notRun = scenarios.filter((s) => s.overallStatus === "not_run").length;

  const eligibleForProduction = ready > 0 && passed === ready;

  return {
    total: scenarios.length,
    ready,
    placeholder,
    passed,
    failed,
    notRun,
    pralProgress: `${passed} / ${ready} ready scenarios passed`,
    eligibleForProduction,
    scenarios,
  };
}

// I8 — Run a single named scenario
export async function runScenario(
  scenarioId: string,
  options: SandboxRunOptions = {},
): Promise<SandboxRunResult> {
  const scenario = SANDBOX_SCENARIOS.find((s) => s.id === scenarioId);

  if (!scenario) {
    throw httpError(404, `Sandbox scenario ${scenarioId} not found.`);
  }

  if (scenario.isPlaceholder) {
    throw httpError(
      400,
      `Scenario ${scenarioId} is a placeholder and cannot be run. Fill in the invoice details first.`,
    );
  }

  return executeScenario(scenario, options);
}

// I8 — Run all (or a named subset of) non-placeholder scenarios
export async function runScenarios(options: SandboxRunOptions = {}): Promise<SandboxBatchResult> {
  const candidates = SANDBOX_SCENARIOS.filter((s) => {
    if (s.isPlaceholder) return false;
    return !options.scenarioIds || options.scenarioIds.includes(s.id);
  });

  const skipped = options.scenarioIds
    ? SANDBOX_SCENARIOS.filter((s) => options.scenarioIds!.includes(s.id) && s.isPlaceholder).length
    : 0;

  const results: SandboxRunResult[] = [];

  for (const scenario of candidates) {
    results.push(await executeScenario(scenario, options));
  }

  return {
    processed: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    skipped,
    results,
  };
}

export async function getAllSandboxResults(): Promise<Record<string, SandboxRunResult>> {
  return loadResults();
}

export async function clearSandboxResults(): Promise<{ cleared: boolean }> {
  await getCache().del(SANDBOX_RESULTS_CACHE_KEY);
  return { cleared: true };
}

// ─── Private ──────────────────────────────────────────────────────────────────

async function executeScenario(
  scenario: SandboxScenario,
  options: SandboxRunOptions,
): Promise<SandboxRunResult> {
  const operation = options.operation ?? "validate";
  const settings: FbrInvoiceSettings = { environment: "sandbox", ...(options.settings ?? {}) };
  const start = Date.now();

  let result: SandboxRunResult;

  try {
    const fbrResult =
      operation === "submit"
        ? await submitInvoiceToFbr(scenario.invoice, settings)
        : await validateInvoiceWithFbr(scenario.invoice, settings);

    result = {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      passed: fbrResult.isValid,
      statusCode: fbrResult.statusCode,
      invoiceNumber: fbrResult.invoiceNumber,
      errors: fbrResult.errors,
      runAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      operationType: operation,
      raw: fbrResult.raw,
    };
  } catch (error) {
    const err = error as Error & { status?: number; code?: string };
    result = {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      passed: false,
      statusCode: "ERR",
      invoiceNumber: "",
      errors: [{ message: err.message, code: err.code, status: err.status }],
      runAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      operationType: operation,
      raw: { error: err.message, code: err.code },
    };
  }

  await saveResult(result);
  await logToFile(result);
  return result;
}

async function saveResult(result: SandboxRunResult): Promise<void> {
  const all = await loadResults();
  all[result.scenarioId] = result;
  await getCache().set(SANDBOX_RESULTS_CACHE_KEY, JSON.stringify(all));
}

async function loadResults(): Promise<Record<string, SandboxRunResult>> {
  const cached = await getCache().get(SANDBOX_RESULTS_CACHE_KEY);
  return cached ? (JSON.parse(cached) as Record<string, SandboxRunResult>) : {};
}

async function logToFile(result: SandboxRunResult): Promise<void> {
  const logPath =
    process.env.FBR_SANDBOX_LOG_PATH ?? join(process.cwd(), ".data", "sandbox-results.log");
  await mkdir(dirname(logPath), { recursive: true });
  await appendFile(logPath, `${JSON.stringify(result)}\n`, "utf8");
}

function httpError(status: number, message: string): Error & { status?: number } {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}
