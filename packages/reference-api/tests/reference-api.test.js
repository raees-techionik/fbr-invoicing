import test from "node:test";
import assert from "node:assert/strict";

import { createReferenceApiClient, MemoryCache } from "../src/index.js";

test("returns normalized provinces from mocks", async () => {
  const client = createReferenceApiClient({ useMocks: true });
  const result = await client.getProvinces();

  assert.equal(result.source, "mock");
  assert.deepEqual(result.data, [
    {
      code: 7,
      description: "PUNJAB",
      raw: { stateProvinceCode: 7, stateProvinceDesc: "PUNJAB" }
    },
    {
      code: 8,
      description: "SINDH",
      raw: { stateProvinceCode: 8, stateProvinceDesc: "SINDH" }
    }
  ]);
});

test("caches GET requests by endpoint and params", async () => {
  const seenUrls = [];
  const fetchImpl = async (url) => {
    seenUrls.push(String(url));
    return {
      ok: true,
      json: async () => [{ docTypeId: 4, docDescription: "Sale Invoice" }]
    };
  };

  const client = createReferenceApiClient({
    token: "token-123",
    fetchImpl,
    cache: new MemoryCache()
  });

  const first = await client.getDocumentTypes();
  const second = await client.getDocumentTypes();

  assert.equal(seenUrls.length, 1);
  assert.equal(first.data[0].id, 4);
  assert.equal(second.data[0].description, "Sale Invoice");
});

test("builds query-string URLs for parameterized reference endpoints", async () => {
  let capturedUrl = null;
  let capturedHeaders = null;

  const fetchImpl = async (url, init) => {
    capturedUrl = String(url);
    capturedHeaders = init.headers;
    return {
      ok: true,
      json: async () => [{ ratE_ID: 734, ratE_DESC: "18%", ratE_VALUE: 18 }]
    };
  };

  const client = createReferenceApiClient({
    token: "abc123",
    fetchImpl
  });

  const result = await client.getSaleTypeRates({
    date: "2025-02-24",
    transactionTypeId: 18,
    originationSupplier: 1
  });

  assert.match(capturedUrl, /\/pdi\/v2\/SaleTypeToRate\?/);
  assert.match(capturedUrl, /date=2025-02-24/);
  assert.match(capturedUrl, /transTypeId=18/);
  assert.match(capturedUrl, /originationSupplier=1/);
  assert.equal(capturedHeaders.Authorization, "Bearer abc123");
  assert.deepEqual(result.data[0], {
    id: 734,
    description: "18%",
    value: 18,
    raw: { ratE_ID: 734, ratE_DESC: "18%", ratE_VALUE: 18 }
  });
});

test("validates required parameters before requesting parameterized endpoints", async () => {
  const client = createReferenceApiClient({ useMocks: true });

  assert.throws(
    () => client.getHsUoms({ hsCode: "5904.9000" }),
    /missing required fields: annexureId/
  );
});

test("normalizes single-object reference endpoints", async () => {
  const client = createReferenceApiClient({ useMocks: true });
  const result = await client.getRegistrationType({ registrationNo: "0788762" });

  assert.deepEqual(result.data, {
    statusCode: "00",
    registrationNo: "0788762",
    registrationType: "Registered",
    isRegistered: true,
    raw: {
      statuscode: "00",
      REGISTRATION_NO: "0788762",
      REGISTRATION_TYPE: "Registered"
    }
  });
});
