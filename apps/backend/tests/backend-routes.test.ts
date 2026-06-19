import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { app } from "../src/app.js";
import { signAccessToken } from "../src/lib/jwt.js";
import { prisma } from "../src/lib/prisma.js";

process.env.OFFLINE_QUEUE_AUTO_PROCESS_DISABLED = "true";
process.env.DEV_DB_FALLBACK_DISABLED = "true";

let server: Server;
let baseUrl = "";
let authToken = "";
let registeredUserId = "";
let defaultCompanyId = "";

before(async () => {
  server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address === "object");
  baseUrl = `http://127.0.0.1:${address.port}`;

  const testEmail = `test-runner-${Date.now()}@test.internal`;
  const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: "TestRunner1!", fullName: "Test Runner" }),
  });
  const registerBody = await registerRes.json() as Record<string, any>;
  assert.equal(registerRes.status, 201);
  authToken = registerBody.accessToken;
  registeredUserId = registerBody.user.id;
  defaultCompanyId = registerBody.defaultCompany.id;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await prisma.$disconnect();
});

describe("backend guide-compatible route contracts", () => {
  test("authenticated requests resolve and authorize the active company", async () => {
    const marker = `auth-company-${Date.now()}`;
    const selectedCompany = await prisma.company.create({
      data: { name: `Selected ${marker}`, kind: "BUSINESS" },
    });
    const deniedCompany = await prisma.company.create({
      data: { name: `Denied ${marker}`, kind: "BUSINESS" },
    });

    try {
      await prisma.userCompanyMembership.create({
        data: {
          userId: registeredUserId,
          companyId: selectedCompany.id,
          role: "ADMIN",
          isDefault: false,
        },
      });

      const defaultContext = await getJson("/api/auth/me");
      assert.equal(defaultContext.activeCompany.id, defaultCompanyId);
      assert.equal(defaultContext.activeCompany.membershipRole, "OWNER");
      assert.equal(defaultContext.activeCompany.isDefault, true);

      const selectedContext = await getJson("/api/auth/me", {
        "X-Company-Id": selectedCompany.id,
      });
      assert.equal(selectedContext.activeCompany.id, selectedCompany.id);
      assert.equal(selectedContext.activeCompany.name, `Selected ${marker}`);
      assert.equal(selectedContext.activeCompany.membershipRole, "ADMIN");
      assert.equal(selectedContext.activeCompany.isDefault, false);

      const denied = await requestJson("/api/customers", {
        method: "GET",
        headers: { "X-Company-Id": deniedCompany.id },
      });
      assert.equal(denied.status, 403);
      assert.equal(denied.body.error, "You do not have access to the requested company");
    } finally {
      await prisma.company.deleteMany({
        where: { id: { in: [selectedCompany.id, deniedCompany.id] } },
      });
    }
  });

  test("a platform super admin can explicitly resolve an existing company", async () => {
    const marker = `super-admin-company-${Date.now()}`;
    const company = await prisma.company.create({
      data: { name: `Support Target ${marker}`, kind: "BUSINESS" },
    });
    const user = await prisma.user.create({
      data: {
        email: `${marker}@test.internal`,
        passwordHash: "not-used-in-this-test",
        fullName: "Platform Support",
        isSuperAdmin: true,
      },
    });

    try {
      const token = signAccessToken({
        sub: user.id,
        email: user.email,
        isSuperAdmin: true,
      });
      const response = await fetch(`${baseUrl}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Company-Id": company.id,
        },
      });
      const body = await response.json() as Record<string, any>;

      assert.equal(response.status, 200);
      assert.equal(body.activeCompany.id, company.id);
      assert.equal(body.activeCompany.membershipRole, null);
      assert.equal(body.isSuperAdmin, true);
    } finally {
      await prisma.user.deleteMany({ where: { id: user.id } });
      await prisma.company.deleteMany({ where: { id: company.id } });
    }
  });

  test("company management supports tenant creation, invitations, roles, defaults, and onboarding", async () => {
    const marker = `company-management-${Date.now()}`;
    const ownerRegistration = await registerTestUser(`owner-${marker}@test.internal`, "Business Owner");
    const inviteeRegistration = await registerTestUser(`staff-${marker}@test.internal`, "Business Staff");
    const superUser = await prisma.user.create({
      data: {
        email: `platform-${marker}@test.internal`,
        passwordHash: "not-used-in-this-test",
        fullName: "Platform Admin",
        isSuperAdmin: true,
        memberships: {
          create: {
            companyId: defaultCompanyId,
            role: "ADMIN",
            isDefault: true,
          },
        },
      },
    });
    const superToken = signAccessToken({
      sub: superUser.id,
      email: superUser.email,
      isSuperAdmin: true,
    });
    let businessCompanyId = "";

    try {
      const forbiddenCreate = await requestJson("/api/companies", {
        method: "POST",
        body: {
          name: `Forbidden ${marker}`,
          ownerEmail: ownerRegistration.user.email,
        },
      });
      assert.equal(forbiddenCreate.status, 403);

      const created = await requestJson("/api/companies", {
        method: "POST",
        headers: { Authorization: `Bearer ${superToken}` },
        body: {
          name: `Business ${marker}`,
          legalName: `Business ${marker} (Pvt) Ltd`,
          ntn: "1234567",
          ownerEmail: ownerRegistration.user.email,
          businessNature: "Retailer",
          primarySector: "FMCG",
        },
      });
      assert.equal(created.status, 201);
      businessCompanyId = created.body.data.company.id;
      assert.equal(created.body.data.owner.assigned, true);

      const ownerHeaders = {
        Authorization: `Bearer ${ownerRegistration.accessToken}`,
        "X-Company-Id": businessCompanyId,
      };
      const inviteeHeaders = { Authorization: `Bearer ${inviteeRegistration.accessToken}` };

      const current = await requestJson("/api/companies/current", {
        method: "GET",
        headers: ownerHeaders,
      });
      assert.equal(current.status, 200);
      assert.equal(current.body.data.kind, "BUSINESS");
      assert.equal(current.body.data.onboarding.status, "PROFILE_PENDING");

      const updatedCompany = await requestJson("/api/companies/current", {
        method: "PATCH",
        headers: ownerHeaders,
        body: { name: `Updated Business ${marker}` },
      });
      assert.equal(updatedCompany.status, 200);
      assert.equal(updatedCompany.body.data.name, `Updated Business ${marker}`);

      const invited = await requestJson("/api/companies/current/invitations", {
        method: "POST",
        headers: ownerHeaders,
        body: { email: inviteeRegistration.user.email, role: "MEMBER" },
      });
      assert.equal(invited.status, 201);
      assert.equal(invited.body.data.status, "PENDING");
      assert.equal(invited.body.data.emailDelivery.status, "DEV_LOGGED");
      const invitationToken = invited.body.data.devInvitationToken;
      assert.equal(typeof invitationToken, "string");

      const wrongUserAcceptance = await requestJson(`/api/companies/invitations/${invitationToken}/accept`, {
        method: "POST",
        body: { makeDefault: true },
      });
      assert.equal(wrongUserAcceptance.status, 403);

      const accepted = await requestJson(`/api/companies/invitations/${invitationToken}/accept`, {
        method: "POST",
        headers: inviteeHeaders,
        body: { makeDefault: true },
      });
      assert.equal(accepted.status, 200);
      assert.equal(accepted.body.data.membership.role, "MEMBER");
      assert.equal(accepted.body.data.membership.isDefault, true);

      const inviteeContext = await requestJson("/api/auth/me", {
        method: "GET",
        headers: inviteeHeaders,
      });
      assert.equal(inviteeContext.status, 200);
      assert.equal(inviteeContext.body.activeCompany.id, businessCompanyId);

      const members = await requestJson("/api/companies/current/members", {
        method: "GET",
        headers: ownerHeaders,
      });
      assert.equal(members.status, 200);
      assert.equal(members.body.data.length, 2);
      const ownerMembership = members.body.data.find((row: Record<string, any>) => row.user.id === ownerRegistration.user.id);
      const inviteeMembership = members.body.data.find((row: Record<string, any>) => row.user.id === inviteeRegistration.user.id);
      assert.equal(ownerMembership.role, "OWNER");
      assert.equal(inviteeMembership.role, "MEMBER");

      const promoted = await requestJson(`/api/companies/current/members/${inviteeMembership.id}`, {
        method: "PATCH",
        headers: ownerHeaders,
        body: { role: "ADMIN" },
      });
      assert.equal(promoted.status, 200);
      assert.equal(promoted.body.data.role, "ADMIN");

      const adminHeaders = {
        Authorization: `Bearer ${inviteeRegistration.accessToken}`,
        "X-Company-Id": businessCompanyId,
      };
      const adminCannotDemoteOwner = await requestJson(`/api/companies/current/members/${ownerMembership.id}`, {
        method: "PATCH",
        headers: adminHeaders,
        body: { role: "MEMBER" },
      });
      assert.equal(adminCannotDemoteOwner.status, 403);

      const lastOwnerProtected = await requestJson(`/api/companies/current/members/${ownerMembership.id}`, {
        method: "PATCH",
        headers: ownerHeaders,
        body: { role: "ADMIN" },
      });
      assert.equal(lastOwnerProtected.status, 409);
      assert.equal(lastOwnerProtected.body.error, "A company must retain at least one owner.");

      const irisSubmittedAt = new Date().toISOString();
      const onboarding = await requestJson("/api/companies/current/onboarding", {
        method: "PATCH",
        headers: ownerHeaders,
        body: {
          status: "SANDBOX_TESTING",
          businessNature: "Retailer",
          primarySector: "FMCG",
          technicalContactName: "Technical Lead",
          technicalContactMobile: "03001234567",
          technicalContactEmail: `technical-${marker}@test.internal`,
          irisSubmittedAt,
          ipWhitelistStatus: "APPROVED",
          sandboxTokenStatus: "CONFIGURED",
          sandboxStatus: "PASSED",
          productionTokenStatus: "REQUESTED",
          notes: "Ready for production token approval.",
        },
      });
      assert.equal(onboarding.status, 200);
      assert.equal(onboarding.body.data.status, "SANDBOX_TESTING");
      assert.equal(onboarding.body.data.ipWhitelistStatus, "APPROVED");
      assert.equal(onboarding.body.data.sandboxStatus, "PASSED");
      assert.equal(typeof onboarding.body.data.ipWhitelistApprovedAt, "string");
      assert.equal(typeof onboarding.body.data.sandboxCompletedAt, "string");
      assert.ok(onboarding.body.data.progress.completed >= 5);

      const onboardingRead = await requestJson("/api/companies/current/onboarding", {
        method: "GET",
        headers: ownerHeaders,
      });
      assert.equal(onboardingRead.body.data.nextStep, "Run and pass the required PRAL sandbox scenarios.");

      const ownerDefault = await requestJson(`/api/companies/${businessCompanyId}/default`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${ownerRegistration.accessToken}` },
      });
      assert.equal(ownerDefault.status, 200);
      const ownerContext = await requestJson("/api/auth/me", {
        method: "GET",
        headers: { Authorization: `Bearer ${ownerRegistration.accessToken}` },
      });
      assert.equal(ownerContext.body.activeCompany.id, businessCompanyId);

      const invitations = await requestJson("/api/companies/current/invitations", {
        method: "GET",
        headers: ownerHeaders,
      });
      assert.equal(invitations.status, 200);
      assert.ok(invitations.body.data.some((row: Record<string, any>) => row.status === "ACCEPTED"));
      assert.ok(invitations.body.data.some((row: Record<string, any>) => row.emailStatus === "DEV_LOGGED"));

      const activity = await requestJson("/api/companies/current/activity", {
        method: "GET",
        headers: ownerHeaders,
      });
      assert.equal(activity.status, 200);
      assert.ok(activity.body.data.some((row: Record<string, any>) => row.action === "invitation.email"));
      assert.ok(activity.body.data.some((row: Record<string, any>) => row.action === "member.role_updated"));
      assert.ok(activity.body.data.some((row: Record<string, any>) => row.action === "onboarding.updated"));

      const allCompanies = await requestJson("/api/companies?all=true", {
        method: "GET",
        headers: { Authorization: `Bearer ${superToken}` },
      });
      assert.equal(allCompanies.status, 200);
      assert.ok(allCompanies.body.data.some((row: Record<string, any>) => row.id === businessCompanyId));
    } finally {
      if (businessCompanyId) {
        await prisma.company.deleteMany({ where: { id: businessCompanyId } });
      }
      await prisma.user.deleteMany({
        where: { id: { in: [ownerRegistration.user.id, inviteeRegistration.user.id, superUser.id] } },
      });
      await prisma.company.deleteMany({
        where: { id: { in: [ownerRegistration.defaultCompany.id, inviteeRegistration.defaultCompany.id] } },
      });
    }
  });

  test("business and FBR APIs isolate reads and writes by active company", async () => {
    const marker = `tenant-isolation-${Date.now()}`;
    const company = await prisma.company.create({
      data: { name: `Tenant B ${marker}`, kind: "BUSINESS" },
    });
    await prisma.userCompanyMembership.create({
      data: {
        userId: registeredUserId,
        companyId: company.id,
        role: "ADMIN",
      },
    });
    const companyHeaders = { "X-Company-Id": company.id };
    const previousTokens = await prisma.token.findMany({
      where: {
        companyId: { in: [defaultCompanyId, company.id] },
        environment: "sandbox",
        isActive: true,
      },
      select: { id: true },
    });
    let serviceId = "";

    try {
      const customer = await prisma.customer.create({
        data: {
          companyId: company.id,
          name: `Customer ${marker}`,
          cnic: "3520112345671",
          phone: "03001234567",
          email: `${marker}@test.internal`,
          province: "Punjab",
          address: "Tenant B address",
          registrationType: "Registered",
        },
      });
      const staff = await prisma.staffMember.create({
        data: {
          companyId: company.id,
          memberName: `Staff ${marker}`,
          designation: "Accountant",
          cnicNtn: "1234567890123",
          phoneNumber: "03007654321",
          email: `staff-${marker}@test.internal`,
          province: "Sindh",
          address: "Tenant B office",
        },
      });
      const product = await prisma.product.create({
        data: {
          companyId: company.id,
          name: `Product ${marker}`,
          hsCode: "0101.2100",
          hsDescription: "Tenant B product",
          defaultSaleType: "Goods at standard rate",
          defaultRate: "18",
          defaultUom: "KG",
        },
      });
      const invoice = await prisma.invoice.create({
        data: {
          companyId: company.id,
          invoiceType: "Sale Invoice",
          invoiceDate: new Date(),
          invoiceRefNo: marker,
          sellerNTNCNIC: "1234567",
          sellerBusinessName: "Tenant B Seller",
          sellerProvince: "Punjab",
          sellerAddress: "Seller address",
          buyerBusinessName: `Buyer ${marker}`,
          buyerProvince: "Sindh",
          buyerAddress: "Buyer address",
          buyerRegistrationType: "Registered",
          isOffline: true,
          status: "OFFLINE",
          offlineQueue: {
            create: {
              invoicePayload: makeInvoicePayload(marker),
              status: "PENDING",
            },
          },
        },
        include: { offlineQueue: true },
      });
      const queueId = invoice.offlineQueue[0].id;

      const tenantCustomerList = await getJson("/api/customers", companyHeaders);
      assert.ok(tenantCustomerList.data.some((row: { id: string }) => row.id === customer.id));
      const defaultCustomerList = await getJson("/api/customers");
      assert.ok(!defaultCustomerList.data.some((row: { id: string }) => row.id === customer.id));
      assert.equal((await requestJson(`/api/customers/${customer.id}`, { method: "GET" })).status, 404);
      assert.equal((await requestJson(`/api/customers/${customer.id}`, {
        method: "PUT",
        body: { name: "Cross-tenant overwrite" },
      })).status, 404);
      assert.equal((await requestJson(`/api/customers/${customer.id}`, { method: "DELETE" })).status, 404);
      assert.equal((await prisma.customer.findUnique({ where: { id: customer.id } }))?.name, `Customer ${marker}`);

      const tenantStaff = await getJson("/api/staff-members", companyHeaders);
      assert.ok(tenantStaff.data.some((row: { id: string }) => row.id === staff.id));
      assert.equal((await requestJson(`/api/staff-members/${staff.id}`, { method: "GET" })).status, 404);
      assert.equal((await requestJson(`/api/staff-members/${staff.id}`, {
        method: "PUT",
        body: { member_name: "Cross-tenant overwrite" },
      })).status, 404);
      assert.equal((await requestJson(`/api/staff-members/${staff.id}`, { method: "DELETE" })).status, 404);

      const tenantProducts = await getJson("/api/products", companyHeaders);
      assert.ok(tenantProducts.data.some((row: { id: string }) => row.id === product.id));
      const defaultProducts = await getJson("/api/products");
      assert.ok(!defaultProducts.data.some((row: { id: string }) => row.id === product.id));
      assert.equal((await requestJson(`/api/products/${product.id}`, { method: "GET" })).status, 404);
      assert.equal((await requestJson(`/api/products/${product.id}`, {
        method: "PUT",
        body: { productName: "Cross-tenant overwrite" },
      })).status, 404);
      assert.equal((await requestJson(`/api/products/${product.id}`, { method: "DELETE" })).status, 404);
      assert.equal((await prisma.product.findUnique({ where: { id: product.id } }))?.isActive, true);

      const tenantInvoices = await getJson(`/api/invoices?search=${encodeURIComponent(marker)}`, companyHeaders);
      assert.equal(tenantInvoices.pagination.total, 1);
      const defaultInvoices = await getJson(`/api/invoices?search=${encodeURIComponent(marker)}`);
      assert.equal(defaultInvoices.pagination.total, 0);
      assert.equal((await requestJson(`/api/invoices/${invoice.id}`, { method: "GET" })).status, 404);
      assert.equal((await requestJson(`/api/dashboard/invoices/${invoice.id}`, { method: "DELETE" })).status, 404);
      assert.ok(await prisma.invoice.findUnique({ where: { id: invoice.id } }));

      const tenantQueue = await getJson("/api/queue", companyHeaders);
      assert.ok(tenantQueue.data.some((row: { id: string }) => row.id === queueId));
      const defaultQueue = await getJson("/api/queue");
      assert.ok(!defaultQueue.data.some((row: { id: string }) => row.id === queueId));
      assert.equal((await requestJson(`/api/queue/retry/${queueId}`, {
        method: "POST",
        body: { settings: { useMock: true } },
      })).status, 404);

      const createdService = await requestJson("/api/services", {
        method: "POST",
        headers: companyHeaders,
        body: { service_name: `Service ${marker}`, rate: "100", unit_of_measure: "Each" },
      });
      assert.equal(createdService.status, 201);
      serviceId = createdService.body.data.id;
      const defaultServices = await getJson("/api/services");
      assert.ok(!defaultServices.data.some((row: { id: string }) => row.id === serviceId));

      await requestJson("/api/company-profile", {
        method: "PUT",
        headers: companyHeaders,
        body: { company_name: `Profile ${marker}` },
      });
      const tenantProfile = await getJson("/api/company-profile", companyHeaders);
      const defaultProfile = await getJson("/api/company-profile");
      assert.equal(tenantProfile.data.company_name, `Profile ${marker}`);
      assert.notEqual(defaultProfile.data.company_name, `Profile ${marker}`);

      const defaultToken = `tenant-a-${marker}-aaaa`;
      const companyToken = `tenant-b-${marker}-bbbb`;
      await requestJson("/api/token", {
        method: "PUT",
        body: { environment: "sandbox", useMock: true, sandboxToken: defaultToken },
      });
      await requestJson("/api/token", {
        method: "PUT",
        headers: companyHeaders,
        body: { environment: "sandbox", useMock: true, sandboxToken: companyToken },
      });
      const defaultSettings = await getJson("/api/token");
      const tenantSettings = await getJson("/api/token", companyHeaders);
      assert.equal(defaultSettings.data.tokens.sandbox.masked, "****aaaa");
      assert.equal(tenantSettings.data.tokens.sandbox.masked, "****bbbb");

      await requestJson("/api/sandbox/results", { method: "DELETE" });
      await requestJson("/api/sandbox/results", { method: "DELETE", headers: companyHeaders });
      const sandboxRun = await requestJson("/api/sandbox/run/SN001", {
        method: "POST",
        headers: companyHeaders,
        body: { operation: "validate", settings: { useMock: true } },
      });
      assert.equal(sandboxRun.status, 200);
      const defaultResults = await getJson("/api/sandbox/results");
      const tenantResults = await getJson("/api/sandbox/results", companyHeaders);
      assert.equal(defaultResults.data.SN001, undefined);
      assert.equal(tenantResults.data.SN001.scenarioId, "SN001");
    } finally {
      if (serviceId) {
        await requestJson(`/api/services/${serviceId}`, {
          method: "DELETE",
          headers: companyHeaders,
        });
      }
      await prisma.sandboxResult.deleteMany({
        where: { companyId: { in: [defaultCompanyId, company.id] } },
      });
      const currentTokens = await prisma.token.findMany({
        where: {
          companyId: { in: [defaultCompanyId, company.id] },
          environment: "sandbox",
          id: { notIn: previousTokens.map((token) => token.id) },
        },
        select: { id: true },
      });
      if (currentTokens.length > 0) {
        await prisma.token.deleteMany({ where: { id: { in: currentTokens.map((token) => token.id) } } });
      }
      if (previousTokens.length > 0) {
        await prisma.token.updateMany({
          where: { id: { in: previousTokens.map((token) => token.id) } },
          data: { isActive: true },
        });
      }
      await prisma.company.deleteMany({ where: { id: company.id } });
    }
  });

  test("company-owned FBR records and onboarding data are isolated by company", async () => {
    const marker = `company-scope-${Date.now()}`;
    const company = await prisma.company.create({
      data: {
        name: `Company Scope ${marker}`,
        kind: "BUSINESS",
      },
    });

    try {
      await prisma.companyProfile.create({
        data: {
          companyId: company.id,
          companyName: `Profile ${marker}`,
        },
      });
      await prisma.staffMember.create({
        data: {
          companyId: company.id,
          memberName: "Scope Tester",
          designation: "Accountant",
          cnicNtn: "1234567890123",
          phoneNumber: "03001234567",
          email: `${marker}@test.internal`,
          province: "Punjab",
          address: "Test address",
        },
      });
      await prisma.customer.create({
        data: {
          companyId: company.id,
          name: `Customer ${marker}`,
          cnic: "3520112345671",
          phone: "03007654321",
          email: `customer-${marker}@test.internal`,
          province: "Sindh",
          address: "Customer address",
          registrationType: "Registered",
        },
      });
      await prisma.product.create({
        data: {
          companyId: company.id,
          name: `Product ${marker}`,
          hsCode: "0101.2100",
          hsDescription: "Company-scoped test product",
          defaultSaleType: "Goods at standard rate (default)",
          defaultRate: "18",
          defaultUom: "KG",
        },
      });
      await prisma.token.create({
        data: {
          companyId: company.id,
          environment: "sandbox",
          token: `encrypted-${marker}`,
        },
      });
      const invoice = await prisma.invoice.create({
        data: {
          companyId: company.id,
          invoiceType: "Sale Invoice",
          invoiceDate: new Date(),
          sellerNTNCNIC: "1234567",
          sellerBusinessName: "Scope Seller",
          sellerProvince: "Punjab",
          sellerAddress: "Seller address",
          buyerBusinessName: "Scope Buyer",
          buyerProvince: "Sindh",
          buyerAddress: "Buyer address",
          buyerRegistrationType: "Registered",
          items: {
            create: {
              hsCode: "0101.2100",
              productDescription: "Company-scoped test item",
              rate: "18%",
              uom: "KG",
              quantity: 1,
              totalValues: 118,
              valueSalesExcludingST: 100,
              fixedNotifiedValueOrRetailPrice: 0,
              salesTaxApplicable: 18,
              salesTaxWithheldAtSource: 0,
              saleType: "Goods at standard rate (default)",
            },
          },
        },
      });
      await prisma.offlineQueue.create({
        data: {
          invoiceId: invoice.id,
          invoicePayload: { marker },
        },
      });
      await prisma.fbrOnboarding.create({
        data: {
          companyId: company.id,
          businessNature: "Manufacturer",
          primarySector: "FMCG",
        },
      });
      await prisma.sandboxResult.create({
        data: {
          companyId: company.id,
          scenarioId: "SN001",
          scenarioName: "Standard-rate registered buyer",
          operation: "VALIDATE",
          status: "PASSED",
          statusCode: "00",
          payload: { marker },
          response: { statusCode: "00" },
          passedAt: new Date(),
        },
      });

      const ownedData = await prisma.company.findUnique({
        where: { id: company.id },
        include: {
          profile: true,
          staffMembers: true,
          customers: true,
          invoices: true,
          products: true,
          tokens: true,
          onboarding: true,
          sandboxResults: true,
        },
      });

      assert.ok(ownedData?.profile);
      assert.equal(ownedData.staffMembers.length, 1);
      assert.equal(ownedData.customers.length, 1);
      assert.equal(ownedData.invoices.length, 1);
      assert.equal(ownedData.products.length, 1);
      assert.equal(ownedData.tokens.length, 1);
      assert.ok(ownedData.onboarding);
      assert.equal(ownedData.sandboxResults.length, 1);

      await prisma.company.delete({ where: { id: company.id } });

      assert.equal(await prisma.invoice.findUnique({ where: { id: invoice.id } }), null);
      assert.equal(await prisma.offlineQueue.count({ where: { invoiceId: invoice.id } }), 0);
    } finally {
      await prisma.company.deleteMany({ where: { id: company.id } });
    }
  });

  test("token status and save flow work through /api/token", async () => {
    const previousTokens = await prisma.token.findMany({
      where: {
        companyId: defaultCompanyId,
        environment: "sandbox",
        isActive: true,
      },
      select: {
        id: true,
      },
    });
    const previous = await getJson("/api/token");
    const testToken = `codex-test-token-${Date.now()}`;

    try {
      const saved = await requestJson("/api/token", {
        method: "PUT",
        body: {
          environment: previous.data.environment,
          useMock: previous.data.useMock,
          sandboxToken: testToken,
          clearSandboxToken: false,
          clearProductionToken: false,
        },
      });

      assert.equal(saved.status, 200);
      assert.equal(saved.body.data.tokens.sandbox.configured, true);
      assert.equal(saved.body.data.tokens.sandbox.masked, `****${testToken.slice(-4)}`);

      const status = await getJson("/api/token/status");
      assert.equal(status.data.sandbox.environment, "sandbox");
      assert.ok(["mock", "configured_unverified", "active", "invalid", "error"].includes(status.data.sandbox.status));
      assert.equal(typeof status.data.hasActiveToken, "boolean");
    } finally {
      const activeAfterTest = await prisma.token.findMany({
        where: {
          companyId: defaultCompanyId,
          environment: "sandbox",
          isActive: true,
          id: {
            notIn: previousTokens.map((token) => token.id),
          },
        },
        select: {
          id: true,
        },
      });

      if (activeAfterTest.length > 0) {
        await prisma.token.deleteMany({
          where: {
            id: {
              in: activeAfterTest.map((token) => token.id),
            },
          },
        });
      }

      if (previousTokens.length > 0) {
        await prisma.token.updateMany({
          where: {
            id: {
              in: previousTokens.map((token) => token.id),
            },
          },
          data: {
            isActive: true,
          },
        });
      }

      await requestJson("/api/token", {
        method: "PUT",
        body: {
          environment: previous.data.environment,
          useMock: previous.data.useMock,
          clearSandboxToken: false,
          clearProductionToken: false,
        },
      });
    }
  });

  test("invoice list/detail and dashboard list use Invoice and InvoiceItem tables", async () => {
    const marker = `CODX-${Date.now()}`;
    const invoice = await prisma.invoice.create({
      data: {
        companyId: defaultCompanyId,
        fbrInvoiceNumber: `${marker}-FBR`,
        invoiceType: "Sale Invoice",
        invoiceDate: new Date("2026-05-08T00:00:00.000Z"),
        invoiceRefNo: marker,
        sellerNTNCNIC: "1234567890123",
        sellerBusinessName: "Codex Seller",
        sellerProvince: "Punjab",
        sellerAddress: "Test seller address",
        buyerNTNCNIC: "9876543210987",
        buyerBusinessName: "Codex Buyer",
        buyerProvince: "Sindh",
        buyerAddress: "Test buyer address",
        buyerRegistrationType: "Registered",
        status: "SUBMITTED",
        fbrRawResponse: { testMarker: marker },
        items: {
          create: {
            hsCode: "0101.2100",
            productDescription: "Automated test item",
            rate: "18%",
            uom: "KG",
            quantity: 2,
            totalValues: 236,
            valueSalesExcludingST: 200,
            fixedNotifiedValueOrRetailPrice: 0,
            salesTaxApplicable: 36,
            salesTaxWithheldAtSource: 0,
            saleType: "Goods at standard rate",
          },
        },
      },
    });

    try {
      const invoiceList = await getJson(`/api/invoices?search=${encodeURIComponent(marker)}&limit=5`);
      assert.equal(invoiceList.pagination.total, 1);
      assert.equal(invoiceList.data[0].id, invoice.id);
      assert.equal(invoiceList.data[0].amount_pkr, 236);

      const detail = await getJson(`/api/invoices/${invoice.id}`);
      assert.equal(detail.data.id, invoice.id);
      assert.equal(detail.data.invoice_ref_no, marker);
      assert.equal(detail.data.items.length, 1);
      assert.equal(detail.data.items[0].hsCode, "0101.2100");

      const dashboardList = await getJson(`/api/dashboard/invoices?search=${encodeURIComponent(marker)}&limit=5`);
      assert.equal(dashboardList.pagination.total, 1);
      assert.equal(dashboardList.data[0].id, invoice.id);
      assert.equal(dashboardList.data[0].amount_pkr, 236);
    } finally {
      await prisma.invoice.deleteMany({
        where: {
          id: invoice.id,
        },
      });
    }
  });

  test("failed invoice submissions save mapped error audit details", async () => {
    const marker = `FAIL-${Date.now()}`;

    const submitted = await requestJson("/api/invoice/submit", {
      method: "POST",
      body: {
        settings: {
          environment: "sandbox",
          useMock: true,
          mockStatus: "invalid",
        },
        invoice: {
          invoiceType: "Sale Invoice",
          invoiceDate: "2026-05-08",
          invoiceRefNo: marker,
          scenarioId: "SN001",
          sellerNTNCNIC: "1234567890123",
          sellerBusinessName: "Codex Seller",
          sellerProvince: "Punjab",
          sellerAddress: "Test seller address",
          buyerNTNCNIC: "9876543210987",
          buyerBusinessName: "Codex Buyer",
          buyerProvince: "Sindh",
          buyerAddress: "Test buyer address",
          buyerRegistrationType: "Registered",
          items: [
            {
              hsCode: "0101.2100",
              productDescription: "Automated failed submit item",
              rate: "18%",
              uoM: "KG",
              quantity: 1,
              totalValues: 118,
              valueSalesExcludingST: 100,
              fixedNotifiedValueOrRetailPrice: 0,
              salesTaxApplicable: 18,
              salesTaxWithheldAtSource: 0,
              saleType: "Goods at standard rate",
            },
          ],
        },
      },
    });

    assert.equal(submitted.status, 200);
    assert.equal(submitted.body.data.normalizedInvoice.status, "FAILED");
    assert.ok(Array.isArray(submitted.body.data.errors));
    assert.ok(submitted.body.data.errors.some((error: { errorCode: string; field: string }) => error.errorCode === "0052" && error.field === "hsCode"));

    const saved = await prisma.invoice.findUnique({
      where: {
        id: submitted.body.data.normalizedInvoice.id,
      },
    });

    try {
      assert.ok(saved);
      assert.equal(saved.status, "FAILED");
      const audit = saved.fbrRawResponse as Record<string, any>;
      assert.equal(audit.operation, "submit");
      assert.equal(audit.statusCode, "01");
      assert.equal(audit.mappedErrorCode, "0052");
      assert.equal(audit.invoiceSnapshot.invoiceRefNo, marker);
      assert.equal(audit.rawResponse.validationResponse.statusCode, "01");
      assert.ok(Array.isArray(audit.mappedErrors));
      assert.ok(audit.mappedErrors.some((error: { field: string }) => error.field === "hsCode"));
      assert.equal(audit.mappedErrorCode, submitted.body.data.errors[0].errorCode);
      assert.equal(typeof audit.timestamp, "string");
    } finally {
      await prisma.invoice.deleteMany({
        where: {
          invoiceRefNo: marker,
        },
      });
    }
  });

  test("offline queue failed and retry aliases are available", async () => {
    const marker = `QUEUE-${Date.now()}`;
    const invoice = await prisma.invoice.create({
      data: {
        companyId: defaultCompanyId,
        invoiceType: "Sale Invoice",
        invoiceDate: new Date("2026-05-08T00:00:00.000Z"),
        invoiceRefNo: marker,
        sellerNTNCNIC: "1234567890123",
        sellerBusinessName: "Codex Seller",
        sellerProvince: "Punjab",
        sellerAddress: "Test seller address",
        buyerNTNCNIC: "9876543210987",
        buyerBusinessName: "Codex Buyer",
        buyerProvince: "Sindh",
        buyerAddress: "Test buyer address",
        buyerRegistrationType: "Registered",
        status: "FAILED",
        isOffline: true,
        offlineQueuedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        offlineQueue: {
          create: {
            invoicePayload: { invoiceRefNo: marker, items: [] },
            status: "FAILED",
            queuedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
            retryCount: 3,
            lastError: "Automated test failure",
          },
        },
      },
      include: {
        offlineQueue: true,
      },
    });
    const queueId = invoice.offlineQueue[0].id;

    try {
      const status = await getJson("/api/queue/status");
      assert.equal(typeof status.data.pending, "number");
      assert.equal(typeof status.data.failed, "number");

      const failed = await getJson(`/api/queue/failed?limit=100`);
      assert.ok(failed.data.some((record: { id: string }) => record.id === queueId));
      const failedRecord = failed.data.find((record: { id: string }) => record.id === queueId);
      assert.equal(failedRecord.isUploadDeadlineExpired, true);

      const retryMissing = await requestJson("/api/queue/retry/not-a-real-id", {
        method: "POST",
        body: {},
      });
      assert.equal(retryMissing.status, 404);
    } finally {
      await prisma.invoice.deleteMany({
        where: {
          id: invoice.id,
        },
      });
    }
  });

  test("offline queue add alias accepts queued invoice payloads", async () => {
    const marker = `QUEUE-ADD-${Date.now()}`;

    const created = await requestJson("/api/queue/add", {
      method: "POST",
      body: {
        invoicePayload: {
          invoiceType: "Sale Invoice",
          invoiceDate: "2026-05-08",
          invoiceRefNo: marker,
          sellerNTNCNIC: "1234567890123",
          sellerBusinessName: "Codex Seller",
          sellerProvince: "Punjab",
          sellerAddress: "Test seller address",
          buyerNTNCNIC: "9876543210987",
          buyerBusinessName: "Codex Buyer",
          buyerProvince: "Sindh",
          buyerAddress: "Test buyer address",
          buyerRegistrationType: "Registered",
          items: [
            {
              hsCode: "0101.2100",
              productDescription: "Automated queue add item",
              rate: "18%",
              uoM: "KG",
              quantity: 1,
              totalValues: 118,
              valueSalesExcludingST: 100,
              fixedNotifiedValueOrRetailPrice: 0,
              salesTaxApplicable: 18,
              salesTaxWithheldAtSource: 0,
              saleType: "Goods at standard rate",
            },
          ],
        },
      },
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.data.status, "PENDING");

    await prisma.offlineQueue.deleteMany({
      where: {
        id: created.body.data.id,
      },
    });
    await prisma.invoice.deleteMany({
      where: {
        invoiceRefNo: marker,
      },
    });
  });

  test("offline queue local mocked flow adds, warns, manually processes, and uploads", async () => {
    const marker = `QUEUE-FLOW-${Date.now()}`;
    const queuedAt = new Date(Date.now() - 21 * 60 * 60 * 1000);
    let queueId = "";

    const created = await requestJson("/api/queue/add", {
      method: "POST",
      body: {
        settings: {
          environment: "sandbox",
        },
        invoicePayload: makeInvoicePayload(marker),
      },
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.data.status, "PENDING");
    queueId = created.body.data.id;

    try {
      await prisma.offlineQueue.update({
        where: {
          id: queueId,
        },
        data: {
          queuedAt,
          invoice: {
            update: {
              offlineQueuedAt: queuedAt,
            },
          },
        },
      });

      const pendingList = await getJson(`/api/queue?limit=100`);
      const pendingRecord = pendingList.data.find((record: { id: string }) => record.id === queueId);
      assert.ok(pendingRecord);
      assert.equal(pendingRecord.isUploadDeadlineWarning, true);
      assert.equal(pendingRecord.isUploadDeadlineExpired, false);

      const statusBefore = await getJson("/api/queue/status");
      assert.ok(statusBefore.data.warningCount >= 1);

      const processed = await requestJson("/api/queue/process", {
        method: "POST",
        body: {
          limit: 1,
          settings: {
            environment: "sandbox",
            useMock: true,
            mockStatus: "valid",
          },
        },
      });

      assert.equal(processed.status, 200);
      assert.equal(processed.body.data.processed, 1);
      assert.equal(processed.body.data.uploaded, 1);
      assert.equal(processed.body.data.results[0].id, queueId);
      assert.equal(processed.body.data.results[0].status, "UPLOADED");
      assert.ok(processed.body.data.results[0].fbrInvoiceNumber);

      const uploadedQueue = await prisma.offlineQueue.findUnique({
        where: {
          id: queueId,
        },
        include: {
          invoice: true,
        },
      });
      assert.ok(uploadedQueue);
      assert.equal(uploadedQueue.status, "UPLOADED");
      assert.equal(uploadedQueue.invoice.status, "SUBMITTED");
      assert.ok(uploadedQueue.uploadedAt);
    } finally {
      await prisma.offlineQueue.deleteMany({
        where: {
          id: queueId || "__missing__",
        },
      });
      await prisma.invoice.deleteMany({
        where: {
          invoiceRefNo: marker,
        },
      });
    }
  });

  test("offline queue retry marks invoice failed after third mocked failure", async () => {
    const marker = `QUEUE-RETRY-${Date.now()}`;
    let queueId = "";

    const created = await requestJson("/api/queue/add", {
      method: "POST",
      body: {
        invoicePayload: makeInvoicePayload(marker),
      },
    });

    assert.equal(created.status, 201);
    queueId = created.body.data.id;

    try {
      await prisma.offlineQueue.update({
        where: {
          id: queueId,
        },
        data: {
          retryCount: 2,
        },
      });

      const retried = await requestJson(`/api/queue/retry/${queueId}`, {
        method: "POST",
        body: {
          settings: {
            environment: "sandbox",
            useMock: true,
            mockStatus: "invalid",
          },
        },
      });

      assert.equal(retried.status, 200);
      assert.equal(retried.body.data.status, "FAILED");
      assert.equal(retried.body.data.retryCount, 3);
      assert.ok(retried.body.data.lastError);

      const failed = await getJson(`/api/queue/failed?limit=100`);
      assert.ok(failed.data.some((record: { id: string }) => record.id === queueId));

      const failedQueue = await prisma.offlineQueue.findUnique({
        where: {
          id: queueId,
        },
        include: {
          invoice: true,
        },
      });
      assert.ok(failedQueue);
      assert.equal(failedQueue.status, "FAILED");
      assert.equal(failedQueue.invoice.status, "FAILED");
    } finally {
      await prisma.offlineQueue.deleteMany({
        where: {
          id: queueId || "__missing__",
        },
      });
      await prisma.invoice.deleteMany({
        where: {
          invoiceRefNo: marker,
        },
      });
    }
  });

  test("product autofill alias returns invoice-ready fields", async () => {
    const marker = `Codex Product ${Date.now()}`;
    const product = await prisma.product.create({
      data: {
        companyId: defaultCompanyId,
        name: marker,
        hsCode: "0101.2100",
        hsDescription: "Pure-bred breeding horses",
        defaultSaleType: "Goods at standard rate",
        defaultRate: "18",
        defaultUom: "KG",
        inStock: "12",
        sroScheduleNo: "SRO-TEST",
      },
    });

    try {
      const autofill = await getJson(`/api/products/${product.id}/autofill`);
      assert.equal(autofill.data.productId, product.id);
      assert.equal(autofill.data.hsCode, "0101.2100");
      assert.equal(autofill.data.productDescription, "Pure-bred breeding horses");
      assert.equal(autofill.data.rate, "18");
      assert.equal(autofill.data.uoM, "KG");
      assert.equal(autofill.data.invoiceFields.productMappingId, product.id);
    } finally {
      await prisma.product.deleteMany({
        where: {
          id: product.id,
        },
      });
    }
  });

  test("reference route aliases accept guide-compatible query parameter names", async () => {
    const fetchedAt = new Date();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const cacheEntries = [
      {
        cacheKey: "fbr:reference:sroSchedules?date=2026-05-08&origination_supplier=Punjab&rate_id=734",
        key: "sroSchedules",
        data: [{ id: "7", description: "Cached SRO schedule" }],
      },
      {
        cacheKey: "fbr:reference:saleTypeRates?date=2026-05-08&originationSupplier=Punjab&transTypeId=75",
        key: "saleTypeRates",
        data: [{ id: "734", description: "18%", value: "18" }],
      },
      {
        cacheKey: "fbr:reference:hsUoms?annexure_id=75&hs_code=0101.2100",
        key: "hsUoms",
        data: [{ id: "13", description: "KG" }],
      },
      {
        cacheKey: "fbr:reference:sroItems?date=2026-05-08&sro_id=7",
        key: "sroItems",
        data: [{ id: "17853", description: "50" }],
      },
      {
        cacheKey: "fbr:reference:statl?date=2026-05-08&regno=1234567",
        key: "statl",
        data: { statusCode: "00", status: "Active", isActive: true },
      },
      {
        cacheKey: "fbr:reference:registrationType?Registration_No=1234567",
        key: "registrationType",
        data: { statusCode: "00", registrationNo: "1234567", registrationType: "Registered" },
      },
    ];

    try {
      for (const entry of cacheEntries) {
        await prisma.referenceCache.upsert({
          where: {
            cacheKey: entry.cacheKey,
          },
          create: {
            cacheKey: entry.cacheKey,
            fetchedAt,
            expiresAt,
            data: {
              key: entry.key,
              source: "mock",
              cacheHit: false,
              fetchedAt: fetchedAt.toISOString(),
              data: entry.data,
              raw: entry.data,
            },
          },
          update: {
            fetchedAt,
            expiresAt,
            data: {
              key: entry.key,
              source: "mock",
              cacheHit: false,
              fetchedAt: fetchedAt.toISOString(),
              data: entry.data,
              raw: entry.data,
            },
          },
        });
      }

      const sroSchedule = await getJson("/api/ref/sroschedule?rateId=734&date=2026-05-08&supplier=Punjab");
      assert.equal(sroSchedule.cacheHit, true);
      assert.equal(sroSchedule.data[0].description, "Cached SRO schedule");

      const rates = await getJson("/api/ref/rates?trans_type_id=75&date=2026-05-08&province=Punjab");
      assert.equal(rates.cacheHit, true);
      assert.equal(rates.data[0].value, "18");

      const hsUom = await getJson("/api/ref/hsuom?hsCode=0101.2100&annexureId=75");
      assert.equal(hsUom.cacheHit, true);
      assert.equal(hsUom.data[0].description, "KG");

      const sroItem = await getJson("/api/ref/sroitem?date=2026-05-08&sroId=7");
      assert.equal(sroItem.cacheHit, true);
      assert.equal(sroItem.data[0].id, "17853");

      const statl = await getJson("/api/ref/statl?registrationNo=1234567&date=2026-05-08");
      assert.equal(statl.cacheHit, true);
      assert.equal(statl.data.status, "Active");

      const regType = await getJson("/api/ref/regtype?regno=1234567");
      assert.equal(regType.cacheHit, true);
      assert.equal(regType.data.registrationType, "Registered");
    } finally {
      await prisma.referenceCache.deleteMany({
        where: {
          cacheKey: {
            in: cacheEntries.map((entry) => entry.cacheKey),
          },
        },
      });
    }
  });

  test("sandbox summary and results aliases return stable response bodies", async () => {
    const summary = await getJson("/api/sandbox/summary");
    assert.equal(typeof summary.data.eligibleForProduction, "boolean");
    assert.ok(Array.isArray(summary.data.scenarios));
    assert.ok(summary.data.scenarios.some((scenario: { scenarioId: string }) => scenario.scenarioId === "SN001"));
    assert.equal(typeof summary.data.ready, "number");

    const results = await getJson("/api/sandbox/results");
    assert.equal(typeof results.data, "object");
    assert.equal(Array.isArray(results.data), false);
  });

  test("product CRUD: create, get, list, update, and soft-delete via /api/products", async () => {
    const marker = `TEST-PRODUCT-${Date.now()}`;
    let createdId = "";

    try {
      // CREATE
      const created = await requestJson("/api/products", {
        method: "POST",
        body: {
          productName: marker,
          hsCode: "0101.2100",
          salesTaxRate: 18,
          unitOfMeasurement: "KG",
          saleType: "Goods at standard rate",
          inStock: "50",
        },
      });
      assert.equal(created.status, 201);
      assert.equal(created.body.data.productName, marker);
      assert.equal(created.body.data.hsCode, "0101.2100");
      assert.equal(created.body.data.isActive, true);
      assert.equal(created.body.data.status, "Active");
      assert.equal(created.body.data.salesTaxRate, 18);
      assert.ok(created.body.data.invoiceFields?.productMappingId);
      createdId = created.body.data.id;

      // GET by ID
      const fetched = await getJson(`/api/products/${createdId}`);
      assert.equal(fetched.data.id, createdId);
      assert.equal(fetched.data.productName, marker);

      // LIST with search
      const list = await getJson(`/api/products?search=${encodeURIComponent(marker)}`);
      assert.ok(Array.isArray(list.data));
      assert.ok(list.data.some((p: { id: string }) => p.id === createdId));

      // UPDATE (partial — only changed fields; others fall back to existing)
      const updated = await requestJson(`/api/products/${createdId}`, {
        method: "PUT",
        body: { inStock: "99" },
      });
      assert.equal(updated.status, 200);
      assert.equal(updated.body.data.inStock, "99");
      assert.equal(updated.body.data.productName, marker, "productName should be preserved on partial update");

      // DELETE (soft — sets isActive=false)
      const deleted = await requestJson(`/api/products/${createdId}`, {
        method: "DELETE",
      });
      assert.equal(deleted.status, 200);
      assert.equal(deleted.body.data.id, createdId);
      assert.equal(deleted.body.data.deleted, true);

      // GET after soft-delete returns the record with isActive=false
      const afterDelete = await getJson(`/api/products/${createdId}`);
      assert.equal(afterDelete.data.isActive, false);
      assert.equal(afterDelete.data.status, "Inactive");

      // 404 for a completely unknown ID
      const notFound = await requestJson("/api/products/not-a-real-id", { method: "GET" });
      assert.equal(notFound.status, 404);
    } finally {
      if (createdId) {
        await prisma.product.deleteMany({ where: { id: createdId } });
      } else {
        await prisma.product.deleteMany({ where: { name: marker } });
      }
    }
  });

  test("token encryption: DB stores ciphertext and masked response uses plaintext last-4", async () => {
    const testToken = `enc-roundtrip-${Date.now()}-abcd`;
    const previousTokens = await prisma.token.findMany({
      where: { companyId: defaultCompanyId, environment: "sandbox", isActive: true },
      select: { id: true },
    });

    try {
      const saved = await requestJson("/api/token", {
        method: "PUT",
        body: {
          sandboxToken: testToken,
          clearSandboxToken: false,
          clearProductionToken: false,
        },
      });
      assert.equal(saved.status, 200);

      // masked value must reflect the last 4 chars of the plaintext token
      assert.equal(saved.body.data.tokens.sandbox.masked, `****${testToken.slice(-4)}`);
      assert.equal(saved.body.data.tokens.sandbox.configured, true);

      // DB must store ciphertext, not the plaintext
      const dbRow = await prisma.token.findFirst({
        where: { companyId: defaultCompanyId, environment: "sandbox", isActive: true },
        orderBy: { createdAt: "desc" },
        select: { token: true },
      });
      assert.ok(dbRow?.token, "token row should exist in DB");
      assert.ok(dbRow!.token.startsWith("v1:"), "stored value must carry v1: AES-256-GCM prefix");
      assert.ok(!dbRow!.token.includes(testToken), "plaintext must not appear in DB");

      // status endpoint must recognise the newly stored token
      const status = await getJson("/api/token/status");
      assert.ok(
        ["mock", "configured_unverified", "active"].includes(status.data.sandbox.status),
        `unexpected sandbox status: ${status.data.sandbox.status}`,
      );
    } finally {
      await prisma.token.updateMany({
        where: { companyId: defaultCompanyId, environment: "sandbox", isActive: true },
        data: { isActive: false },
      });
      if (previousTokens.length > 0) {
        await prisma.token.updateMany({
          where: { id: { in: previousTokens.map((t) => t.id) } },
          data: { isActive: true },
        });
      }
    }
  });

  test("mocked sandbox run: single scenario passes and status reflects result", async () => {
    // clear any previous results so we start clean
    await requestJson("/api/sandbox/results", { method: "DELETE" });

    // run SN001 in mock mode (operation=submit, useMock defaults to env setting)
    const runRes = await requestJson("/api/sandbox/run/SN001", {
      method: "POST",
      body: { operation: "submit", settings: { useMock: true } },
    });
    assert.equal(runRes.status, 200, "POST /api/sandbox/run/SN001 should return 200");
    const result = runRes.body.data;

    // result shape
    assert.equal(result.scenarioId, "SN001");
    assert.equal(typeof result.passed, "boolean");
    assert.equal(typeof result.statusCode, "string");
    assert.equal(typeof result.durationMs, "number");
    assert.equal(result.operationType, "submit");
    assert.equal(result.runMode, "mock");
    assert.ok(Array.isArray(result.errors));
    assert.ok(Array.isArray(result.mappedErrors));
    assert.equal(typeof result.payload, "object");
    assert.equal(typeof result.raw, "object");

    // mock mode always succeeds
    assert.equal(result.passed, true, "mock submit should pass");
    assert.ok(result.invoiceNumber, "mock submit should return a fake invoice number");

    // status endpoint should now reflect the run
    const status = await getJson("/api/sandbox/status");
    const sn001 = status.data.scenarios.find((s: { scenarioId: string }) => s.scenarioId === "SN001");
    assert.ok(sn001, "SN001 should appear in status scenarios");
    assert.equal(sn001.overallStatus, "passed");
    assert.ok(sn001.lastResult?.invoiceNumber, "lastResult should include the invoice number");
    assert.equal(sn001.lastResult?.runMode, "mock");
    assert.equal(typeof sn001.lastResult?.payload, "object");
    assert.ok(Array.isArray(sn001.lastResult?.mappedErrors));

    // results endpoint should include SN001
    const results = await getJson("/api/sandbox/results");
    assert.ok(results.data["SN001"], "results map should contain SN001");
    assert.equal(results.data["SN001"].passed, true);

    // run all required scenarios in mock mode
    const batchRes = await requestJson("/api/sandbox/run", {
      method: "POST",
      body: {
        operation: "submit",
        settings: { useMock: true },
        scenarioIds: [
          "SN001",
          "SN002",
          "SN003",
          "SN005",
          "SN006",
          "SN007",
          "SN008",
          "SN009",
          "SN010",
          "SN012",
          "SN017",
          "SN018",
          "SN019",
        ],
      },
    });
    assert.equal(batchRes.status, 200);
    const batch = batchRes.body.data;
    assert.equal(batch.processed, 13, "all 13 required scenarios should run");
    assert.equal(batch.passed, 13, "all 13 should pass in mock mode");
    assert.equal(batch.failed, 0);
    assert.equal(batch.skipped, 0);

    // after all pass, eligibleForProduction should be true
    const finalStatus = await getJson("/api/sandbox/summary");
    assert.equal(finalStatus.data.eligibleForProduction, true, "eligible after all required scenarios pass");

    // clean up
    await requestJson("/api/sandbox/results", { method: "DELETE" });
  });
});

async function getJson(path: string, extraHeaders: Record<string, string> = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${authToken}`, ...extraHeaders },
  });
  assert.equal(response.ok, true, `${path} returned HTTP ${response.status}`);
  return response.json() as Promise<Record<string, any>>;
}

async function requestJson(
  path: string,
  options: {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    body?: unknown;
    headers?: Record<string, string>;
  },
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${authToken}`,
    ...options.headers,
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return {
    status: response.status,
    body: body as Record<string, any>,
  };
}

async function registerTestUser(email: string, fullName: string) {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "TestRunner1!", fullName }),
  });
  const body = await response.json() as Record<string, any>;
  assert.equal(response.status, 201);
  return body;
}

function makeInvoicePayload(invoiceRefNo: string) {
  return {
    invoiceType: "Sale Invoice",
    invoiceDate: "2026-05-08",
    invoiceRefNo,
    scenarioId: "SN001",
    sellerNTNCNIC: "1234567890123",
    sellerBusinessName: "Codex Seller",
    sellerProvince: "Punjab",
    sellerAddress: "Test seller address",
    buyerNTNCNIC: "9876543210987",
    buyerBusinessName: "Codex Buyer",
    buyerProvince: "Sindh",
    buyerAddress: "Test buyer address",
    buyerRegistrationType: "Registered",
    items: [
      {
        hsCode: "0101.2100",
        productDescription: "Automated offline queue item",
        rate: "18%",
        uoM: "KG",
        quantity: 1,
        totalValues: 118,
        valueSalesExcludingST: 100,
        fixedNotifiedValueOrRetailPrice: 0,
        salesTaxApplicable: 18,
        salesTaxWithheldAtSource: 0,
        saleType: "Goods at standard rate",
      },
    ],
  };
}
