import "dotenv/config";
import bcrypt from "bcryptjs";
import {
  CompanyKind,
  FbrApprovalStatus,
  FbrOnboardingStatus,
  FbrSandboxOperation,
  FbrSandboxResultStatus,
  FbrSandboxStatus,
  FbrTokenStatus,
  MembershipRole,
  type Prisma,
} from "../generated/prisma/client.js";
import { getCache } from "../src/lib/cache.js";
import { prisma } from "../src/lib/prisma.js";

const DEMO_USER_ID = "mock-demo-owner";
const DEMO_COMPANY_ID = "mock-demo-company";
const DEMO_EMAIL = process.env.MOCK_SEED_EMAIL || "demo.owner@techionik.test";
const DEMO_PASSWORD = process.env.MOCK_SEED_PASSWORD || "Demo12345!";
const DEMO_COMPANY_NAME = process.env.MOCK_SEED_COMPANY || "Techionik Demo Traders";

const customerIds = [
  "mock-customer-blue-mart",
  "mock-customer-karachi-retail",
  "mock-customer-lahore-distributors",
  "mock-customer-islamabad-services",
];

const productIds = [
  "mock-product-laptop",
  "mock-product-printer-paper",
  "mock-product-packaged-tea",
  "mock-product-consulting",
  "mock-product-telecom",
];

const staffIds = [
  "mock-staff-accounts",
  "mock-staff-sales",
  "mock-staff-fbr-admin",
];

const invoiceIds = [
  "mock-invoice-submitted-001",
  "mock-invoice-submitted-002",
  "mock-invoice-failed-001",
  "mock-invoice-draft-001",
  "mock-invoice-offline-001",
];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { email: DEMO_EMAIL },
      create: {
        id: DEMO_USER_ID,
        email: DEMO_EMAIL,
        passwordHash,
        fullName: "Demo Owner",
        phone: "+92-300-0000000",
        isSuperAdmin: true,
      },
      update: {
        passwordHash,
        fullName: "Demo Owner",
        phone: "+92-300-0000000",
        isSuperAdmin: true,
      },
    });

    const company = await tx.company.upsert({
      where: { id: DEMO_COMPANY_ID },
      create: {
        id: DEMO_COMPANY_ID,
        name: DEMO_COMPANY_NAME,
        legalName: "Techionik Demo Traders (Private) Limited",
        ntn: "1234567-8",
        kind: CompanyKind.BUSINESS,
      },
      update: {
        name: DEMO_COMPANY_NAME,
        legalName: "Techionik Demo Traders (Private) Limited",
        ntn: "1234567-8",
        kind: CompanyKind.BUSINESS,
      },
    });

    await tx.userCompanyMembership.updateMany({
      where: { userId: user.id, isDefault: true },
      data: { isDefault: false },
    });
    await tx.userCompanyMembership.upsert({
      where: {
        userId_companyId: {
          userId: user.id,
          companyId: company.id,
        },
      },
      create: {
        userId: user.id,
        companyId: company.id,
        role: MembershipRole.OWNER,
        isDefault: true,
      },
      update: {
        role: MembershipRole.OWNER,
        isDefault: true,
      },
    });

    await tx.companyProfile.upsert({
      where: { companyId: company.id },
      create: {
        companyId: company.id,
        companyName: "Techionik Demo Traders",
        ntnOrCnic: "1234567-8",
        businessType: "Retail, distribution, and IT services",
        province: "SINDH",
        address: "Office 12, Shahrah-e-Faisal, Karachi",
        phoneNumber: "+92-21-111-222-333",
        emailAddress: "accounts@techionik-demo.test",
      },
      update: {
        companyName: "Techionik Demo Traders",
        ntnOrCnic: "1234567-8",
        businessType: "Retail, distribution, and IT services",
        province: "SINDH",
        address: "Office 12, Shahrah-e-Faisal, Karachi",
        phoneNumber: "+92-21-111-222-333",
        emailAddress: "accounts@techionik-demo.test",
      },
    });

    await tx.fbrOnboarding.upsert({
      where: { companyId: company.id },
      create: {
        companyId: company.id,
        status: FbrOnboardingStatus.SANDBOX_TESTING,
        businessNature: "Retail and taxable services",
        primarySector: "Wholesale/Retail",
        technicalContactName: "Demo FBR Coordinator",
        technicalContactMobile: "+92-300-5555555",
        technicalContactEmail: "fbr.coordinator@techionik-demo.test",
        ipWhitelistStatus: FbrApprovalStatus.PENDING,
        sandboxTokenStatus: FbrTokenStatus.MISSING,
        sandboxStatus: FbrSandboxStatus.IN_PROGRESS,
        productionTokenStatus: FbrTokenStatus.MISSING,
        irisSubmittedAt: daysAgo(now, 10),
        sandboxStartedAt: daysAgo(now, 3),
        notes: "Demo tenant seeded for local testing. Add real FBR credentials before live sandbox validation.",
      },
      update: {
        status: FbrOnboardingStatus.SANDBOX_TESTING,
        businessNature: "Retail and taxable services",
        primarySector: "Wholesale/Retail",
        technicalContactName: "Demo FBR Coordinator",
        technicalContactMobile: "+92-300-5555555",
        technicalContactEmail: "fbr.coordinator@techionik-demo.test",
        ipWhitelistStatus: FbrApprovalStatus.PENDING,
        sandboxTokenStatus: FbrTokenStatus.MISSING,
        sandboxStatus: FbrSandboxStatus.IN_PROGRESS,
        productionTokenStatus: FbrTokenStatus.MISSING,
        irisSubmittedAt: daysAgo(now, 10),
        sandboxStartedAt: daysAgo(now, 3),
        notes: "Demo tenant seeded for local testing. Add real FBR credentials before live sandbox validation.",
      },
    });

    await tx.staffMember.deleteMany({ where: { id: { in: staffIds } } });
    await tx.staffMember.createMany({
      data: [
        {
          id: "mock-staff-accounts",
          companyId: company.id,
          memberName: "Ayesha Khan",
          designation: "Accounts Manager",
          cnicNtn: "42101-1234567-1",
          phoneNumber: "+92-300-1112233",
          email: "ayesha.accounts@techionik-demo.test",
          province: "SINDH",
          address: "PECHS, Karachi",
        },
        {
          id: "mock-staff-sales",
          companyId: company.id,
          memberName: "Bilal Ahmed",
          designation: "Sales Executive",
          cnicNtn: "35202-7654321-3",
          phoneNumber: "+92-321-4445566",
          email: "bilal.sales@techionik-demo.test",
          province: "PUNJAB",
          address: "Gulberg, Lahore",
        },
        {
          id: "mock-staff-fbr-admin",
          companyId: company.id,
          memberName: "Sara Malik",
          designation: "FBR Compliance Officer",
          cnicNtn: "61101-2223334-5",
          phoneNumber: "+92-333-7778899",
          email: "sara.fbr@techionik-demo.test",
          province: "ISLAMABAD",
          address: "Blue Area, Islamabad",
        },
      ],
    });

    await tx.customer.deleteMany({ where: { id: { in: customerIds } } });
    await tx.customer.createMany({
      data: [
        {
          id: "mock-customer-blue-mart",
          companyId: company.id,
          name: "Blue Mart Superstore",
          cnic: "3277876112345",
          phone: "+92-300-1002003",
          email: "purchase@bluemart.test",
          province: "SINDH",
          address: "Block 7, Clifton, Karachi",
          registrationType: "Registered",
        },
        {
          id: "mock-customer-karachi-retail",
          companyId: company.id,
          name: "Karachi Retail Supplies",
          cnic: "4172219988776",
          phone: "+92-301-5557788",
          email: "billing@krs.test",
          province: "SINDH",
          address: "SITE Area, Karachi",
          registrationType: "Unregistered",
        },
        {
          id: "mock-customer-lahore-distributors",
          companyId: company.id,
          name: "Lahore Prime Distributors",
          cnic: "3520111223344",
          phone: "+92-321-1122334",
          email: "accounts@lpd.test",
          province: "PUNJAB",
          address: "Ferozepur Road, Lahore",
          registrationType: "Registered",
        },
        {
          id: "mock-customer-islamabad-services",
          companyId: company.id,
          name: "Islamabad Services Hub",
          cnic: "6110199988877",
          phone: "+92-333-9988776",
          email: "finance@ish.test",
          province: "ISLAMABAD",
          address: "I-8 Markaz, Islamabad",
          registrationType: "Registered",
        },
      ],
    });

    await tx.product.deleteMany({ where: { id: { in: productIds } } });
    await tx.product.createMany({
      data: [
        {
          id: "mock-product-laptop",
          companyId: company.id,
          name: "Business Laptop 14 Inch",
          hsCode: "8471.3010",
          hsDescription: "Portable automatic data processing machines",
          defaultSaleType: "Goods at standard rate (default)",
          defaultRate: "18",
          defaultUom: "Nos",
          inStock: "42",
        },
        {
          id: "mock-product-printer-paper",
          companyId: company.id,
          name: "A4 Printer Paper Ream",
          hsCode: "4802.5600",
          hsDescription: "Paper and paperboard for office use",
          defaultSaleType: "Goods at standard rate (default)",
          defaultRate: "18",
          defaultUom: "Kg",
          inStock: "850",
        },
        {
          id: "mock-product-packaged-tea",
          companyId: company.id,
          name: "Packaged Tea 950g",
          hsCode: "0902.3000",
          hsDescription: "Black tea, fermented, and partly fermented tea",
          defaultSaleType: "Third Schedule Goods",
          defaultRate: "18",
          defaultUom: "Kg",
          inStock: "125",
          sroScheduleNo: "EIGHTH",
          furtherTaxApplicable: true,
        },
        {
          id: "mock-product-consulting",
          companyId: company.id,
          name: "ERP Configuration Service",
          hsCode: "9983.1300",
          hsDescription: "Information technology consulting services",
          defaultSaleType: "Services",
          defaultRate: "15",
          defaultUom: "Hour",
          inStock: "",
        },
        {
          id: "mock-product-telecom",
          companyId: company.id,
          name: "Telecom Support Package",
          hsCode: "9984.1500",
          hsDescription: "Telecommunication support services",
          defaultSaleType: "FED in ST Mode (Services)",
          defaultRate: "19.5",
          defaultUom: "Service",
          inStock: "",
          fedApplicable: true,
        },
      ],
    });

    await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    await createInvoice(tx, {
      id: "mock-invoice-submitted-001",
      companyId: company.id,
      invoiceDate: daysAgo(now, 0),
      invoiceRefNo: "DEMO-SI-1001",
      fbrInvoiceNumber: "000001010626120000-0001",
      buyer: {
        cnic: "3277876112345",
        name: "Blue Mart Superstore",
        province: "SINDH",
        address: "Block 7, Clifton, Karachi",
        registrationType: "Registered",
      },
      status: "SUBMITTED",
      submittedAt: daysAgo(now, 0),
      raw: {
        dashboardSource: "fbr",
        dashboardClaimed: true,
        statusCode: "00",
        message: "Mock submitted invoice accepted.",
      },
      items: [
        invoiceItem("8471.3010", "Business Laptop 14 Inch", "18", "Nos", 2, 280000, "Goods at standard rate (default)"),
        invoiceItem("4802.5600", "A4 Printer Paper Ream", "18", "Kg", 10, 8500, "Goods at standard rate (default)"),
      ],
    });
    await createInvoice(tx, {
      id: "mock-invoice-submitted-002",
      companyId: company.id,
      invoiceDate: daysAgo(now, 1),
      invoiceRefNo: "DEMO-SI-1002",
      fbrInvoiceNumber: "000001010626120000-0002",
      buyer: {
        cnic: "3520111223344",
        name: "Lahore Prime Distributors",
        province: "PUNJAB",
        address: "Ferozepur Road, Lahore",
        registrationType: "Registered",
      },
      status: "SUBMITTED",
      submittedAt: daysAgo(now, 1),
      raw: {
        dashboardSource: "fbr",
        dashboardClaimed: false,
        statusCode: "00",
        message: "Mock submitted invoice accepted.",
      },
      items: [
        invoiceItem("0902.3000", "Packaged Tea 950g", "18", "Kg", 30, 165000, "Third Schedule Goods", {
          furtherTax: 6600,
          sroScheduleNo: "EIGHTH",
        }),
      ],
    });
    await createInvoice(tx, {
      id: "mock-invoice-failed-001",
      companyId: company.id,
      invoiceDate: daysAgo(now, 2),
      invoiceRefNo: "DEMO-SI-1003",
      buyer: {
        cnic: "4172219988776",
        name: "Karachi Retail Supplies",
        province: "SINDH",
        address: "SITE Area, Karachi",
        registrationType: "Unregistered",
      },
      status: "FAILED",
      raw: {
        dashboardSource: "fbr",
        dashboardClaimed: false,
        statusCode: "ERR-HS-UOM",
        mappedErrorCode: "ERR-HS-UOM",
        mappedErrors: [
          {
            field: "items[0].uoM",
            fbrMessage: "Invalid UOM for selected HS code.",
            fixHint: "Use the HS-code autofill helper and retry.",
          },
        ],
      },
      items: [
        invoiceItem("9983.1300", "ERP Configuration Service", "15", "Hour", 8, 96000, "Services"),
      ],
    });
    await createInvoice(tx, {
      id: "mock-invoice-draft-001",
      companyId: company.id,
      invoiceDate: daysAgo(now, 3),
      invoiceRefNo: "DEMO-DRAFT-1004",
      buyer: {
        cnic: "6110199988877",
        name: "Islamabad Services Hub",
        province: "ISLAMABAD",
        address: "I-8 Markaz, Islamabad",
        registrationType: "Registered",
      },
      status: "DRAFT",
      raw: {
        dashboardSource: "manual",
        dashboardClaimed: false,
        message: "Mock draft invoice for review/edit testing.",
      },
      items: [
        invoiceItem("9984.1500", "Telecom Support Package", "19.5", "Service", 1, 65000, "FED in ST Mode (Services)", {
          fedPayable: 12675,
        }),
      ],
    });
    await createInvoice(tx, {
      id: "mock-invoice-offline-001",
      companyId: company.id,
      invoiceDate: daysAgo(now, 4),
      invoiceRefNo: "DEMO-OFFLINE-1005",
      buyer: {
        cnic: "3277876112345",
        name: "Blue Mart Superstore",
        province: "SINDH",
        address: "Block 7, Clifton, Karachi",
        registrationType: "Registered",
      },
      status: "QUEUED",
      isOffline: true,
      offlineQueuedAt: daysAgo(now, 4),
      raw: {
        dashboardSource: "offline",
        dashboardClaimed: false,
        message: "Mock offline invoice waiting for sync.",
      },
      items: [
        invoiceItem("4802.5600", "A4 Printer Paper Ream", "18", "Kg", 50, 42500, "Goods at standard rate (default)"),
      ],
      queue: {
        invoicePayload: {
          invoiceRefNo: "DEMO-OFFLINE-1005",
          buyerBusinessName: "Blue Mart Superstore",
          items: 1,
        },
        status: "PENDING",
        queuedAt: daysAgo(now, 4),
        retryCount: 1,
        lastError: "Mock queue item. Network unavailable during last attempt.",
      },
    });

    await tx.sandboxResult.deleteMany({
      where: {
        companyId: company.id,
        scenarioId: { in: ["SN001", "SN002", "SN019"] },
      },
    });
    await tx.sandboxResult.createMany({
      data: [
        {
          companyId: company.id,
          scenarioId: "SN001",
          scenarioName: "Standard goods sale",
          operation: FbrSandboxOperation.VALIDATE,
          status: FbrSandboxResultStatus.PASSED,
          statusCode: "00",
          invoiceNumber: "MOCK-SN001-0001",
          payload: json({ invoiceRefNo: "DEMO-SI-1001", buyerBusinessName: "Blue Mart Superstore" }),
          response: json({ statusCode: "00", message: "Validated in mock mode." }),
          durationMs: 238,
          runAt: daysAgo(now, 1),
          passedAt: daysAgo(now, 1),
        },
        {
          companyId: company.id,
          scenarioId: "SN002",
          scenarioName: "Unregistered buyer",
          operation: FbrSandboxOperation.VALIDATE,
          status: FbrSandboxResultStatus.FAILED,
          statusCode: "ERR-BUYER",
          payload: json({ invoiceRefNo: "DEMO-SI-1003", buyerBusinessName: "Karachi Retail Supplies" }),
          response: json({ statusCode: "ERR-BUYER", message: "Buyer registration data requires review." }),
          errors: json([
            {
              code: "ERR-BUYER",
              field: "buyerRegistrationType",
              fixHint: "Confirm buyer registration type before retrying.",
            },
          ]),
          durationMs: 311,
          runAt: daysAgo(now, 0),
        },
        {
          companyId: company.id,
          scenarioId: "SN019",
          scenarioName: "Services",
          operation: FbrSandboxOperation.SUBMIT,
          status: FbrSandboxResultStatus.PASSED,
          statusCode: "00",
          invoiceNumber: "MOCK-SN019-0001",
          payload: json({ invoiceRefNo: "DEMO-DRAFT-1004", saleType: "Services" }),
          response: json({ statusCode: "00", message: "Service scenario accepted in mock mode." }),
          durationMs: 421,
          runAt: daysAgo(now, 2),
          passedAt: daysAgo(now, 2),
        },
      ],
    });

    await tx.companyActivityLog.createMany({
      data: [
        {
          companyId: company.id,
          actorUserId: user.id,
          action: "mock.seeded",
          summary: "Demo customer, product, service, invoice, and sandbox data was refreshed.",
          metadata: json({ source: "scripts/seed-mock-data.ts" }),
        },
        {
          companyId: company.id,
          actorUserId: user.id,
          action: "onboarding.status.changed",
          summary: "Onboarding moved to sandbox testing for demo validation.",
          metadata: json({ status: "SANDBOX_TESTING" }),
        },
      ],
    });

    return { user, company };
  });

  await seedServices(result.company.id);

  console.log(JSON.stringify({
    ok: true,
    message: "Mock testing data seeded.",
    login: {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    },
    company: {
      id: result.company.id,
      name: result.company.name,
    },
    seeded: {
      customers: customerIds.length,
      products: productIds.length,
      services: 4,
      staff: staffIds.length,
      invoices: invoiceIds.length,
      sandboxResults: 3,
    },
  }, null, 2));
}

async function seedServices(companyId: string) {
  const now = new Date().toISOString();
  await getCache().set(`app:services:${companyId}`, JSON.stringify([
    {
      id: "mock-service-erp-setup",
      service_name: "ERP Setup and Configuration",
      rate: "15000",
      unit_of_measure: "Project",
      sales_tax: "15",
      description: "One-time configuration and training package.",
      created_at: now,
      updated_at: now,
    },
    {
      id: "mock-service-monthly-support",
      service_name: "Monthly FBR Support",
      rate: "25000",
      unit_of_measure: "Month",
      sales_tax: "15",
      description: "Monthly support for FBR invoice monitoring and fixes.",
      created_at: now,
      updated_at: now,
    },
    {
      id: "mock-service-api-integration",
      service_name: "API Integration Hours",
      rate: "6000",
      unit_of_measure: "Hour",
      sales_tax: "15",
      description: "Development hours for POS/ERP integration.",
      created_at: now,
      updated_at: now,
    },
    {
      id: "mock-service-telecom-support",
      service_name: "Telecom Support Package",
      rate: "65000",
      unit_of_measure: "Service",
      sales_tax: "19.5",
      description: "FED in ST mode service scenario testing.",
      created_at: now,
      updated_at: now,
    },
  ]));

  await new Promise((resolve) => setTimeout(resolve, 150));
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function createInvoice(
  tx: Tx,
  input: {
    id: string;
    companyId: string;
    invoiceDate: Date;
    invoiceRefNo: string;
    fbrInvoiceNumber?: string;
    buyer: {
      cnic: string;
      name: string;
      province: string;
      address: string;
      registrationType: string;
    };
    status: string;
    submittedAt?: Date;
    isOffline?: boolean;
    offlineQueuedAt?: Date;
    raw: Prisma.InputJsonValue;
    items: Prisma.InvoiceItemCreateWithoutInvoiceInput[];
    queue?: Prisma.OfflineQueueCreateWithoutInvoiceInput;
  },
) {
  await tx.invoice.create({
    data: {
      id: input.id,
      companyId: input.companyId,
      fbrInvoiceNumber: input.fbrInvoiceNumber,
      invoiceType: "Sale Invoice",
      invoiceDate: input.invoiceDate,
      invoiceRefNo: input.invoiceRefNo,
      sellerNTNCNIC: "1234567-8",
      sellerBusinessName: "Techionik Demo Traders",
      sellerProvince: "SINDH",
      sellerAddress: "Office 12, Shahrah-e-Faisal, Karachi",
      buyerNTNCNIC: input.buyer.cnic,
      buyerBusinessName: input.buyer.name,
      buyerProvince: input.buyer.province,
      buyerAddress: input.buyer.address,
      buyerRegistrationType: input.buyer.registrationType,
      status: input.status,
      isOffline: Boolean(input.isOffline),
      offlineQueuedAt: input.offlineQueuedAt,
      submittedAt: input.submittedAt,
      fbrRawResponse: input.raw,
      items: {
        create: input.items,
      },
      ...(input.queue
        ? {
            offlineQueue: {
              create: input.queue,
            },
          }
        : {}),
    },
  });
}

function invoiceItem(
  hsCode: string,
  productDescription: string,
  rate: string,
  uom: string,
  quantity: number,
  valueSalesExcludingST: number,
  saleType: string,
  options: {
    extraTax?: number;
    furtherTax?: number;
    sroScheduleNo?: string;
    fedPayable?: number;
    discount?: number;
  } = {},
): Prisma.InvoiceItemCreateWithoutInvoiceInput {
  const rateNumber = Number(rate) || 0;
  const salesTaxApplicable = round(valueSalesExcludingST * (rateNumber / 100));
  const totalValues = round(
    valueSalesExcludingST +
    salesTaxApplicable +
    (options.extraTax ?? 0) +
    (options.furtherTax ?? 0) +
    (options.fedPayable ?? 0) -
    (options.discount ?? 0),
  );

  return {
    hsCode,
    productDescription,
    rate,
    uom,
    quantity,
    totalValues,
    valueSalesExcludingST,
    fixedNotifiedValueOrRetailPrice: valueSalesExcludingST,
    salesTaxApplicable,
    salesTaxWithheldAtSource: 0,
    extraTax: options.extraTax,
    furtherTax: options.furtherTax,
    sroScheduleNo: options.sroScheduleNo,
    fedPayable: options.fedPayable,
    discount: options.discount,
    saleType,
  };
}

function daysAgo(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - days);
  return copy;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
