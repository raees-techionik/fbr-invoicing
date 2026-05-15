#!/usr/bin/env bash
# FBR Backend — Integration Test Suite
# Run from project root with: bash test-api.sh
# Requires: server running on localhost:3000 (npm run dev)

BASE="http://localhost:3000"
PASS=0
FAIL=0
TODAY=$(date +%Y-%m-%d)

# ─── Colours (CG/CR/CB/CX — avoids collision with response variable R) ────────
if [ -t 1 ]; then
  CG="\033[0;32m"; CR="\033[0;31m"; CB="\033[1m"; CX="\033[0m"
else
  CG=""; CR=""; CB=""; CX=""
fi

section() { echo ""; echo -e "${CB}══ $1 ══${CX}"; }
pass()    { PASS=$((PASS+1)); echo -e "  ${CG}[PASS]${CX} $1"; }
fail()    { FAIL=$((FAIL+1)); echo -e "  ${CR}[FAIL]${CX} $1"; [ -n "${2:-}" ] && echo "         └─ ${2:0:200}"; }

# ─── HTTP helpers ─────────────────────────────────────────────────────────────
H="Content-Type: application/json"
get()    { curl -s "$BASE$1"; }
post()   { curl -s -X POST  -H "$H" -d "$2" "$BASE$1"; }
put()    { curl -s -X PUT   -H "$H" -d "$2" "$BASE$1"; }
patch()  { curl -s -X PATCH -H "$H" -d "$2" "$BASE$1"; }
del()    { curl -s -X DELETE "$BASE$1"; }
gstatus(){ curl -s -o /dev/null -w "%{http_code}" "$BASE$1"; }
pstatus(){ curl -s -o /dev/null -w "%{http_code}" -X POST -H "$H" -d "$2" "$BASE$1"; }

# ok "label" "response_body" "grep_pattern"
ok() {
  if echo "$2" | grep -qE "$3"; then pass "$1"
  else fail "$1" "$2"
  fi
}

# http "label" "url" "expected_http_status"
http() {
  local s; s=$(gstatus "$2")
  [ "$s" = "$3" ] && pass "$1 (HTTP $s)" || fail "$1" "expected HTTP $3, got $s"
}

# Extract first UUID-like id from a JSON response
extract_id() { echo "$1" | grep -oE '"id":"[^"]+"' | head -1 | sed 's/"id":"//;s/"//g'; }

# ─── Shared invoice payload ────────────────────────────────────────────────────
INVOICE='{"invoiceType":"Sale Invoice","sellerNTNCNIC":"0788762","sellerBusinessName":"Test Seller","sellerProvince":"7","sellerAddress":"123 Lahore","buyerNTNCNIC":"0123456","buyerBusinessName":"Test Buyer","buyerProvince":"7","buyerAddress":"456 Lahore","buyerRegistrationType":"Registered","items":[{"hsCode":"8432.1010","productDescription":"Test Goods","rate":"18%","uoM":"KG","quantity":10,"valueSalesExcludingST":100000,"salesTaxApplicable":18000,"furtherTax":0,"extraTax":"","fedPayable":0,"discount":0,"totalValues":118000,"fixedNotifiedValueOrRetailPrice":0,"salesTaxWithheldAtSource":0,"saleType":"Goods at standard rate (default)","sroScheduleNo":"","sroItemSerialNo":""}]}'

# ─── Prerequisite ─────────────────────────────────────────────────────────────
echo -e "${CB}FBR Backend — Integration Test Suite${CX}"
echo "Server: $BASE  |  Date: $TODAY"
echo ""

S=$(gstatus "/health")
if [ "$S" != "200" ]; then
  echo -e "${CR}Server not reachable at $BASE (HTTP $S). Start it with: npm run dev${CX}"
  exit 1
fi
echo -e "${CG}Server is up ✓${CX}"

# =============================================================================
section "TASK A — Reference API Layer"

# A1–A6: simple collection endpoints
ok "A1  GET /reference/provinces"          "$(get /api/fbr/reference/provinces)"          "PUNJAB|stateProvinceDesc"
ok "A2  GET /reference/document-types"     "$(get /api/fbr/reference/document-types)"     "Sale Invoice|docDescription"
ok "A3  GET /reference/hs-codes"           "$(get /api/fbr/reference/hs-codes)"           "hS_CODE|hsCode|HS_CODE"
ok "A4  GET /reference/uoms"               "$(get /api/fbr/reference/uoms)"               "KG|uoM_ID|description"
ok "A5  GET /reference/sro-item-codes"     "$(get /api/fbr/reference/sro-item-codes)"     "srO_ITEM_ID|id"
ok "A6  GET /reference/transaction-types"  "$(get /api/fbr/reference/transaction-types)"  "standard rate|transactioN_DESC"

# A7–A12: parameterised endpoints
ok "A7  GET /reference/sro-schedules"      "$(get "/api/fbr/reference/sro-schedules?rate_id=734&date=$TODAY&origination_supplier=0788762")"     "srO_ID|id"
ok "A8  GET /reference/tax-rates"          "$(get "/api/fbr/reference/tax-rates?transTypeId=75&date=$TODAY&originationSupplier=0788762")"        "ratE_ID|id"
ok "A9  GET /reference/hs-uom"             "$(get "/api/fbr/reference/hs-uom?hs_code=8432.1010&annexure_id=75")"                                "uoM_ID|id"
ok "A10 GET /reference/sro-items"          "$(get "/api/fbr/reference/sro-items?date=$TODAY&sro_id=7")"                                          "srO_ITEM_ID|id"
ok "A11 GET /reference/statl"              "$(get "/api/fbr/reference/statl?regno=0788762&date=$TODAY")"                                         "status|isActive"
ok "A12 GET /reference/registration-type"  "$(get "/api/fbr/reference/registration-type?Registration_No=0788762")"                              "REGISTRATION_TYPE|registrationType"

# A13: cache — forceRefresh=true busts cache on first call, second call hits cache
R1=$(get /api/fbr/reference/provinces?forceRefresh=true)
R2=$(get /api/fbr/reference/provinces)
ok "A13 First call cacheHit false"  "$R1" '"cacheHit":false'
ok "A13 Second call cacheHit true"  "$R2" '"cacheHit":true'

# A13: bootstrap fetches all six reference datasets in one call
ok "A13 GET /reference/bootstrap"  "$(get /api/fbr/reference/bootstrap)"  '"provinces".*"documentTypes"'

# =============================================================================
section "TASK B — Invoice Submission API"

# B3: formatter produces valid FBR payload shape
ok "B3  POST /invoices/format — invoiceType present"  "$(post /api/fbr/invoices/format "$INVOICE")"  '"invoiceType"'
ok "B3  Formatted payload has items array"            "$(post /api/fbr/invoices/format "$INVOICE")"  '"items"'

# B9: sandbox environment injects scenarioId automatically
ok "B9  scenarioId injected in sandbox payload"  "$(post /api/fbr/invoices/format "$INVOICE")"  '"scenarioId"'

# B6, B7: validate endpoint, statusCode 00 = valid
R=$(post /api/fbr/invoices/validate "$INVOICE")
ok "B6  POST /invoices/validate returns result"  "$R"  '"isValid"'
ok "B7  Valid invoice statusCode is 00"          "$R"  '"statusCode":"00"'
ok "B7  isValid true for valid invoice"          "$R"  '"isValid":true'

# B4, B5: submit returns FBR invoice number
R=$(post /api/fbr/invoices/submit "$INVOICE")
ok "B4  POST /invoices/submit succeeds"       "$R"  '"isValid":true'
ok "B5  FBR invoice number returned"          "$R"  '"invoiceNumber":"[0-9]'
ok "B5  printData block present"              "$R"  '"printData"'
ok "B5  Per-item invoice numbers in response" "$R"  '"itemInvoiceNumbers"'

# B8: mock invalid response surfaces error code and message
INV_BODY='{"invoice":'"$INVOICE"',"settings":{"mockStatus":"invalid"}}'
R=$(post /api/fbr/invoices/validate "$INV_BODY")
ok "B8  Mock invalid — statusCode 01"     "$R"  '"statusCode":"01"'
ok "B8  Mock invalid — isValid false"     "$R"  '"isValid":false'
ok "B8  Mock invalid — errorCode present" "$R"  '"errorCode"'

# B10: debit note without invoiceRefNo → 400
S=$(pstatus /api/fbr/invoices/format '{"invoiceType":"Debit Note","items":[{"hsCode":"8432.1010","productDescription":"x","rate":"18%","uoM":"KG","quantity":1,"valueSalesExcludingST":1000,"salesTaxApplicable":180,"saleType":"Goods at standard rate (default)"}]}')
[ "$S" = "400" ] && pass "B10 Debit note without invoiceRefNo → HTTP 400" || fail "B10 Debit note missing invoiceRefNo" "expected 400, got $S"

# B10: reference invoice lookup (mock)
ok "B10 GET /invoices/reference-lookup"  "$(get "/api/fbr/invoices/reference-lookup?invoiceRefNo=TEST-INV-001")"  '"found"'

# B11: useMock=false with no token stored → 401
S=$(pstatus /api/fbr/invoices/submit '{"invoice":'"$INVOICE"',"settings":{"useMock":false}}')
[ "$S" = "401" ] && pass "B11 No token + mock=false → HTTP 401" || fail "B11 Missing token enforcement" "expected 401, got $S"

# =============================================================================
section "TASK C — Error Handling Layer"

INV_BODY='{"invoice":'"$INVOICE"',"settings":{"mockStatus":"invalid"}}'
R=$(post /api/fbr/invoices/validate "$INV_BODY")

# C1, C2: error code lookup table maps to field + user message
ok "C1  Error has field mapping"         "$R"  '"field"'
ok "C1  Error has user-friendly message" "$R"  '"message"'

# C4: header-level errors surface in headerErrors array
ok "C4  headerErrors array present"  "$R"  '"headerErrors"'

# C5, C6: item-level errors in itemResponses with per-item statusCode
ok "C5  itemResponses array present"       "$R"  '"itemResponses"'
ok "C6  Item-level statusCode present"     "$R"  '"statusCode"'
ok "C6  First item error surfaced"         "$R"  '"itemResponses":\[.*"statusCode":"01"'

# C8: audit log written when errors occur
sleep 1
if [ -f ".data/fbr-error-audit.log" ]; then
  pass "C8  Error audit log file exists"
  LAST=$(tail -1 .data/fbr-error-audit.log)
  ok "C8  Audit log entry has timestamp"       "$LAST"  '"timestamp"'
  ok "C8  Audit log entry has invoiceSnapshot" "$LAST"  '"invoiceSnapshot"'
  ok "C8  Audit log entry has FBR error code"  "$LAST"  '"errorCode"'
else
  fail "C8  Error audit log not found" ".data/fbr-error-audit.log missing"
fi

# =============================================================================
section "TASK E — Offline Queue Mechanism"

# E3: enqueue offline invoice
R=$(post /api/fbr/offline-queue '{"invoice":'"$INVOICE"'}')
ok  "E3  POST /offline-queue — enqueue"      "$R"  '"status":"OFFLINE"'
ok  "E3  Queued record has id"               "$R"  '"id"'
QUEUE_ID=$(extract_id "$R")

# E8: 24h timing fields present on queued record
ok  "E8  uploadDeadlineAt present"   "$R"  '"uploadDeadlineAt"'
ok  "E8  warningAt present"          "$R"  '"warningAt"'
ok  "E8  hoursQueued present"        "$R"  '"hoursQueued"'

# E9: list and summary
ok  "E9  GET /offline-queue — list"      "$(get /api/fbr/offline-queue)"          '"status"'
R_SUM=$(get /api/fbr/offline-queue/summary)
ok  "E9  GET /offline-queue/summary"     "$R_SUM"  '"offline"'
ok  "E9  Summary has submitted count"    "$R_SUM"  '"submitted"'
ok  "E9  Summary has uploadFailed count" "$R_SUM"  '"uploadFailed"'

# E5, E6: process queue → item moves to SUBMITTED
R=$(post /api/fbr/offline-queue/process '{}')
ok  "E5  POST /offline-queue/process runs"       "$R"  '"processed"'
ok  "E6  Processed count > 0"                    "$R"  '"processed":[1-9]'
ok  "E6  Submitted invoice has SUBMITTED status" "$R"  '"SUBMITTED"'

# E7: retry endpoint
if [ -n "$QUEUE_ID" ]; then
  R2=$(post /api/fbr/offline-queue/process '{"retryFailed":true}')
  ok "E7  Retry failed queue items endpoint works"  "$R2"  '"processed"'
fi

# =============================================================================
section "TASK F — Invoice Dashboard"

# F11: seed mock data
R=$(post /api/fbr/dashboard/seed-mock '{}')
ok "F11 POST /dashboard/seed-mock"  "$R"  '"created"|"skipped"'

# F1: summary header
R=$(get /api/fbr/dashboard/summary)
ok "F1  GET /dashboard/summary — totalInvoices"     "$R"  '"totalInvoices"'
ok "F1  Summary has totalSaleInvoices"              "$R"  '"totalSaleInvoices"'
ok "F1  Summary has totalDebitNotes"                "$R"  '"totalDebitNotes"'
ok "F1  Summary has totalAmountPkr"                 "$R"  '"totalAmountPkr"'

# F2: date range filter
ok "F2  Date range filter (dateFrom/dateTo)"  "$(get "/api/fbr/dashboard/invoices?dateFrom=2026-01-01&dateTo=2026-12-31")"  '"data"'

# F3–F6: chart data for all periods
ok "F3  Charts — daily"      "$(get /api/fbr/dashboard/charts?period=daily)"      '"daily"'
ok "F4  Charts — monthly"    "$(get /api/fbr/dashboard/charts?period=monthly)"    '"monthly"'
ok "F5  Charts — quarterly"  "$(get /api/fbr/dashboard/charts?period=quarterly)"  '"quarterly"'
ok "F6  Charts — yearly"     "$(get /api/fbr/dashboard/charts?period=yearly)"     '"yearly"'

# F7: invoice type toggle
ok "F7  Filter by Sale Invoice"  "$(get "/api/fbr/dashboard/invoices?invoiceType=Sale+Invoice")"  '"data"'
ok "F7  Filter by Debit Note"    "$(get "/api/fbr/dashboard/invoices?invoiceType=Debit+Note")"    '"data"'

# F8: search
ok "F8  Search by buyer name"         "$(get "/api/fbr/dashboard/invoices?search=Demo")"  '"data"'
ok "F8  Search by FBR invoice number" "$(get "/api/fbr/dashboard/invoices?search=0000")"  '"data"'

# F9: list columns and claim toggle
R=$(get /api/fbr/dashboard/invoices)
ok "F9  List has fbrInvoiceNumber"  "$R"  '"fbrInvoiceNumber"|"fbr_invoice_number"'
ok "F9  List has invoiceDate"       "$R"  '"invoiceDate"|"invoice_date"'
ok "F9  List has status"            "$R"  '"status"'
ok "F9  List has claimed"           "$R"  '"claimed"'
ok "F9  List has amountPkr"         "$R"  '"amountPkr"|"amount_pkr"'
INV_ID=$(extract_id "$R")
if [ -n "$INV_ID" ]; then
  ok "F9  PATCH invoices/:id/claimed → claimed:true"  "$(patch "/api/fbr/dashboard/invoices/$INV_ID/claimed" '{"claimed":true}')"  '"claimed":true'
fi

# =============================================================================
section "TASK G — HS Code Mapping"

# G2: HS code search suggestions
ok "G2  HS search with query"    "$(get "/api/fbr/product-mappings/hs-search?query=8432")"  '"hsCode"|"hS_CODE"'
ok "G2  HS search without query" "$(get /api/fbr/product-mappings/hs-search)"               '"data"|"source"'

# G3, G4: resolve HS fields auto-fills rate and UOM
R=$(get "/api/fbr/product-mappings/resolve?hsCode=8432.1010")
ok "G3  Resolve returns hsCode"        "$R"  '"hsCode"'
ok "G3  Resolve returns saleType"      "$R"  '"saleType"'
ok "G4  Resolve returns salesTaxRate"  "$R"  '"salesTaxRate"'
ok "G4  Resolve returns unitOfMeasurement" "$R"  '"unitOfMeasurement"'

# G1, G5: CRUD + HS code validation on save
PM='{"productName":"Test Widget","hsCode":"8432.1010","hsDescription":"Machinery","salesTaxRate":18,"unitOfMeasurement":"KG","saleType":"Goods at standard rate (default)","furtherTaxApplicable":false,"extraTaxApplicable":false}'
R=$(post /api/fbr/product-mappings "$PM")
ok "G1  POST /product-mappings — create"  "$R"  '"id"'
ok "G1  Created record has productName"   "$R"  '"productName"'
PM_ID=$(extract_id "$R")

ok "G1  GET /product-mappings — list"  "$(get /api/fbr/product-mappings)"  '"id"|"data"'

if [ -n "$PM_ID" ]; then
  ok "G1  GET /product-mappings/:id"  "$(get "/api/fbr/product-mappings/$PM_ID")"  '"productName"'

  # G6: invoiceFields bridge present in response
  ok "G6  invoiceFields bridge in response"  "$(get "/api/fbr/product-mappings/$PM_ID")"  '"invoiceFields"'

  ok "G1  PUT /product-mappings/:id update"  \
    "$(put "/api/fbr/product-mappings/$PM_ID" '{"productName":"Updated Widget","hsCode":"8432.1010","unitOfMeasurement":"KG","saleType":"Goods at standard rate (default)","furtherTaxApplicable":false,"extraTaxApplicable":false}')"  \
    '"Updated Widget"'

  ok "G1  DELETE /product-mappings/:id"  "$(del "/api/fbr/product-mappings/$PM_ID")"  '"deleted":true'
fi

# G5: invalid HS code rejected before save
S=$(pstatus /api/fbr/product-mappings '{"productName":"Bad Product","hsCode":"INVALID.9999","unitOfMeasurement":"KG","saleType":"Goods at standard rate (default)","furtherTaxApplicable":false,"extraTaxApplicable":false}')
[ "$S" = "400" ] && pass "G5  Invalid HS code → HTTP 400" || fail "G5  Invalid HS code should be rejected" "expected 400, got $S"

# =============================================================================
section "TASK H — Settings & Token Management"

# H2, H3: get settings — tokens masked, status present
R=$(get /api/fbr/settings)
ok "H2  GET /api/fbr/settings returns environment"  "$R"  '"environment"'
ok "H2  Token shown as masked (not plain text)"     "$R"  '"masked"'
ok "H3  tokenStatus block present"                  "$R"  '"tokenStatus"'
ok "H3  tokenStatus has active sub-key"             "$R"  '"active"'

# H4: environment switcher
R=$(put /api/fbr/settings '{"environment":"production"}')
ok "H4  Switch to production"  "$R"  '"environment":"production"'
R=$(put /api/fbr/settings '{"environment":"sandbox"}')
ok "H4  Switch back to sandbox" "$R"  '"environment":"sandbox"'

# H2: store a token, verify it is encrypted (plain value must not appear in response)
R=$(put /api/fbr/settings '{"sandboxToken":"super-secret-token-xyz"}')
ok "H2  Token storage — configured:true"  "$R"  '"configured":true'
if echo "$R" | grep -q '"super-secret-token-xyz"'; then
  fail "H2  Token must not appear plain text in response" "$R"
else
  pass "H2  Token is encrypted — plain value not visible in response"
fi

# H3: token status endpoint
ok "H3  GET /settings/token-status"  "$(get /api/fbr/settings/token-status)"  '"status"'

# H5: outbound IP
R=$(get /api/fbr/settings/outbound-ip)
ok "H5  GET /settings/outbound-ip"        "$R"  '"publicIp"'
ok "H5  localAddresses array present"     "$R"  '"localAddresses"'

# =============================================================================
section "TASK I — Sandbox Testing Suite"

# I8: run all 9 ready scenarios
R=$(post /api/fbr/sandbox/run '{}')
ok "I8  POST /sandbox/run — processed 9"     "$R"  '"processed":9'
ok "I8  All 9 scenarios passed"              "$R"  '"passed":9'

# I8: single scenario run
ok "I8  POST /sandbox/run/SN002 — single run"  "$(post /api/fbr/sandbox/run/SN002 '{}')"  '"passed":true'

# I8: submit mode generates FBR invoice number
ok "I8  Submit mode returns invoiceNumber"  "$(post /api/fbr/sandbox/run/SN001 '{"operation":"submit"}')"  '"invoiceNumber":"[0-9]'

# I7: placeholder guard
S=$(pstatus /api/fbr/sandbox/run/SN003 '{}')
[ "$S" = "400" ] && pass "I7  Placeholder scenario blocked → HTTP 400" || fail "I7  Placeholder should be blocked" "expected 400, got $S"

# I9: completion dashboard reflects all runs
R=$(get /api/fbr/sandbox/status)
ok "I9  pralProgress shows 9/9"       "$R"  '"9 / 9 ready scenarios passed"'
ok "I9  Placeholder count is 4"       "$R"  '"placeholder":4'
ok "I9  All ready scenarios passed"   "$R"  '"passed":9'

# Sandbox audit log
if [ -f ".data/sandbox-results.log" ]; then
  pass "I8  Sandbox results log file exists"
else
  fail "I8  Sandbox results log not found" ""
fi

# =============================================================================
echo ""
echo "══════════════════════════════════════════"
TOTAL=$((PASS+FAIL))
echo -e "${CB}Results: ${CG}$PASS passed${CX}  ${CR}$FAIL failed${CX}  /  $TOTAL total${CX}"
echo "══════════════════════════════════════════"
[ "$FAIL" -eq 0 ] && echo -e "${CG}All tests passed.${CX}" && exit 0
echo -e "${CR}Some tests failed — see [FAIL] lines above.${CX}"
exit 1
