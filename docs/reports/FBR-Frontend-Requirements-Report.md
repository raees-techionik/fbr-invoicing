# FBR Z — E-Invoicing Portal
## Frontend Requirements & Progress Report

**Prepared by:** Development Team
**Presented to:** Chief Executive Officer
**Date:** 12 May 2026
**Project Status:** Final Development Phase

---

## Executive Summary

FBR Z is a secure, web-based e-invoicing portal built to comply with Pakistan's Federal Board of Revenue (FBR) mandatory digital invoicing regulations under **Rule 150R**. The system enables businesses to generate and submit tax invoices directly to FBR in real time, maintain their customer and product records, and handle situations where internet is unavailable — ensuring no invoice is ever lost or missed.

The full backend engine — all business logic, data storage, FBR API integration, security, and compliance testing — is **complete and fully tested**. The remaining work is the user-facing interface (frontend), which is currently in its final phase.

This report outlines every screen the user will interact with, what it does, and its current status.

---

## Overall Progress at a Glance

| Module | Purpose | Status |
|---|---|---|
| Login & Password Recovery | Secure portal access | ✅ Complete |
| Dashboard | Business overview and invoice summary | 🔄 In Progress |
| Create Invoice | Submit invoices to FBR in real time | 🔄 In Progress |
| Invoice History | View, search, and download past invoices | 🔄 In Progress |
| Bulk Invoice Upload | Submit multiple invoices via Excel upload | 🔄 In Progress |
| Offline Queue | Manage invoices queued during connectivity issues | 🔄 In Progress |
| Company Profile | Business identity used on every invoice | ✅ Complete |
| Customers | Buyer directory for quick invoice fill | ✅ Complete |
| Products | Product catalogue with tax code mapping | ✅ Complete |
| Staff Members | Internal staff directory | ✅ Complete |
| Services | Service catalogue for service invoices | ✅ Complete |
| FBR Sandbox Testing | Compliance certification required by PRAL | 🔄 In Progress |
| Settings | FBR token and environment configuration | 🔄 In Progress |
| Support | Help and contact page | 📋 Planned |

---

## Feature Breakdown

---

### 1. Login & Password Recovery
**Status: ✅ Complete**

The entry point to the portal. Users sign in with their registered email and password. A three-step password recovery flow is available for users who forget their credentials.

Security has been hardened — the portal cannot be accessed without valid credentials. All data remains protected behind authenticated access.

---

### 2. Dashboard
**Status: 🔄 In Progress**

The first screen a user sees after logging in. Designed to give business owners and accountants an immediate overview of their invoicing activity without needing to open individual records.

**What it displays:**
- Total number of invoices submitted and total revenue in PKR
- Number of active customers and products in the system
- A chart showing invoice activity over time (daily or monthly view)
- A table of recent invoices with buyer name, amount, and submission status
- Top customers ranked by invoice volume
- Top products by usage frequency

---

### 3. Create Invoice
**Status: 🔄 In Progress**

The core screen of the portal. This is where users create and submit invoices directly to FBR in real time.

**How it works:**
- Seller information is automatically pre-filled from the Company Profile — no manual entry needed
- Buyer information can be pulled from the saved Customer directory with one click
- Products can be selected from the catalogue, which auto-fills the HS code, tax rate, and unit of measure
- Multiple line items can be added to a single invoice
- On submission, FBR validates the invoice and returns a unique FBR Invoice Number as confirmation
- If FBR returns an error, it is displayed clearly on screen with the exact field that needs correction
- A PDF copy of the invoice can be downloaded immediately after successful submission

**Offline protection:**
If the internet is unavailable at the time of submission, the invoice is automatically saved to the Offline Queue and submitted the next time connectivity is restored — ensuring no invoice is lost.

---

### 4. Invoice History
**Status: 🔄 In Progress**

A complete record of all invoices ever submitted through the portal. Users can search, filter, view, and download invoices.

**Capabilities:**
- Search by buyer name, FBR invoice number, invoice reference, or date
- Filter and sort by status, date, or amount
- View full invoice details in a side panel
- Download individual invoices as PDF
- Download multiple invoices as a single ZIP file
- Delete records from the local system (does not affect FBR records)

---

### 5. Bulk Invoice Upload
**Status: 🔄 In Progress**

For businesses that process large volumes of invoices, this feature allows uploading an Excel file containing multiple invoices at once. The system parses the file, shows a full preview before submission, and processes all invoices in a single batch.

This eliminates the need to create invoices one by one during high-volume periods.

---

### 6. Offline Queue
**Status: 🔄 In Progress**

A dedicated management screen for invoices that were saved when the internet was unavailable and are waiting to be submitted to FBR.

**Why this matters:**
Under FBR Rule 150XC, offline invoices must be submitted to FBR within **24 hours** of issuance. Missing this window is a compliance violation. This screen ensures the business is always aware of pending submissions and approaching deadlines.

**What it shows:**
- A live count of pending, uploaded, and failed queue entries
- Clear visual warnings when an invoice is approaching the 24-hour deadline
- Red alerts when the deadline has already passed
- The ability to manually trigger submission or retry failed entries
- An auto-refresh every 15 seconds so the screen always shows current status

---

### 7. Company Profile
**Status: ✅ Complete**

The business's own identity — legal name, NTN/CNIC, business type, province, address, contact details, and company logo. This information is stored once and automatically applied to every invoice created in the system, eliminating repetitive data entry and ensuring consistency across all submissions.

---

### 8. Customers
**Status: ✅ Complete**

A searchable directory of the business's buyers. Saved customers can be selected directly from the invoice creation form, automatically filling all required buyer fields. This reduces data entry time and prevents errors in buyer information on submitted invoices.

---

### 9. Products
**Status: ✅ Complete**

A catalogue of the business's goods with their FBR-required Harmonized System (HS) codes, applicable tax rates, and units of measure. Selecting a product from within an invoice auto-fills all related fields, ensuring compliance and saving time.

---

### 10. Staff Members
**Status: ✅ Complete**

An internal directory of staff associated with the business, including designation, CNIC, and contact details. Maintained for internal record-keeping purposes.

---

### 11. Services
**Status: ✅ Complete**

A catalogue of services offered by the business, with applicable tax rates and units. Used in service-type invoices alongside the product catalogue.

---

### 12. FBR Sandbox Testing
**Status: 🔄 In Progress — All Required Tests Passing**

Before FBR issues a live production token, every business must pass a set of mandatory compliance test scenarios defined by PRAL (Pakistan Revenue Automation Ltd). This screen is the control panel for running, monitoring, and reviewing those tests.

**The 9 required scenarios cover:**

| Scenario | Coverage |
|---|---|
| SN001 | Standard rate goods — registered buyer |
| SN002 | Standard rate goods — unregistered buyer |
| SN005 | Goods at reduced SRO rate |
| SN006 | Exempt goods (zero tax) |
| SN007 | Zero-rated goods |
| SN008 | Third Schedule goods (fixed retail price) |
| SN017 | Federal Excise Duty on goods |
| SN018 | Federal Excise Duty on services |
| SN019 | Standard services invoice |

**Current result: All 9 scenarios passing. The portal is eligible to request a production token from PRAL.**

Once the sandbox token is received from PRAL, these scenarios will be re-run against the live FBR test environment to complete the certification process.

---

### 13. Settings
**Status: 🔄 In Progress**

The administrative configuration screen. Used to set up and manage the FBR API token for the sandbox and production environments, switch between environments, and verify that the token is active and accepted by FBR.

This screen is where the sandbox token from PRAL will be entered when received, and where the switch to production will be made upon approval.

---

### 14. Support
**Status: 📋 Planned**

A help and contact page. Content and format to be confirmed.

---

## What Happens Next

### Immediate (Days 1–5)
The 5 screens the client will interact with during the sandbox review are being rebuilt with a modern, polished interface:

| Priority | Screen | Reason |
|---|---|---|
| 1 | Login | First impression |
| 2 | Dashboard | Overview and confidence |
| 3 | Create Invoice | Core workflow |
| 4 | Sandbox Testing | Required for PRAL certification |
| 5 | Settings | Token entry and environment control |

### Before Going Live

| Item | Detail |
|---|---|
| FBR Sandbox Token | To be requested from PRAL — all 9 scenarios are already passing |
| Production Token | Issued by FBR after full sandbox approval |
| Invoice PDF Review | Confirm all Rule 150R mandatory fields appear correctly on printed invoices |
| Production Deployment | Server setup, domain, security configuration |

---

## Key Compliance Notes

| Rule | Requirement | Status |
|---|---|---|
| Rule 150R | 26 mandatory fields on every invoice | Implemented in Create Invoice |
| Rule 150XC | Offline invoices must be uploaded within 24 hours | Implemented in Offline Queue |
| PRAL Sandbox | 9 scenarios must pass before production token is issued | All 9 passing |

---

## Summary

The FBR Z portal is fully functional at the backend level — every business process, compliance rule, and FBR API integration is built and tested. The frontend is in its final development phase, with the client-facing screens for the sandbox review on track to be delivered within the agreed 3–5 day window.

The system is ready for the client to begin sandbox testing as soon as the PRAL token is received.

---

*Report prepared by the FBR Z Development Team — 12 May 2026*
*For questions or clarifications, please contact the project lead.*
