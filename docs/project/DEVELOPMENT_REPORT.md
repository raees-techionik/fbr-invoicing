# FBR Z — E-Invoicing Portal
## Development Report

**Prepared by:** Development Team
**Reviewed by:** Pending
**Date:** 2026-05-12
**Project Duration:** ~10 days (2026-05-02 to 2026-05-12)

---

## 1. Project Overview

FBR Z is a web-based e-invoicing portal built for compliance with Pakistan's Federal Board of Revenue (FBR) under **Rule 150R**. It enables businesses to create, validate, and submit invoices directly to the FBR API, manage an offline queue for submissions during connectivity issues, and run the mandatory PRAL sandbox scenarios required before production approval.

**Stack:** React 19 (frontend) · TypeScript / Express (backend) · PostgreSQL via Prisma (Neon hosted)

---

## 2. Project State at Handover

The project was received as two disconnected shells with no working functionality:

- **Frontend** (handed over 2026-01-21): A scaffolded React app with placeholder account pages and no API integration.
- **Backend** (handed over 2026-04-13): Bare Express setup with only `prisma.ts`, `jwt.ts`, `cache.ts`, and an unused auth middleware. No routes, no services, no database models.

No features were functional. No data was persisted. No authentication existed. No tests existed.

---

## 3. Work Completed

### 3.1 Database Design & Migration

Designed and implemented the full PostgreSQL schema from scratch using Prisma:

| Model | Purpose |
|---|---|
| `User`, `Company`, `UserCompanyMembership` | Multi-tenant authentication |
| `CompanyProfile` | Singleton company identity (name, NTN, logo, province) |
| `Customer`, `StaffMember` | CRM data |
| `Product`, `ProductMapping` | Product catalogue with invoice autofill |
| `Invoice`, `InvoiceItem` | Full invoice persistence with line items |
| `OfflineQueue` | Offline submission queue with deadline tracking |
| `Token` | FBR environment tokens (sandbox / production) |
| `ReferenceCache` | FBR reference API response cache with TTL |

---

### 3.2 Authentication System

Built from scratch. Full JWT-based authentication:

- User registration with automatic personal workspace creation
- Login with signed JWT (7-day expiry)
- Protected route middleware (`requireAuth`) applied to all business endpoints
- 3-step password reset flow: request code → verify code → set new password
- Frontend login page hardened — removed dev bypass buttons that allowed unauthenticated dashboard access

---

### 3.3 Core Data Management

**Customers**
Full CRUD API backed by PostgreSQL. Previously stored in volatile in-memory cache — data was lost on every server restart. Migrated to persistent `Customer` table.

**Staff Members**
Same migration from cache to PostgreSQL (`StaffMember` table). Full CRUD with search and pagination.

**Company Profile**
Built entirely from scratch. Singleton upsert pattern — one profile per deployment. Supports base64 logo upload, province selection, NTN/CNIC, contact details.

**Products**
Full CRUD with HS code validation. Added `/api/products/:id/autofill` endpoint that returns invoice-ready fields directly, reducing frontend mapping logic.

**App Services**
Full CRUD for service line items used in service-type invoices.

---

### 3.4 Invoice System

Previously invoices were submitted to FBR and not saved anywhere. Rebuilt end-to-end:

- Every submission persists a full `Invoice` + `InvoiceItem` record to the database
- Failed submissions save with `FAILED` status and a complete error audit in `fbrRawResponse` (operation, FBR status code, mapped error code, invoice snapshot, raw FBR response, timestamp)
- FBR error codes mapped through a dedicated `fbr-error.service.ts` with human-readable messages
- Invoice list API with search, filtering, and pagination
- Invoice detail endpoint returning full record including all line items
- Dashboard summary: total invoices, total amount (PKR), submitted/failed/claimed counts
- Daily chart data for invoice activity visualization

---

### 3.5 Offline Queue

Built from scratch to handle FBR API unavailability:

- Invoice payloads queued locally when FBR is unreachable
- **20-hour warning** threshold — flags entries approaching the deadline
- **24-hour deadline** — marks entries as expired if not uploaded in time
- Automatic background processor runs every 2 minutes to retry pending entries
- Manual process and per-entry retry endpoints
- Failed entries tracked separately with retry count cap (max 3 attempts); invoice marked `FAILED` after cap
- Full status summary (pending, uploaded, failed, warning count, expired count)

---

### 3.6 FBR Sandbox Testing Infrastructure

Required by PRAL before a production token is issued. Built the complete sandbox runner:

**9 required scenarios implemented:**

| ID | Scenario |
|---|---|
| SN001 | Goods at Standard Rate — Registered Buyer |
| SN002 | Goods at Standard Rate — Unregistered Buyer |
| SN005 | Goods at Reduced Rate |
| SN006 | Exempt Goods |
| SN007 | Zero Rated Goods |
| SN008 | Third Schedule Goods |
| SN017 | FED in ST Mode — Goods |
| SN018 | FED in ST Mode — Services |
| SN019 | Services |

4 sector-specific scenarios (Steel, Textile, Telecom, Petroleum) held as placeholders pending confirmation of client business type.

**Current Status: All 9 required scenarios passing. Portal is eligible for production token.**

---

### 3.7 FBR Token & Settings Management

- Store sandbox and production tokens securely (masked in API responses)
- Switch active environment (sandbox / production)
- Toggle mock mode for internal testing without a live token
- Live token validation status per environment: `mock` / `active` / `invalid` / `error`

---

### 3.8 FBR Reference API Cache

FBR reference lookups (SRO schedules, sale type rates, HS UOMs, SRO items, STATL, registration type) are cached in `ReferenceCache` with configurable TTL. Prevents redundant live calls to FBR during invoice creation.

---

### 3.9 Backend Test Suite

Built from scratch. 11 automated integration tests running against a real database:

| Test | Coverage |
|---|---|
| Token save + status | Settings flow end-to-end |
| Invoice list / detail / dashboard | DB persistence, DTO shape, pagination |
| Failed submission audit | Error mapping, `fbrRawResponse` structure |
| Offline queue: failed + retry aliases | Queue state transitions |
| Offline queue: add | Payload and invoice persistence |
| Offline queue: full flow | Add → warn → process → upload |
| Offline queue: retry to failure | 3-attempt cap, invoice marked FAILED |
| Product autofill | Invoice-ready field mapping |
| Reference cache | All 6 reference endpoints + cache hit verification |
| Sandbox summary / results | Response shape contracts |
| Sandbox mocked run | Single + batch run, eligibility after all pass |

**Result: 11 / 11 passing.**

---

## 4. Security

| Issue | Status |
|---|---|
| All business endpoints publicly accessible (no auth) | Fixed — `requireAuth` applied to all routes |
| Frontend "Continue Without Login" button (dev bypass) | Removed |
| Fake token bypass via empty login form | Removed |
| Reset code exposed in API response (no email service yet) | Known — intentional for dev; must be replaced with email delivery before production |

---

## 5. Pending Before Production

1. **FBR Sandbox Token** — Obtain from PRAL to run live validation against real FBR API. Infrastructure is fully ready.
2. **Email Service** — Wire up SMTP/email provider for password reset codes (currently returned in API response for dev convenience).
3. **Invoice Print View** — Verify all Rule 150R required fields in PDF output; confirm QR code size and content.
4. **Environment Configuration** — Finalize `.env` for production DB, token security, and FBR API IP whitelisting.
5. **Deployment Checklist** — Production DB migration, secret rotation, CORS lockdown.

---

## 6. Delivery Summary

| Area | Status |
|---|---|
| Authentication (register, login, password reset) | Complete |
| Company Profile | Complete |
| Customers | Complete |
| Staff Members | Complete |
| Products | Complete |
| App Services | Complete |
| Invoice Submission & Persistence | Complete |
| Offline Queue with Deadline Management | Complete |
| FBR Sandbox — 9 Required Scenarios | Complete — all passing |
| FBR Token / Settings Management | Complete |
| FBR Reference API Cache | Complete |
| Backend Test Suite (11 tests) | Complete — 11/11 passing |
| Authentication Enforcement | Complete |
| Frontend Login Security | Complete |
| Live FBR API Testing (sandbox token) | Pending PRAL token |
| Email Service for Password Reset | Pending |
| Production Deployment | Pending |
