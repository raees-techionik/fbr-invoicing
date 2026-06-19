import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import {
  submitInvoiceToFbr,
  validateInvoiceWithFbr,
  type FbrInvoiceInput,
  type FbrInvoiceSettings,
} from "./fbr-invoice.service.js";
import { getFbrErrorDefinition, type NormalizedFbrError } from "./fbr-error.service.js";
import { getOutboundIp, getPublicFbrSettings, getRuntimeFbrSettings } from "./fbr-settings.service.js";

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
  runMode: "mock" | "live";
  payload: unknown;
  mappedErrors: SandboxErrorDetail[];
  raw: unknown;
}

export interface SandboxErrorDetail {
  code: string;
  field: string;
  scope: string;
  itemIndex?: number;
  fbrMessage: string;
  fixHint: string;
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

export type SandboxPreflightSeverity = "success" | "warning" | "danger";

export interface SandboxPreflightCheck {
  id: string;
  label: string;
  passed: boolean;
  severity: SandboxPreflightSeverity;
  message: string;
  action: string;
}

export interface SandboxPreflightResult {
  readyForLive: boolean;
  canRunMock: boolean;
  canRunLive: boolean;
  generatedAt: string;
  environment: "sandbox" | "production";
  useMock: boolean;
  outboundIp: Awaited<ReturnType<typeof getOutboundIp>>;
  summary: {
    totalChecks: number;
    passedChecks: number;
    blockingIssues: number;
    warningIssues: number;
  };
  checks: SandboxPreflightCheck[];
}

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

  // I7 — Sector-specific fixtures
  {
    id: "SN003",
    name: "Steel Sector",
    description: "Steel sector goods using a sector-specific HS code and standard sales tax treatment.",
    category: "sector-specific",
    isPlaceholder: false,
    invoice: {
      invoiceType: "Sale Invoice",
      ...BASE_SELLER,
      ...BASE_BUYER_REGISTERED,
      scenarioId: "SN003",
      items: [
        {
          hsCode: "7214.2000",
          productDescription: "Test Steel Bars",
          rate: "18%",
          uoM: "KG",
          quantity: 1000,
          valueSalesExcludingST: 250000,
          salesTaxApplicable: 45000,
          furtherTax: 0,
          extraTax: "",
          fedPayable: 0,
          discount: 0,
          totalValues: 295000,
          fixedNotifiedValueOrRetailPrice: 0,
          salesTaxWithheldAtSource: 0,
          saleType: "Goods at standard rate (default)",
          sroScheduleNo: "",
          sroItemSerialNo: "",
        },
      ],
    },
  },
  {
    id: "SN009",
    name: "Textile Sector",
    description: "Textile sector goods using reduced-rate textile treatment.",
    category: "sector-specific",
    isPlaceholder: false,
    invoice: {
      invoiceType: "Sale Invoice",
      ...BASE_SELLER,
      ...BASE_BUYER_REGISTERED,
      scenarioId: "SN009",
      items: [
        {
          hsCode: "5208.1100",
          productDescription: "Test Cotton Fabric",
          rate: "5%",
          uoM: "METER",
          quantity: 500,
          valueSalesExcludingST: 120000,
          salesTaxApplicable: 6000,
          furtherTax: 0,
          extraTax: "",
          fedPayable: 0,
          discount: 0,
          totalValues: 126000,
          fixedNotifiedValueOrRetailPrice: 0,
          salesTaxWithheldAtSource: 0,
          saleType: "Goods at Reduced Rate",
          sroScheduleNo: "SRO 1125(I)/2011",
          sroItemSerialNo: "9",
        },
      ],
    },
  },
  {
    id: "SN010",
    name: "Telecom Sector",
    description: "Telecom sector services with sales tax and FED in sales-tax mode.",
    category: "sector-specific",
    isPlaceholder: false,
    invoice: {
      invoiceType: "Sale Invoice",
      ...BASE_SELLER,
      ...BASE_BUYER_REGISTERED,
      scenarioId: "SN010",
      items: [
        {
          hsCode: "9804.0000",
          productDescription: "Test Telecom Services",
          rate: "19.5%",
          uoM: "SERVICE",
          quantity: 1,
          valueSalesExcludingST: 100000,
          salesTaxApplicable: 19500,
          furtherTax: 0,
          extraTax: "",
          fedPayable: 5000,
          discount: 0,
          totalValues: 124500,
          fixedNotifiedValueOrRetailPrice: 0,
          salesTaxWithheldAtSource: 0,
          saleType: "Services",
          sroScheduleNo: "",
          sroItemSerialNo: "",
        },
      ],
    },
  },
  {
    id: "SN012",
    name: "Petroleum Sector",
    description: "Petroleum sector goods with standard tax and FED treatment.",
    category: "sector-specific",
    isPlaceholder: false,
    invoice: {
      invoiceType: "Sale Invoice",
      ...BASE_SELLER,
      ...BASE_BUYER_REGISTERED,
      scenarioId: "SN012",
      items: [
        {
          hsCode: "2710.1210",
          productDescription: "Test Petroleum Product",
          rate: "18%",
          uoM: "LITER",
          quantity: 1000,
          valueSalesExcludingST: 300000,
          salesTaxApplicable: 54000,
          furtherTax: 0,
          extraTax: "",
          fedPayable: 15000,
          discount: 0,
          totalValues: 369000,
          fixedNotifiedValueOrRetailPrice: 0,
          salesTaxWithheldAtSource: 0,
          saleType: "Goods at standard rate (default)",
          sroScheduleNo: "",
          sroItemSerialNo: "",
        },
      ],
    },
  },
];

// ─── Public API ───────────────────────────────────────────────────────────────

export function getSandboxScenarios(): SandboxScenario[] {
  return SANDBOX_SCENARIOS;
}

export async function getSandboxStatus(companyId: string): Promise<SandboxCompletionSummary> {
  const results = await loadResults(companyId);

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
  companyId: string,
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

  return executeScenario(companyId, scenario, options);
}

// I8 — Run all (or a named subset of) non-placeholder scenarios
export async function runScenarios(companyId: string, options: SandboxRunOptions = {}): Promise<SandboxBatchResult> {
  const candidates = SANDBOX_SCENARIOS.filter((s) => {
    if (s.isPlaceholder) return false;
    return !options.scenarioIds || options.scenarioIds.includes(s.id);
  });

  const skipped = options.scenarioIds
    ? SANDBOX_SCENARIOS.filter((s) => options.scenarioIds!.includes(s.id) && s.isPlaceholder).length
    : 0;

  const results: SandboxRunResult[] = [];

  for (const scenario of candidates) {
    results.push(await executeScenario(companyId, scenario, options));
  }

  return {
    processed: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    skipped,
    results,
  };
}

export async function getAllSandboxResults(companyId: string): Promise<Record<string, SandboxRunResult>> {
  return loadResults(companyId);
}

export async function getSandboxPreflight(companyId: string): Promise<SandboxPreflightResult> {
  const [settings, outboundIp, onboarding, companyProfile, sandboxStatus] = await Promise.all([
    getPublicFbrSettings(companyId, false),
    getOutboundIp(),
    prisma.fbrOnboarding.findUnique({ where: { companyId } }),
    prisma.companyProfile.findUnique({ where: { companyId } }),
    getSandboxStatus(companyId),
  ]);

  const sandboxTokenConfigured = settings.tokens.sandbox.configured;
  const isSandboxEnvironment = settings.environment === "sandbox";
  const liveModeEnabled = !settings.useMock;
  const ipWhitelistApproved = onboarding?.ipWhitelistStatus === "APPROVED";
  const outboundIpAvailable = Boolean(outboundIp.publicIp);
  const profileMissing = requiredProfileFields(companyProfile);
  const onboardingMissing = requiredOnboardingFields(onboarding);
  const fixturesReady = sandboxStatus.ready === 13 && sandboxStatus.placeholder === 0;

  const checks: SandboxPreflightCheck[] = [
    {
      id: "environment",
      label: "Sandbox environment selected",
      passed: isSandboxEnvironment,
      severity: isSandboxEnvironment ? "success" : "danger",
      message: isSandboxEnvironment
        ? "FBR calls are set to sandbox."
        : "FBR environment is not set to sandbox.",
      action: "Set FBR environment to sandbox in Settings before running PRAL scenarios.",
    },
    {
      id: "mock-mode",
      label: "Live mode enabled",
      passed: liveModeEnabled,
      severity: liveModeEnabled ? "success" : "danger",
      message: liveModeEnabled
        ? "Mock mode is disabled, so live FBR validation can be attempted."
        : "Mock mode is still enabled. Runs will not reach FBR.",
      action: "Disable mock mode in FBR Settings when sandbox credentials are available.",
    },
    {
      id: "sandbox-token",
      label: "Sandbox token configured",
      passed: sandboxTokenConfigured,
      severity: sandboxTokenConfigured ? "success" : "danger",
      message: sandboxTokenConfigured
        ? "A sandbox token is stored for this company."
        : "No company sandbox token is configured.",
      action: "Add the company sandbox token in FBR Settings.",
    },
    {
      id: "outbound-ip",
      label: "Outbound IP detected",
      passed: outboundIpAvailable,
      severity: outboundIpAvailable ? "success" : "warning",
      message: outboundIpAvailable
        ? `Outbound IP detected: ${outboundIp.publicIp}.`
        : "The server outbound IP could not be detected automatically.",
      action: "Set FBR_OUTBOUND_IP or run from the deployment server before sharing the IP with FBR/PRAL.",
    },
    {
      id: "ip-whitelist",
      label: "IP whitelist approved",
      passed: ipWhitelistApproved,
      severity: ipWhitelistApproved ? "success" : "danger",
      message: ipWhitelistApproved
        ? "Onboarding shows the FBR/PRAL IP whitelist as approved."
        : "Onboarding does not show IP whitelist approval yet.",
      action: "Update onboarding after FBR/PRAL confirms the outbound IP is whitelisted.",
    },
    {
      id: "company-profile",
      label: "Company seller profile complete",
      passed: profileMissing.length === 0,
      severity: profileMissing.length === 0 ? "success" : "warning",
      message: profileMissing.length === 0
        ? "Company seller profile has the required invoice identity fields."
        : `Missing profile fields: ${profileMissing.join(", ")}.`,
      action: "Complete company name, NTN/CNIC, business type, province, address, phone, and email in Company Profile.",
    },
    {
      id: "onboarding-profile",
      label: "Onboarding contact details complete",
      passed: onboardingMissing.length === 0,
      severity: onboardingMissing.length === 0 ? "success" : "warning",
      message: onboardingMissing.length === 0
        ? "Business nature, sector, and technical contact details are filled."
        : `Missing onboarding fields: ${onboardingMissing.join(", ")}.`,
      action: "Complete business nature, primary sector, and technical contact details in Onboarding.",
    },
    {
      id: "scenario-fixtures",
      label: "Required scenario fixtures ready",
      passed: fixturesReady,
      severity: fixturesReady ? "success" : "danger",
      message: fixturesReady
        ? `${sandboxStatus.ready} required scenarios are ready and no placeholders remain.`
        : `${sandboxStatus.ready} scenarios are ready and ${sandboxStatus.placeholder} placeholders remain.`,
      action: "Complete all required scenario fixtures before live sandbox certification.",
    },
  ];

  const blockingIssues = checks.filter((check) => !check.passed && check.severity === "danger").length;
  const warningIssues = checks.filter((check) => !check.passed && check.severity === "warning").length;
  const passedChecks = checks.filter((check) => check.passed).length;

  return {
    readyForLive: blockingIssues === 0,
    canRunMock: fixturesReady,
    canRunLive: blockingIssues === 0,
    generatedAt: new Date().toISOString(),
    environment: settings.environment,
    useMock: settings.useMock,
    outboundIp,
    summary: {
      totalChecks: checks.length,
      passedChecks,
      blockingIssues,
      warningIssues,
    },
    checks,
  };
}

export async function clearSandboxResults(companyId: string): Promise<{ cleared: boolean; count: number }> {
  const deleted = await prisma.sandboxResult.deleteMany({ where: { companyId } });
  return { cleared: true, count: deleted.count };
}

// ─── Private ──────────────────────────────────────────────────────────────────

async function executeScenario(
  companyId: string,
  scenario: SandboxScenario,
  options: SandboxRunOptions,
): Promise<SandboxRunResult> {
  const operation = options.operation ?? "validate";
  const settings: FbrInvoiceSettings = { environment: "sandbox", ...(options.settings ?? {}) };
  const runtimeSettings = await getRuntimeFbrSettings(companyId, settings);
  const runMode = runtimeSettings.useMock ? "mock" : "live";
  const start = Date.now();
  const existingOnboarding = await prisma.fbrOnboarding.findUnique({ where: { companyId } });
  await prisma.fbrOnboarding.upsert({
    where: { companyId },
    create: {
      companyId,
      status: "SANDBOX_TESTING",
      sandboxStatus: "IN_PROGRESS",
      sandboxStartedAt: new Date(start),
    },
    update: {
      status: "SANDBOX_TESTING",
      sandboxStatus: "IN_PROGRESS",
      sandboxStartedAt: existingOnboarding?.sandboxStartedAt ?? new Date(start),
    },
  });

  let result: SandboxRunResult;
  let payloadForStorage: FbrInvoiceInput = scenario.invoice;

  try {
    const fbrResult =
      operation === "submit"
        ? await submitInvoiceToFbr(companyId, scenario.invoice, settings)
        : await validateInvoiceWithFbr(companyId, scenario.invoice, settings);
    payloadForStorage = fbrResult.payload;

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
      runMode,
      payload: maskSensitive(fbrResult.payload),
      mappedErrors: mapSandboxErrors(fbrResult.errors, fbrResult.raw),
      raw: maskSensitive(fbrResult.raw),
    };
  } catch (error) {
    const err = error as Error & { status?: number; code?: string };
    const transportErrors = [{ message: err.message, code: err.code, status: err.status }];
    result = {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      passed: false,
      statusCode: "ERR",
      invoiceNumber: "",
      errors: transportErrors,
      runAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      operationType: operation,
      runMode,
      payload: maskSensitive(scenario.invoice),
      mappedErrors: mapSandboxErrors(transportErrors, { error: err.message, code: err.code }),
      raw: { error: err.message, code: err.code },
    };
  }

  await saveResult(companyId, payloadForStorage, result);
  await logToFile(companyId, result);
  return result;
}

async function saveResult(companyId: string, payload: FbrInvoiceInput, result: SandboxRunResult): Promise<void> {
  await prisma.sandboxResult.create({
    data: {
      companyId,
      scenarioId: result.scenarioId,
      scenarioName: result.scenarioName,
      operation: result.operationType === "submit" ? "SUBMIT" : "VALIDATE",
      status: result.passed ? "PASSED" : "FAILED",
      statusCode: result.statusCode,
      invoiceNumber: result.invoiceNumber || null,
      payload: toJson(payload),
      response: toJson(result),
      errors: toJson(result.errors),
      durationMs: result.durationMs,
      runAt: new Date(result.runAt),
      passedAt: result.passed ? new Date(result.runAt) : null,
    },
  });
  const results = await loadResults(companyId);
  const requiredScenarioIds = SANDBOX_SCENARIOS
    .filter((scenario) => !scenario.isPlaceholder)
    .map((scenario) => scenario.id);
  const allPassed = requiredScenarioIds.every((scenarioId) => results[scenarioId]?.passed === true);
  await prisma.fbrOnboarding.update({
    where: { companyId },
    data: {
      sandboxStatus: allPassed ? "PASSED" : "IN_PROGRESS",
      status: allPassed ? "CLIENT_TESTING" : "SANDBOX_TESTING",
      ...(allPassed ? { sandboxCompletedAt: new Date() } : {}),
    },
  });
}

async function loadResults(companyId: string): Promise<Record<string, SandboxRunResult>> {
  const records = await prisma.sandboxResult.findMany({
    where: { companyId },
    orderBy: [{ runAt: "desc" }, { createdAt: "desc" }],
    select: {
      scenarioId: true,
      operation: true,
      payload: true,
      response: true,
      errors: true,
    },
  });
  const results: Record<string, SandboxRunResult> = {};
  for (const record of records) {
    if (!results[record.scenarioId] && record.response) {
      const response = record.response as unknown as Partial<SandboxRunResult>;
      const rawErrors = Array.isArray(response.errors)
        ? response.errors
        : Array.isArray(record.errors)
          ? record.errors
          : [];
      results[record.scenarioId] = {
        ...response,
        operationType: response.operationType ?? (record.operation === "SUBMIT" ? "submit" : "validate"),
        runMode: response.runMode ?? inferRunMode(response),
        payload: maskSensitive(response.payload ?? record.payload),
        mappedErrors: response.mappedErrors?.length
          ? response.mappedErrors
          : mapSandboxErrors(rawErrors, response.raw),
        raw: maskSensitive(response.raw),
      } as SandboxRunResult;
    }
  }
  return results;
}

async function logToFile(companyId: string, result: SandboxRunResult): Promise<void> {
  const logPath =
    process.env.FBR_SANDBOX_LOG_PATH ?? join(process.cwd(), ".data", "sandbox-results.log");
  await mkdir(dirname(logPath), { recursive: true });
  await appendFile(logPath, `${JSON.stringify({ companyId, ...result })}\n`, "utf8");
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function httpError(status: number, message: string): Error & { status?: number } {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function mapSandboxErrors(errors: unknown[], raw: unknown): SandboxErrorDetail[] {
  const candidates = errors.length > 0 ? errors : extractRawErrors(raw);

  return candidates.map((error) => {
    const value = asRecord(error);
    const normalized = value as Partial<NormalizedFbrError> & { code?: string; status?: number };
    const code = String(normalized.errorCode ?? normalized.code ?? "UNKNOWN");
    const fbrMessage = String(normalized.fbrMessage ?? normalized.message ?? "FBR request failed.");
    const definition = getFbrErrorDefinition(code, "sales", fbrMessage);

    return {
      code,
      field: normalized.field || transportField(code),
      scope: normalized.scope || "general",
      ...(typeof normalized.itemIndex === "number" ? { itemIndex: normalized.itemIndex } : {}),
      fbrMessage,
      fixHint: normalized.userMessage || transportHint(code, definition.message),
    };
  });
}

function transportHint(code: string, fallback: string): string {
  const hints: Record<string, string> = {
    FBR_TOKEN_MISSING: "Add the company sandbox token in Settings, then retry in Live FBR mode.",
    FBR_TOKEN_INVALID: "Replace the sandbox token in Settings and verify it before retrying.",
    FBR_REQUEST_FAILED: "Confirm internet access, FBR availability, and IP whitelist approval before retrying.",
    ECONNREFUSED: "Confirm the FBR endpoint is reachable from this server and the outbound IP is whitelisted.",
    ETIMEDOUT: "Retry after checking FBR connectivity and the server outbound network route.",
  };
  return hints[code] || fallback;
}

function transportField(code: string): string {
  if (code.includes("TOKEN")) return "sandboxToken";
  if (code.includes("TIME") || code.includes("CONN") || code.includes("REQUEST")) return "connection";
  return "invoice";
}

function extractRawErrors(raw: unknown): unknown[] {
  const value = asRecord(raw);
  if (value.error || value.message || value.errorCode || value.code) {
    return [{
      errorCode: value.errorCode ?? value.code,
      message: value.error ?? value.message,
    }];
  }
  return [];
}

function inferRunMode(response: Partial<SandboxRunResult>): "mock" | "live" {
  const invoiceNumber = String(response.invoiceNumber ?? "").toUpperCase();
  return invoiceNumber.startsWith("MOCK") ? "mock" : "live";
}

function maskSensitive(value: unknown, key = ""): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => maskSensitive(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        maskSensitive(entryValue, entryKey),
      ]),
    );
  }

  const normalizedKey = key.toLowerCase();
  if (/(token|authorization|password|secret)/.test(normalizedKey)) return "[masked]";
  if (/(ntn|cnic)/.test(normalizedKey)) return maskIdentifier(value);
  if (/(address|phone|mobile)/.test(normalizedKey)) return value ? "[masked]" : value;
  if (/email/.test(normalizedKey)) return maskEmail(value);
  return value;
}

function maskIdentifier(value: unknown): unknown {
  const text = String(value ?? "");
  if (!text) return value;
  return `****${text.replace(/\s/g, "").slice(-4)}`;
}

function maskEmail(value: unknown): unknown {
  const text = String(value ?? "");
  const [, domain] = text.split("@");
  return domain ? `***@${domain}` : text ? "[masked]" : value;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function requiredProfileFields(profile: Awaited<ReturnType<typeof prisma.companyProfile.findUnique>>): string[] {
  return [
    ["company name", profile?.companyName],
    ["NTN/CNIC", profile?.ntnOrCnic],
    ["business type", profile?.businessType],
    ["province", profile?.province],
    ["address", profile?.address],
    ["phone", profile?.phoneNumber],
    ["email", profile?.emailAddress],
  ]
    .filter(([, value]) => !String(value ?? "").trim())
    .map(([label]) => String(label));
}

function requiredOnboardingFields(onboarding: Awaited<ReturnType<typeof prisma.fbrOnboarding.findUnique>>): string[] {
  return [
    ["business nature", onboarding?.businessNature],
    ["primary sector", onboarding?.primarySector],
    ["technical contact name", onboarding?.technicalContactName],
    ["technical contact mobile", onboarding?.technicalContactMobile],
    ["technical contact email", onboarding?.technicalContactEmail],
  ]
    .filter(([, value]) => !String(value ?? "").trim())
    .map(([label]) => String(label));
}
