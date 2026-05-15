# FBR Reference API Starter

Portable reference-data client for the FBR Digital Invoicing endpoints.

What it covers:

- provinces
- document types
- item descriptions / HS codes
- SRO item codes
- transaction types
- UOMs
- SRO schedules
- sale-type-to-rate
- HS to UOM
- SRO items
- STATL
- registration type

Design choices:

- Plain JavaScript ESM so it can be moved into the website repo without adding a build dependency.
- 24-hour in-memory cache by default.
- Normalized response shapes for UI dropdowns, while keeping raw FBR payloads attached.
- Mock mode for local development while token and whitelisting are pending.

Example:

```js
import { createReferenceApiClient } from "./src/index.js";

const client = createReferenceApiClient({
  token: process.env.FBR_TOKEN,
  useMocks: true
});

const provinces = await client.getProvinces();
console.log(provinces.data);
```
