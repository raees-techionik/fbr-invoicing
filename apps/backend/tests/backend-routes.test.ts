import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

process.env.OFFLINE_QUEUE_AUTO_PROCESS_DISABLED = "true";
process.env.DEV_DB_FALLBACK_DISABLED = "true";

let server: Server;
let baseUrl = "";
let authToken = "";

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
  authToken = registerBody.accessToken;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await prisma.$disconnect();
});

describe("backend guide-compatible route contracts", () => {
  test("token status and save flow work through /api/token", async () => {
    const previousTokens = await prisma.token.findMany({
      where: {
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
      where: { environment: "sandbox", isActive: true },
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
        where: { environment: "sandbox", isActive: true },
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
        where: { environment: "sandbox", isActive: true },
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
    assert.ok(Array.isArray(result.errors));

    // mock mode always succeeds
    assert.equal(result.passed, true, "mock submit should pass");
    assert.ok(result.invoiceNumber, "mock submit should return a fake invoice number");

    // status endpoint should now reflect the run
    const status = await getJson("/api/sandbox/status");
    const sn001 = status.data.scenarios.find((s: { scenarioId: string }) => s.scenarioId === "SN001");
    assert.ok(sn001, "SN001 should appear in status scenarios");
    assert.equal(sn001.overallStatus, "passed");
    assert.ok(sn001.lastResult?.invoiceNumber, "lastResult should include the invoice number");

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
        scenarioIds: ["SN001", "SN002", "SN005", "SN006", "SN007", "SN008", "SN017", "SN018", "SN019"],
      },
    });
    assert.equal(batchRes.status, 200);
    const batch = batchRes.body.data;
    assert.equal(batch.processed, 9, "all 9 required scenarios should run");
    assert.equal(batch.passed, 9, "all 9 should pass in mock mode");
    assert.equal(batch.failed, 0);
    assert.equal(batch.skipped, 0);

    // after all pass, eligibleForProduction should be true
    const finalStatus = await getJson("/api/sandbox/summary");
    assert.equal(finalStatus.data.eligibleForProduction, true, "eligible after all required scenarios pass");

    // clean up
    await requestJson("/api/sandbox/results", { method: "DELETE" });
  });
});

async function getJson(path: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  assert.equal(response.ok, true, `${path} returned HTTP ${response.status}`);
  return response.json() as Promise<Record<string, any>>;
}

async function requestJson(
  path: string,
  options: {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    body?: unknown;
  },
) {
  const headers: Record<string, string> = { Authorization: `Bearer ${authToken}` };
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
