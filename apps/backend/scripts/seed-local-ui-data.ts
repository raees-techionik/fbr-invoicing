import "dotenv/config";
import bcrypt from "bcryptjs";
import { CompanyKind, MembershipRole, type Prisma } from "../generated/prisma/client.js";
import { getCache } from "../src/lib/cache.js";
import { prisma } from "../src/lib/prisma.js";

const ADMIN_USER_ID = "admin-user";
const ADMIN_COMPANY_ID = "admin-company";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@fbr.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const ADMIN_FULL_NAME = process.env.ADMIN_FULL_NAME || "Admin";
const ADMIN_WORKSPACE_NAME = process.env.ADMIN_WORKSPACE_NAME || "Admin Workspace";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

interface CustomerSeed {
  id: string;
  name: string;
  cnic: string;
  phone: string;
  email: string;
  province: string;
  address: string;
  registrationType: string;
}

interface ProductSeed {
  id: string;
  name: string;
  hsCode: string;
  hsDescription: string;
  defaultSaleType: string;
  defaultRate: string;
  defaultUom: string;
  inStock: string;
  unitPrice: number;
  sroScheduleNo?: string;
  furtherTaxApplicable?: boolean;
  extraTaxApplicable?: boolean;
  fedApplicable?: boolean;
}

interface StaffSeed {
  id: string;
  memberName: string;
  designation: string;
  cnicNtn: string;
  phoneNumber: string;
  email: string;
  province: string;
  address: string;
}

interface ServiceSeed {
  id: string;
  service_name: string;
  rate: string;
  unit_of_measure: string;
  sales_tax: string;
  description: string;
  created_at: string;
  updated_at: string;
}

async function main() {
  const now = new Date();
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const services = buildServices(now);

  const result = await prisma.$transaction(async (tx) => {
    const { user, company } = await ensureAdminWorkspace(tx, passwordHash);
    await resetWorkspaceData(tx, company.id);

    const customers = buildCustomers();
    const products = buildProducts();
    const staff = buildStaff();

    await tx.customer.createMany({
      data: customers.map((customer) => ({
        ...customer,
        companyId: company.id,
      })),
    });

    await tx.product.createMany({
      data: products.map(({ unitPrice: _unitPrice, ...product }) => ({
        ...product,
        companyId: company.id,
        isActive: true,
      })),
    });

    await tx.staffMember.createMany({
      data: staff.map((member) => ({
        ...member,
        companyId: company.id,
      })),
    });

    await seedInvoices(tx, company.id, customers, products, now);

    await tx.companyActivityLog.create({
      data: {
        companyId: company.id,
        actorUserId: user.id,
        action: "local-ui.seeded",
        summary: "Local UI mock customers, products, services, staff, and invoices were refreshed.",
        metadata: json({
          source: "scripts/seed-local-ui-data.ts",
          customers: customers.length,
          products: products.length,
          services: services.length,
          staff: staff.length,
          invoices: 20,
        }),
      },
    });

    return {
      user,
      company,
      counts: {
        customers: customers.length,
        products: products.length,
        services: services.length,
        staff: staff.length,
        invoices: 20,
      },
    };
  });

  await seedServices(result.company.id, services);
  const serviceApiSync = await syncRunningBackendServices(result.company.id, services);

  console.log(JSON.stringify({
    ok: true,
    message: "Local UI mock data seeded.",
    login: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    },
    company: {
      id: result.company.id,
      name: result.company.name,
    },
    seeded: result.counts,
    serviceApiSync,
  }, null, 2));
}

async function ensureAdminWorkspace(tx: Tx, passwordHash: string) {
  const user = await tx.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: {
      id: ADMIN_USER_ID,
      email: ADMIN_EMAIL,
      passwordHash,
      fullName: ADMIN_FULL_NAME,
      isSuperAdmin: true,
    },
    update: {
      passwordHash,
      fullName: ADMIN_FULL_NAME,
      isSuperAdmin: true,
    },
  });

  const company = await tx.company.upsert({
    where: { id: ADMIN_COMPANY_ID },
    create: {
      id: ADMIN_COMPANY_ID,
      name: ADMIN_WORKSPACE_NAME,
      kind: CompanyKind.PERSONAL,
      legalName: "Techionik Digital Invoicing",
      ntn: "1234567-8",
    },
    update: {
      name: ADMIN_WORKSPACE_NAME,
      legalName: "Techionik Digital Invoicing",
      ntn: "1234567-8",
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
      companyName: "Techionik Digital Invoicing",
      ntnOrCnic: "1234567-8",
      businessType: "Retail, distribution, and taxable services",
      province: "SINDH",
      address: "Office 12, Shahrah-e-Faisal, Karachi",
      phoneNumber: "+92-21-111-222-333",
      emailAddress: "accounts@techionik-demo.test",
    },
    update: {
      companyName: "Techionik Digital Invoicing",
      ntnOrCnic: "1234567-8",
      businessType: "Retail, distribution, and taxable services",
      province: "SINDH",
      address: "Office 12, Shahrah-e-Faisal, Karachi",
      phoneNumber: "+92-21-111-222-333",
      emailAddress: "accounts@techionik-demo.test",
    },
  });

  return { user, company };
}

async function resetWorkspaceData(tx: Tx, companyId: string) {
  await tx.offlineQueue.deleteMany({ where: { invoice: { companyId } } });
  await tx.invoiceItem.deleteMany({ where: { invoice: { companyId } } });
  await tx.invoice.deleteMany({ where: { companyId } });
  await tx.customer.deleteMany({ where: { companyId } });
  await tx.product.deleteMany({ where: { companyId } });
  await tx.staffMember.deleteMany({ where: { companyId } });
}

async function seedInvoices(
  tx: Tx,
  companyId: string,
  customers: CustomerSeed[],
  products: ProductSeed[],
  now: Date,
) {
  const statuses = [
    "SUBMITTED",
    "SUBMITTED",
    "SUBMITTED",
    "DRAFT",
    "FAILED",
    "QUEUED",
    "SUBMITTED",
    "SUBMITTED",
    "DRAFT",
    "SUBMITTED",
    "FAILED",
    "SUBMITTED",
    "QUEUED",
    "SUBMITTED",
    "DRAFT",
    "SUBMITTED",
    "SUBMITTED",
    "FAILED",
    "DRAFT",
    "QUEUED",
  ];

  for (const [index, status] of statuses.entries()) {
    const buyer = customers[index % customers.length];
    const invoiceDate = daysAgo(now, index);
    const invoiceType = index % 7 === 6 || index % 7 === 3 ? "Debit Note" : "Sale Invoice";
    const itemA = invoiceItem(products[index % products.length], (index % 4) + 1);
    const itemB = invoiceItem(products[(index + 7) % products.length], ((index + 2) % 5) + 1, index % 5 === 0 ? 500 : 0);
    const refPrefix = invoiceType === "Debit Note" ? "UI-DN" : "UI-SI";
    const invoiceRefNo = `${refPrefix}-${String(1001 + index)}`;
    const isQueued = status === "QUEUED";
    const isSubmitted = status === "SUBMITTED";
    const isFailed = status === "FAILED";
    const queueStatus = index === 19 ? "FAILED" : "PENDING";

    await createInvoice(tx, {
      id: `local-ui-invoice-${String(index + 1).padStart(3, "0")}`,
      companyId,
      invoiceType,
      invoiceDate,
      invoiceRefNo,
      fbrInvoiceNumber: isSubmitted ? `000001230626120000-${String(index + 1).padStart(4, "0")}` : undefined,
      buyer: {
        cnic: buyer.cnic,
        name: buyer.name,
        province: buyer.province,
        address: buyer.address,
        registrationType: buyer.registrationType,
      },
      status,
      submittedAt: isSubmitted ? invoiceDate : undefined,
      isOffline: isQueued,
      offlineQueuedAt: isQueued ? invoiceDate : undefined,
      raw: json({
        dashboardSource: isQueued ? "offline" : isSubmitted || isFailed ? "fbr" : "manual",
        dashboardClaimed: isSubmitted && index % 3 === 0,
        statusCode: isSubmitted ? "00" : isFailed ? "ERR-MOCK-VALIDATION" : isQueued ? "QUEUED" : "DRAFT",
        message: invoiceMessage(status, invoiceRefNo),
        mappedErrors: isFailed
          ? [
              {
                field: "items[0].hsCode",
                fbrMessage: "Mock validation failed for the selected HS code and UOM pairing.",
                fixHint: "Open the invoice, refresh item mapping, and submit again.",
              },
            ]
          : [],
      }),
      items: [itemA, itemB],
      queue: isQueued
        ? {
            invoicePayload: json({
              invoiceRefNo,
              buyerBusinessName: buyer.name,
              itemCount: 2,
            }),
            status: queueStatus,
            queuedAt: invoiceDate,
            retryCount: queueStatus === "FAILED" ? 3 : index % 2,
            lastError: queueStatus === "FAILED" ? "Mock upload failed after retrying." : null,
          }
        : undefined,
    });
  }
}

async function createInvoice(
  tx: Tx,
  input: {
    id: string;
    companyId: string;
    invoiceType: string;
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
      invoiceType: input.invoiceType,
      invoiceDate: input.invoiceDate,
      invoiceRefNo: input.invoiceRefNo,
      sellerNTNCNIC: "1234567-8",
      sellerBusinessName: "Techionik Digital Invoicing",
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
  product: ProductSeed,
  quantity: number,
  discount = 0,
): Prisma.InvoiceItemCreateWithoutInvoiceInput {
  const valueSalesExcludingST = round(product.unitPrice * quantity);
  const rateNumber = Number(product.defaultRate) || 0;
  const salesTaxApplicable = round(valueSalesExcludingST * (rateNumber / 100));
  const extraTax = product.extraTaxApplicable ? round(valueSalesExcludingST * 0.02) : undefined;
  const furtherTax = product.furtherTaxApplicable ? round(valueSalesExcludingST * 0.04) : undefined;
  const fedPayable = product.fedApplicable ? round(valueSalesExcludingST * 0.05) : undefined;
  const totalValues = round(
    valueSalesExcludingST +
      salesTaxApplicable +
      (extraTax ?? 0) +
      (furtherTax ?? 0) +
      (fedPayable ?? 0) -
      discount,
  );

  return {
    hsCode: product.hsCode,
    productDescription: product.name,
    rate: product.defaultRate,
    uom: product.defaultUom,
    quantity,
    totalValues,
    valueSalesExcludingST,
    fixedNotifiedValueOrRetailPrice: valueSalesExcludingST,
    salesTaxApplicable,
    salesTaxWithheldAtSource: 0,
    extraTax,
    furtherTax,
    sroScheduleNo: product.sroScheduleNo,
    fedPayable,
    discount: discount || undefined,
    saleType: product.defaultSaleType,
  };
}

function buildCustomers(): CustomerSeed[] {
  return [
    ["001", "Blue Mart Superstore", "3277876112345", "+92-300-1002003", "purchase@bluemart.test", "SINDH", "Block 7, Clifton, Karachi", "Registered"],
    ["002", "Karachi Retail Supplies", "4172219988776", "+92-301-5557788", "billing@krs.test", "SINDH", "SITE Area, Karachi", "Unregistered"],
    ["003", "Lahore Prime Distributors", "3520111223344", "+92-321-1122334", "accounts@lpd.test", "PUNJAB", "Ferozepur Road, Lahore", "Registered"],
    ["004", "Islamabad Services Hub", "6110199988877", "+92-333-9988776", "finance@ish.test", "ISLAMABAD", "I-8 Markaz, Islamabad", "Registered"],
    ["005", "Peshawar Health Depot", "1730188881122", "+92-315-4455667", "orders@phd.test", "KHYBER PAKHTUNKHWA", "University Road, Peshawar", "Registered"],
    ["006", "Quetta Textile House", "5440099911223", "+92-334-9911223", "tax@qth.test", "BALOCHISTAN", "Jinnah Road, Quetta", "Unregistered"],
    ["007", "Multan Office Solutions", "3620312345678", "+92-302-2233445", "billing@mos.test", "PUNJAB", "Cantt Market, Multan", "Registered"],
    ["008", "Faisalabad Fabric Traders", "3310098765432", "+92-303-8877665", "accounts@fft.test", "PUNJAB", "D Ground, Faisalabad", "Registered"],
    ["009", "Rawalpindi Corporate Buyer", "3740612123434", "+92-322-1010109", "ap@rcb.test", "PUNJAB", "Saddar, Rawalpindi", "Registered"],
    ["010", "Hyderabad Foods Network", "4130412349999", "+92-304-7788990", "finance@hfn.test", "SINDH", "Autobahn Road, Hyderabad", "Retail Consumer"],
    ["011", "Sialkot Sports Exporters", "3460311122233", "+92-305-1012233", "tax@sse.test", "PUNJAB", "Paris Road, Sialkot", "Registered"],
    ["012", "Gujranwala Tools Market", "3410199988811", "+92-306-3322110", "billing@gtm.test", "PUNJAB", "GT Road, Gujranwala", "Unregistered"],
    ["013", "Bahawalpur Stationery Co", "3120199912345", "+92-307-4411223", "orders@bsc.test", "PUNJAB", "Circular Road, Bahawalpur", "Registered"],
    ["014", "Sukkur Hardware Point", "4550199912345", "+92-308-1199228", "ap@shp.test", "SINDH", "Military Road, Sukkur", "Registered"],
    ["015", "Abbottabad Retail Chain", "1310199912345", "+92-309-5544332", "finance@arc.test", "KHYBER PAKHTUNKHWA", "Supply Bazaar, Abbottabad", "Retail Consumer"],
    ["016", "Mirpur Electronics Store", "8710199912345", "+92-310-2299001", "tax@mes.test", "AZAD JAMMU AND KASHMIR", "Sector F-1, Mirpur", "Registered"],
    ["017", "Mardan General Traders", "1610199912345", "+92-311-3434343", "billing@mgt.test", "KHYBER PAKHTUNKHWA", "Bank Road, Mardan", "Unregistered"],
    ["018", "Gwadar Logistics Yard", "5160199912345", "+92-312-7788112", "accounts@gly.test", "BALOCHISTAN", "Marine Drive, Gwadar", "Registered"],
    ["019", "Taxila Engineering Works", "3740199912345", "+92-313-6600660", "finance@tew.test", "PUNJAB", "Heavy Mechanical Complex Road, Taxila", "Registered"],
    ["020", "Clifton Cafe Group", "4210199912345", "+92-314-4400440", "ap@ccg.test", "SINDH", "Marine Promenade, Karachi", "Retail Consumer"],
  ].map(([suffix, name, cnic, phone, email, province, address, registrationType]) => ({
    id: `local-ui-customer-${suffix}`,
    name,
    cnic,
    phone,
    email,
    province,
    address,
    registrationType,
  }));
}

function buildProducts(): ProductSeed[] {
  return [
    product("001", "Business Laptop 14 Inch", "8471.3010", "Portable automatic data processing machines", "Goods at standard rate (default)", "18", "Nos", "42", 165000),
    product("002", "A4 Printer Paper Ream", "4802.5600", "Paper and paperboard for office use", "Goods at standard rate (default)", "18", "Ream", "850", 1250),
    product("003", "Packaged Tea 950g", "0902.3000", "Black tea, fermented, and partly fermented tea", "Third Schedule Goods", "18", "Kg", "125", 6200, { sroScheduleNo: "EIGHTH", furtherTaxApplicable: true }),
    product("004", "POS Thermal Printer", "8443.3210", "Printers and copying machines", "Goods at standard rate (default)", "18", "Nos", "28", 42000),
    product("005", "Barcode Scanner", "8471.6020", "Input units for automatic data processing machines", "Goods at standard rate (default)", "18", "Nos", "61", 18500),
    product("006", "Wireless Router AX", "8517.6200", "Machines for reception, conversion and transmission of data", "Goods at standard rate (default)", "18", "Nos", "73", 24500),
    product("007", "Office Chair Ergonomic", "9401.3000", "Swivel seats with variable height adjustment", "Goods at standard rate (default)", "18", "Nos", "34", 36000),
    product("008", "Desktop Monitor 24 Inch", "8528.5200", "Monitors capable of directly connecting to data processing machines", "Goods at standard rate (default)", "18", "Nos", "52", 52000),
    product("009", "LED Bulb Pack", "8539.5200", "Light-emitting diode lamps", "Goods at standard rate (default)", "18", "Pack", "260", 1450),
    product("010", "Branded Apparel Hoodie", "6110.2000", "Cotton sweatshirts and pullovers", "Goods at standard rate (default)", "18", "Nos", "190", 8500),
    product("011", "Stainless Cookware Set", "7323.9300", "Table, kitchen or household articles of stainless steel", "Goods at standard rate (default)", "18", "Set", "45", 12000),
    product("012", "Corrugated Carton Large", "4819.1000", "Cartons, boxes and cases of corrugated paper", "Goods at standard rate (default)", "18", "Nos", "1400", 320),
    product("013", "Bottled Water Carton", "2201.1000", "Mineral waters and aerated waters", "Goods at reduced rate", "10", "Carton", "530", 1100),
    product("014", "Herbal Shampoo Bottle", "3305.1000", "Preparations for use on hair", "Third Schedule Goods", "18", "Bottle", "620", 780, { furtherTaxApplicable: true }),
    product("015", "Steel Tools Kit", "8206.0000", "Tools of two or more headings put up in sets", "Goods at standard rate (default)", "18", "Kit", "80", 9500),
    product("016", "Power Adapter 65W", "8504.4000", "Static converters", "Goods at standard rate (default)", "18", "Nos", "210", 6200),
    product("017", "USB Flash Drive 64GB", "8523.5100", "Solid-state non-volatile storage devices", "Goods at standard rate (default)", "18", "Nos", "340", 1550),
    product("018", "Notebook Register", "4820.1000", "Registers, account books and notebooks", "Goods at standard rate (default)", "18", "Nos", "900", 450),
    product("019", "Packaged Biscuits Carton", "1905.3100", "Sweet biscuits", "Third Schedule Goods", "18", "Carton", "175", 2600, { sroScheduleNo: "EIGHTH", furtherTaxApplicable: true }),
    product("020", "Smart Phone Case", "3926.9000", "Other articles of plastics", "Goods at standard rate (default)", "18", "Nos", "480", 900, { extraTaxApplicable: true }),
  ];
}

function product(
  suffix: string,
  name: string,
  hsCode: string,
  hsDescription: string,
  defaultSaleType: string,
  defaultRate: string,
  defaultUom: string,
  inStock: string,
  unitPrice: number,
  options: Partial<Pick<ProductSeed, "sroScheduleNo" | "furtherTaxApplicable" | "extraTaxApplicable" | "fedApplicable">> = {},
): ProductSeed {
  return {
    id: `local-ui-product-${suffix}`,
    name,
    hsCode,
    hsDescription,
    defaultSaleType,
    defaultRate,
    defaultUom,
    inStock,
    unitPrice,
    ...options,
  };
}

function buildStaff(): StaffSeed[] {
  return [
    ["001", "Ayesha Khan", "Accounts Manager", "42101-1234567-1", "+92-300-1112233", "ayesha.accounts@techionik-demo.test", "SINDH", "PECHS, Karachi"],
    ["002", "Bilal Ahmed", "Sales Executive", "35202-7654321-3", "+92-321-4445566", "bilal.sales@techionik-demo.test", "PUNJAB", "Gulberg, Lahore"],
    ["003", "Sara Malik", "FBR Compliance Officer", "61101-2223334-5", "+92-333-7778899", "sara.fbr@techionik-demo.test", "ISLAMABAD", "Blue Area, Islamabad"],
    ["004", "Hassan Raza", "Operations Lead", "42101-8899001-2", "+92-300-2223344", "hassan.ops@techionik-demo.test", "SINDH", "DHA Phase 5, Karachi"],
    ["005", "Minaal Sheikh", "Customer Success Manager", "35202-9988776-5", "+92-321-5656565", "minaal.cs@techionik-demo.test", "PUNJAB", "Model Town, Lahore"],
    ["006", "Usman Tariq", "Inventory Controller", "37405-2233445-6", "+92-322-7788001", "usman.inventory@techionik-demo.test", "PUNJAB", "Saddar, Rawalpindi"],
    ["007", "Nida Farooq", "Tax Analyst", "61101-1112233-4", "+92-333-1200456", "nida.tax@techionik-demo.test", "ISLAMABAD", "F-7 Markaz, Islamabad"],
    ["008", "Kamran Javed", "Warehouse Supervisor", "33100-5566778-9", "+92-303-8811220", "kamran.warehouse@techionik-demo.test", "PUNJAB", "D Ground, Faisalabad"],
    ["009", "Zoya Rehman", "Billing Specialist", "41304-3344556-7", "+92-304-7766550", "zoya.billing@techionik-demo.test", "SINDH", "Qasimabad, Hyderabad"],
    ["010", "Danish Iqbal", "Support Engineer", "17301-4455667-8", "+92-315-1237788", "danish.support@techionik-demo.test", "KHYBER PAKHTUNKHWA", "University Road, Peshawar"],
    ["011", "Fatima Noor", "Procurement Officer", "54400-1112223-4", "+92-334-3412121", "fatima.procurement@techionik-demo.test", "BALOCHISTAN", "Jinnah Road, Quetta"],
    ["012", "Saad Qureshi", "Regional Sales Lead", "36203-9988112-2", "+92-302-6611223", "saad.sales@techionik-demo.test", "PUNJAB", "Cantt Market, Multan"],
    ["013", "Maham Ali", "Data Entry Operator", "34603-1144778-3", "+92-305-1199002", "maham.data@techionik-demo.test", "PUNJAB", "Paris Road, Sialkot"],
    ["014", "Imran Siddiqui", "Finance Controller", "34101-7788990-1", "+92-306-2255771", "imran.finance@techionik-demo.test", "PUNJAB", "GT Road, Gujranwala"],
    ["015", "Rabia Saleem", "Compliance Coordinator", "31201-5522441-8", "+92-307-4488110", "rabia.compliance@techionik-demo.test", "PUNJAB", "Circular Road, Bahawalpur"],
    ["016", "Omer Hayat", "Field Officer", "45501-9911223-0", "+92-308-2233447", "omer.field@techionik-demo.test", "SINDH", "Military Road, Sukkur"],
    ["017", "Hira Jamil", "Training Lead", "13101-3344556-2", "+92-309-4400112", "hira.training@techionik-demo.test", "KHYBER PAKHTUNKHWA", "Supply Bazaar, Abbottabad"],
    ["018", "Waleed Akram", "Technical Consultant", "87101-6677889-3", "+92-310-1133557", "waleed.tech@techionik-demo.test", "AZAD JAMMU AND KASHMIR", "Sector F-1, Mirpur"],
    ["019", "Laiba Mir", "Audit Associate", "16101-2244668-1", "+92-311-8866221", "laiba.audit@techionik-demo.test", "KHYBER PAKHTUNKHWA", "Bank Road, Mardan"],
    ["020", "Taha Nadeem", "Logistics Coordinator", "51601-8800221-5", "+92-312-7700119", "taha.logistics@techionik-demo.test", "BALOCHISTAN", "Marine Drive, Gwadar"],
  ].map(([suffix, memberName, designation, cnicNtn, phoneNumber, email, province, address]) => ({
    id: `local-ui-staff-${suffix}`,
    memberName,
    designation,
    cnicNtn,
    phoneNumber,
    email,
    province,
    address,
  }));
}

function buildServices(now: Date): ServiceSeed[] {
  const timestamp = now.toISOString();
  return [
    ["001", "ERP Setup and Configuration", "15000", "Project", "15", "One-time setup, configuration, and basic handover."],
    ["002", "Monthly FBR Support", "25000", "Month", "15", "Monthly monitoring and correction support for FBR submissions."],
    ["003", "API Integration Hours", "6000", "Hour", "15", "Development hours for POS or ERP integration work."],
    ["004", "POS Training Session", "12000", "Session", "15", "Remote training for cashiers and branch operators."],
    ["005", "Data Cleanup Package", "35000", "Project", "15", "Customer, product, and invoice master data cleanup."],
    ["006", "On-site Deployment Visit", "45000", "Visit", "15", "On-site configuration and go-live assistance."],
    ["007", "Compliance Review", "18000", "Review", "15", "Review of invoices, mappings, and readiness checks."],
    ["008", "Digital Signature Setup", "22000", "Project", "15", "Certificate setup and signing workflow assistance."],
    ["009", "Invoice Template Customization", "16000", "Template", "15", "Custom invoice output layout and field configuration."],
    ["010", "Helpdesk Priority Support", "30000", "Month", "15", "Priority response for support and troubleshooting tickets."],
    ["011", "Network Configuration", "14000", "Site", "15", "Local network, firewall, and endpoint configuration."],
    ["012", "Inventory Migration", "40000", "Project", "15", "Migration of product catalog and opening stock data."],
    ["013", "Tax Scenario Mapping", "26000", "Project", "15", "Mapping products and services to FBR tax scenarios."],
    ["014", "UOM Mapping Audit", "11000", "Audit", "15", "Audit of HS code and unit-of-measure compatibility."],
    ["015", "Sandbox Submission Support", "28000", "Batch", "15", "Assisted sandbox validation and submission testing."],
    ["016", "Production Go-live Support", "55000", "Project", "15", "Go-live checklist, cutover, and first-day support."],
    ["017", "Staff Training Workshop", "20000", "Workshop", "15", "Training for finance, sales, and operations staff."],
    ["018", "Report Customization", "17500", "Report", "15", "Custom operational or compliance report configuration."],
    ["019", "Cloud Backup Setup", "13000", "Project", "15", "Backup policy setup and restore verification."],
    ["020", "Annual Support Retainer", "240000", "Year", "15", "Annual support retainer for platform operations."],
  ].map(([suffix, service_name, rate, unit_of_measure, sales_tax, description]) => ({
    id: `local-ui-service-${suffix}`,
    service_name,
    rate,
    unit_of_measure,
    sales_tax,
    description,
    created_at: timestamp,
    updated_at: timestamp,
  }));
}

async function seedServices(companyId: string, records: ServiceSeed[]) {
  await getCache().set(`app:services:${companyId}`, JSON.stringify(records));
  await new Promise((resolve) => setTimeout(resolve, 150));
}

async function syncRunningBackendServices(companyId: string, records: ServiceSeed[]) {
  const baseUrl = process.env.LOCAL_UI_SEED_API_URL || "http://localhost:3000";

  try {
    const health = await fetchWithTimeout(`${baseUrl}/health`, { method: "GET" });
    if (!health.ok) {
      return { synced: false, reason: `Local API health check returned ${health.status}.` };
    }

    const loginResponse = await fetchWithTimeout(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });

    if (!loginResponse.ok) {
      return { synced: false, reason: `Local API login returned ${loginResponse.status}.` };
    }

    const loginPayload = await loginResponse.json() as {
      accessToken?: string;
      data?: { accessToken?: string };
    };
    const accessToken = loginPayload.accessToken ?? loginPayload.data?.accessToken;
    if (!accessToken) {
      return { synced: false, reason: "Local API login did not return an access token." };
    }

    const headers = {
      authorization: `Bearer ${accessToken}`,
      "x-company-id": companyId,
      "content-type": "application/json",
    };

    const existingResponse = await fetchWithTimeout(`${baseUrl}/api/services?limit=250`, { headers });
    if (!existingResponse.ok) {
      return { synced: false, reason: `Local API services list returned ${existingResponse.status}.` };
    }

    const existingPayload = await existingResponse.json() as { data?: Array<{ id?: string }> };
    const existingRecords = Array.isArray(existingPayload.data) ? existingPayload.data : [];

    for (const record of existingRecords) {
      if (!record.id) continue;
      await fetchWithTimeout(`${baseUrl}/api/services/${encodeURIComponent(record.id)}`, {
        method: "DELETE",
        headers,
      });
    }

    for (const record of records) {
      await fetchWithTimeout(`${baseUrl}/api/services`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          service_name: record.service_name,
          rate: record.rate,
          unit_of_measure: record.unit_of_measure,
          sales_tax: record.sales_tax,
          description: record.description,
        }),
      });
    }

    return { synced: true, endpoint: baseUrl, services: records.length };
  } catch (error) {
    return { synced: false, reason: errorMessage(error) };
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const timeoutMs = 1500;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function invoiceMessage(status: string, invoiceRefNo: string) {
  if (status === "SUBMITTED") return `${invoiceRefNo} accepted by mock FBR response.`;
  if (status === "FAILED") return `${invoiceRefNo} failed mock validation.`;
  if (status === "QUEUED") return `${invoiceRefNo} queued for offline upload.`;
  return `${invoiceRefNo} saved as a local draft.`;
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
