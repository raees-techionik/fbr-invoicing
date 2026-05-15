# FBR Z — E-Invoicing Backend

REST API for the FBR Digital Invoicing portal. Built with **Express + TypeScript + Prisma + Neon PostgreSQL**, integrated with FBR's gateway at `gw.fbr.gov.pk`.

---

## Prerequisites

- Node.js 18+
- A [Neon](https://neon.tech) PostgreSQL database (or any PostgreSQL instance)
- FBR sandbox token from PRAL (required for live FBR calls; mocks work without it)

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (Neon or local) |
| `JWT_SECRET` | Yes | Any long random string for signing JWTs |
| `JWT_EXPIRES_IN` | Yes | Token expiry e.g. `7d` |
| `FBR_BASE_URL` | Yes | `https://gw.fbr.gov.pk` |
| `FBR_SETTINGS_ENCRYPTION_KEY` | Yes | Any long random string — used to encrypt FBR tokens at rest |
| `FBR_ENVIRONMENT` | Yes | `sandbox` or `production` |
| `FBR_INVOICE_USE_MOCKS` | Yes | `true` for local dev (no FBR token needed); `false` for live |
| `FBR_REFERENCE_USE_MOCKS` | Yes | `true` for local dev; `false` to hit real FBR reference APIs |
| `FBR_SANDBOX_TOKEN` | No | Bearer token from PRAL sandbox (leave empty until received) |
| `FBR_PRODUCTION_TOKEN` | No | Bearer token from PRAL production (after all sandbox scenarios pass) |
| `FBR_REFERENCE_API_TOKEN` | No | Same as sandbox token — used for reference API calls |
| `FBR_REFERENCE_INVOICE_LOOKUP_URL` | No | FBR reference invoice lookup URL (optional feature) |
| `PORT` | No | Server port — defaults to `3000` |

> For local development, set `FBR_INVOICE_USE_MOCKS=true` and `FBR_REFERENCE_USE_MOCKS=true`. The server works fully without a real FBR token.

### Render deployment

This backend is ready to deploy on Render from the monorepo root with `render.yaml`.

Manual Render settings:

```text
Root Directory: apps/backend
Build Command: npm install && npm run build
Start Command: npm run start
Health Check Path: /health
```

Required Render environment variables:

```text
DATABASE_URL
JWT_SECRET
FBR_SETTINGS_ENCRYPTION_KEY
ADMIN_PASSWORD
```

For the current demo build, keep:

```text
ADMIN_EMAIL=admin@fbr.com
ALLOW_DEV_ADMIN_LOGIN=true
FBR_REFERENCE_USE_MOCKS=true
FBR_INVOICE_USE_MOCKS=true
```

### 3. Set up the database

Push the Prisma schema to your database and generate the client:

```bash
npx prisma db push
npx prisma generate
```

> If you want to inspect the database visually: `npm run prisma:studio`

### 4. Start the server

```bash
# Development (auto-reloads on file changes)
npm run dev

# Production
npm run build
npm start
```

Server runs on `http://localhost:3000` by default.

---

## API Endpoints

All endpoints are prefixed with `/api`.

### Token / Settings
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/token` | Save FBR Bearer token (sandbox or production) |
| `GET` | `/api/token/status` | Check active token environment |
| `GET` | `/api/settings` | Get current FBR settings |

### Invoices
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/invoices` | List invoices (supports `search`, `dateFrom`, `dateTo`, `invoiceType`, `status`, `limit`, `offset`) |
| `GET` | `/api/invoices/:id` | Get invoice detail with all line items |
| `POST` | `/api/invoice/submit` | Submit invoice to FBR — saves as SUBMITTED or FAILED |
| `POST` | `/api/invoice/validate` | Validate invoice payload against FBR (sandbox only) |
| `POST` | `/api/invoice/format` | Preview formatted FBR payload without submitting |
| `GET` | `/api/invoice/reference-lookup` | Look up a reference invoice by `invoiceRefNo` |

### Reference Data (FBR)
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/ref/provinces` | Province list |
| `GET` | `/api/ref/doctypes` | Document types (Sale Invoice, Debit Note) |
| `GET` | `/api/ref/hscodes` | Full HS code list with descriptions |
| `GET` | `/api/ref/uom` | Units of measurement |
| `GET` | `/api/ref/transactiontypes` | Transaction / sale types |
| `GET` | `/api/ref/sroschedule` | SRO schedules (`?rate_id=&date=&supplier=`) |
| `GET` | `/api/ref/rates` | Tax rates by sale type (`?transTypeId=&date=&province=`) |
| `GET` | `/api/ref/hsuom` | Valid UOM for a given HS code (`?hs_code=&annexure_id=`) |
| `GET` | `/api/ref/sroitem` | SRO items (`?date=&sro_id=`) |
| `GET` | `/api/ref/statl` | Check if a taxpayer is on the Active Taxpayer List |
| `GET` | `/api/ref/regtype` | Get buyer registration type by NTN/CNIC |
| `GET` | `/api/ref/bootstrap` | All reference data in one call (used by invoice form) |

> Reference data is cached in the database for 24 hours. No repeated FBR calls during that window.

### Products (HS Code Mapping)
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/products` | List products (`?search=&status=&limit=`) |
| `POST` | `/api/products` | Create product (HS code validated against FBR reference) |
| `PUT` | `/api/products/:id` | Update product |
| `DELETE` | `/api/products/:id` | Soft-delete product (sets `isActive=false`) |
| `GET` | `/api/products/:id/autofill` | Get pre-filled invoice line item fields for a product |
| `GET` | `/api/products/hs-search` | Search HS codes (`?query=&limit=`) |
| `GET` | `/api/products/resolve` | Resolve HS code to invoice fields (`?hsCode=&saleType=&invoiceDate=`) |
| `POST` | `/api/products/bulk-import` | Bulk import products — accepts `[{...}]` or `{ products: [{...}] }` |

### Offline Queue
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/queue/add` | Enqueue an invoice for offline submission |
| `GET` | `/api/queue` | List queue items |
| `GET` | `/api/queue/status` | Queue summary (PENDING / UPLOADED / FAILED counts) |
| `GET` | `/api/queue/failed` | List failed queue items |
| `POST` | `/api/queue/:id/retry` | Retry a failed queue item |

> The queue processor runs automatically every 2 minutes. It retries up to 3 times, enforces the 24-hour legal deadline (Rule 150XC), and flags items older than 20 hours as urgent.

### Sandbox Testing
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/sandbox/run/:scenarioId` | Run a test scenario (e.g. `SN001`) |
| `GET` | `/api/sandbox/status` | Scenario pass/fail status |
| `GET` | `/api/sandbox/summary` | Total / passed / remaining + `eligibleForProduction` flag |
| `GET` | `/api/sandbox/results` | Full results for all run scenarios |
| `DELETE` | `/api/sandbox/results` | Reset all scenario results |

> Required scenarios before production: SN001, SN002, SN005, SN006, SN007, SN008, SN016, SN026, SN027. When all pass, `eligibleForProduction: true`.

### Dashboard
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/dashboard/invoices` | Invoice list with filters (same params as `/api/invoices`) |
| `GET` | `/api/dashboard/invoices/:id` | Invoice detail |
| `POST` | `/api/dashboard/invoices` | Create a manual invoice record |
| `DELETE` | `/api/dashboard/invoices/:id` | Delete invoice record |
| `PATCH` | `/api/dashboard/invoices/:id/claimed` | Mark invoice as claimed |
| `GET` | `/api/dashboard/summary` | Totals — invoice count, amount, submitted, failed |
| `GET` | `/api/dashboard/charts` | Chart data (`?period=daily\|monthly\|quarterly\|yearly`) |

### Company Profile, Customers, Staff
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/company-profile` | Get company profile (auto-fills seller fields in invoice form) |
| `PUT` | `/api/company-profile` | Update company profile |
| `GET` | `/api/customers` | List customers |
| `POST` | `/api/customers` | Add customer |
| `GET` | `/api/staff` | List staff members |
| `POST` | `/api/staff` | Add staff member |

---

## Running Tests

```bash
npm test
```

Runs the integration test suite (11 tests). Uses mocked FBR calls — no real token required.

---

## Database Models

| Model | Purpose |
|---|---|
| `Invoice` | Submitted / failed / offline invoices |
| `InvoiceItem` | Line items per invoice (all 26 Rule 150R fields) |
| `Product` | HS code mappings — autofill invoice line items |
| `Token` | FBR Bearer tokens (AES-256-GCM encrypted at rest) |
| `OfflineQueue` | Queue for invoices awaiting FBR submission |
| `ReferenceCache` | 24-hour cache of FBR reference API responses |
| `CompanyProfile` | Seller details (pre-fills invoice form) |
| `Customer` | Buyer address book |
| `StaffMember` | Staff directory |

---

## FBR Token Setup (when PRAL token arrives)

1. Go to Settings in the app and paste the sandbox Bearer token
2. Run all 9 required sandbox scenarios from the Sandbox page
3. When `eligibleForProduction: true`, request the production token from PRAL
4. Paste the production token in Settings and switch environment to `production`

---

## Compliance Notes

- **Rule 150R(13)** — All 26 invoice fields are required and validated before FBR submission
- **Rule 150XC** — Offline invoices must be uploaded within 24 hours; 20-hour warning is flagged automatically
- **Rule 150R(11)** — QR code (Version 2, 1×1 inch) is generated on the invoice PDF from the FBR Invoice Number
- Tokens are encrypted at rest using AES-256-GCM — never stored or returned as plaintext
