import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import techionikLogoSrc from '../Images/TechionikIcon.png';

// Software registration number issued/approved for the DI integration.
const SOFTWARE_REG_NO = 'TECHIONIK-FBR-001';
const OFFLINE_STATUSES = new Set(['OFFLINE', 'UPLOAD_FAILED']);
const QR_SIZE_PT = 72;
const BRAND_TEXT = 'Powered by Techionik';

const fmt = (n) => (parseFloat(n) || 0).toFixed(2);
const safe = (v, fallback = '-') => (v != null && String(v).trim() !== '') ? String(v) : fallback;
const first = (...values) => {
  for (const value of values) {
    if (value != null && String(value).trim() !== '') return value;
  }
  return '';
};
const money = (...values) => parseFloat(first(...values)) || 0;

async function buildQrDataUrl(text) {
  if (!text) return null;
  try {
    return await QRCode.toDataURL(text, {
      version: 2,
      width: 144,
      margin: 2,
      errorCorrectionLevel: 'M',
    });
  } catch {
    return null;
  }
}

function normaliseItem(item = {}) {
  return {
    hsCode: first(item.hsCode, item.hs_code),
    productDescription: first(item.productDescription, item.product_description),
    rate: first(item.rate, item.salesTaxRate, item.sales_tax_rate),
    uoM: first(item.uoM, item.uom, item.unitOfMeasurement, item.unit_of_measurement),
    quantity: money(item.quantity),
    totalValues: money(item.totalValues, item.total_values),
    valueSalesExcludingST: money(item.valueSalesExcludingST, item.value_sales_excluding_st),
    fixedNotifiedValueOrRetailPrice: money(
      item.fixedNotifiedValueOrRetailPrice,
      item.fixed_notified_value_or_retail_price
    ),
    salesTaxApplicable: money(item.salesTaxApplicable, item.sales_tax_applicable),
    salesTaxWithheldAtSource: money(item.salesTaxWithheldAtSource, item.sales_tax_withheld_at_source),
    extraTax: money(item.extraTax, item.extra_tax),
    furtherTax: money(item.furtherTax, item.further_tax),
    fedPayable: money(item.fedPayable, item.fed_payable),
    discount: money(item.discount),
    saleType: first(item.saleType, item.sale_type),
    sroScheduleNo: first(item.sroScheduleNo, item.sro_schedule_no),
    sroItemSerialNo: first(item.sroItemSerialNo, item.sro_item_serial_no),
  };
}

function deriveTaxPeriod(invoiceDate) {
  if (!invoiceDate) return '-';
  const d = new Date(invoiceDate);
  if (isNaN(d.getTime())) return '-';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${yyyy}`;
}

function normaliseRecord(record = {}) {
  const payload = record.payload || {};
  const status = String(record.status || '').toUpperCase();
  const items = Array.isArray(record.items)
    ? record.items
    : Array.isArray(payload.items)
      ? payload.items
      : [];

  const invoiceDate = first(record.invoiceDate, record.invoice_date, payload.invoiceDate);
  return {
    invoiceType: first(record.invoiceType, record.invoice_type, payload.invoiceType, 'Sales Tax Invoice'),
    invoiceDate,
    taxPeriod: deriveTaxPeriod(invoiceDate),
    invoiceRefNo: first(record.invoiceRefNo, record.invoice_ref_no, payload.invoiceRefNo),
    fbrInvoiceNumber: first(record.fbrInvoiceNumber, record.fbr_invoice_number),
    sellerBusinessName: first(record.sellerBusinessName, record.seller_business_name, payload.sellerBusinessName),
    sellerNTNCNIC: first(record.sellerNTNCNIC, record.seller_ntn_cnic, payload.sellerNTNCNIC),
    sellerProvince: first(record.sellerProvince, record.seller_province, payload.sellerProvince),
    sellerAddress: first(record.sellerAddress, record.seller_address, payload.sellerAddress),
    buyerBusinessName: first(record.buyerBusinessName, record.buyer_business_name, payload.buyerBusinessName),
    buyerNTNCNIC: first(record.buyerNTNCNIC, record.buyer_ntn_cnic, payload.buyerNTNCNIC),
    buyerProvince: first(record.buyerProvince, record.buyer_province, payload.buyerProvince),
    buyerAddress: first(record.buyerAddress, record.buyer_address, payload.buyerAddress),
    buyerRegistrationType: first(
      record.buyerRegistrationType,
      record.buyer_registration_type,
      payload.buyerRegistrationType
    ),
    status,
    amountPkr: money(record.amountPkr, record.amount_pkr),
    items: items.map(normaliseItem),
    isOffline: Boolean(record.isOffline || record.is_offline) || OFFLINE_STATUSES.has(status),
  };
}

export async function generateInvoicePdfFromForm(invoiceData, fbrInvoiceNumber = '', { isOffline = false } = {}) {
  return buildPdf(normaliseRecord({ ...invoiceData, fbrInvoiceNumber, isOffline }));
}

export async function generateInvoicePdfFromRecord(record) {
  return buildPdf(normaliseRecord(record));
}

function drawTechionikBrand(doc, PW, MR, MT) {
  const brandW = 106;
  const logoSize = 38;
  const centerX = PW - MR - brandW / 2;
  const logoY = MT - 10;

  doc.addImage(techionikLogoSrc, 'PNG', centerX - logoSize / 2, logoY, logoSize, logoSize);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text(BRAND_TEXT, centerX, logoY + logoSize + 11, { align: 'center' });
  doc.setTextColor(0, 0, 0);
}

async function buildPdf(data) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const PW = 595.28;
  const PH = 841.89;
  const ML = 36;
  const MR = 36;
  const MT = 40;
  const CW = PW - ML - MR;
  const pad = 5;
  let y = MT;

  const newPageIfNeeded = (needed = 20) => {
    if (y + needed > PH - 44) {
      doc.addPage();
      y = MT;
    }
  };

  drawTechionikBrand(doc, PW, MR, MT);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(safe(data.sellerBusinessName, 'Seller'), PW / 2, y, { align: 'center' });
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`NTN/CNIC: ${safe(data.sellerNTNCNIC)} | Province: ${safe(data.sellerProvince)}`, PW / 2, y, {
    align: 'center',
  });
  y += 13;

  if (data.sellerAddress) {
    doc.text(safe(data.sellerAddress), PW / 2, y, { align: 'center', maxWidth: CW });
    y += 13;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(safe(data.invoiceType, 'SALES TAX INVOICE').toUpperCase(), PW / 2, y, { align: 'center' });
  y += 8;
  doc.setLineWidth(1);
  doc.line(ML, y, PW - MR, y);
  y += 10;

  doc.setFontSize(8.5);
  y = drawMetaGrid(doc, y, ML, CW, [
    [
      ['Invoice Ref No:', safe(data.invoiceRefNo)],
      ['Invoice Date:', safe(data.invoiceDate)],
    ],
    [
      ['FBR Invoice No:', safe(data.fbrInvoiceNumber)],
      ['Tax Period:', safe(data.taxPeriod)],
    ],
    [
      ['Status:', safe(data.status)],
      ['Software Reg. No:', SOFTWARE_REG_NO],
    ],
  ]);
  y += 14;

  const halfW = (CW - 4) / 2;
  const sellerFields = [
    ['Name', safe(data.sellerBusinessName)],
    ['NTN/CNIC', safe(data.sellerNTNCNIC)],
    ['Province', safe(data.sellerProvince)],
    ['Address', safe(data.sellerAddress)],
  ];
  const buyerFields = [
    ['Name', safe(data.buyerBusinessName)],
    ['NTN/CNIC', safe(data.buyerNTNCNIC)],
    ['Province', safe(data.buyerProvince)],
    ['Reg. Type', safe(data.buyerRegistrationType)],
    ['Address', safe(data.buyerAddress)],
  ];
  const partyH = Math.max(
    96,
    estimatePartyHeight(doc, halfW, sellerFields),
    estimatePartyHeight(doc, halfW, buyerFields)
  );
  doc.setLineWidth(0.5);
  doc.rect(ML, y, halfW, partyH);
  doc.rect(ML + halfW + 4, y, halfW, partyH);

  writeParty(doc, ML, y, halfW, 'SUPPLIER (SELLER)', sellerFields);
  writeParty(doc, ML + halfW + 4, y, halfW, 'RECIPIENT (BUYER)', buyerFields);
  y += partyH + 10;

  const colDefs = [
    { header: 'Sr.', w: 22, align: 'center' },
    { header: 'HS Code', w: 54, align: 'center' },
    { header: 'Description', w: 105, align: 'left' },
    { header: 'UOM', w: 34, align: 'center' },
    { header: 'Qty', w: 30, align: 'right' },
    { header: 'Value Excl. ST', w: 58, align: 'right' },
    { header: 'Rate', w: 36, align: 'center' },
    { header: 'Sales Tax', w: 52, align: 'right' },
    { header: 'Further Tax', w: 48, align: 'right' },
    { header: 'FED', w: 39, align: 'right' },
    { header: 'Total', w: 49, align: 'right' },
  ];
  const rowH = 15;
  const detailRowH = 24;
  let totals = {
    valueExcl: 0,
    salesTax: 0,
    withheld: 0,
    extraTax: 0,
    furtherTax: 0,
    fed: 0,
    discount: 0,
    grand: 0,
  };

  newPageIfNeeded(rowH + 2);
  drawTableHeader(doc, ML, y, CW, rowH, colDefs, pad);
  y += rowH;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const items = data.items.length ? data.items : [normaliseItem({ productDescription: 'No line items available' })];

  items.forEach((item, index) => {
    const descLines = doc.splitTextToSize(safe(item.productDescription), colDefs[2].w - pad * 2);
    const thisH = Math.max(rowH, descLines.length * 9 + 6);
    newPageIfNeeded(thisH + detailRowH);

    doc.setLineWidth(0.3);
    doc.rect(ML, y, CW, thisH);

    const totalValue = item.totalValues || (
      item.valueSalesExcludingST +
      item.salesTaxApplicable +
      item.furtherTax +
      item.extraTax +
      item.fedPayable -
      item.discount
    );
    const cells = [
      String(index + 1),
      safe(item.hsCode),
      safe(item.productDescription),
      safe(item.uoM),
      fmt(item.quantity),
      fmt(item.valueSalesExcludingST),
      formatRate(item.rate),
      fmt(item.salesTaxApplicable),
      fmt(item.furtherTax),
      fmt(item.fedPayable),
      fmt(totalValue),
    ];

    let cx = ML;
    cells.forEach((txt, ci) => {
      const col = colDefs[ci];
      if (ci === 2) {
        doc.text(descLines, cx + pad, y + 10, { maxWidth: col.w - pad * 2 });
      } else {
        cellText(doc, txt, col, cx, y, thisH, pad);
      }
      cx += col.w;
    });

    totals.valueExcl += item.valueSalesExcludingST;
    totals.salesTax += item.salesTaxApplicable;
    totals.withheld += item.salesTaxWithheldAtSource;
    totals.extraTax += item.extraTax;
    totals.furtherTax += item.furtherTax;
    totals.fed += item.fedPayable;
    totals.discount += item.discount;
    totals.grand += totalValue;
    y += thisH;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setFillColor(250, 250, 250);
    doc.rect(ML, y, CW, detailRowH, 'F');
    doc.rect(ML, y, CW, detailRowH);
    const detailLine1 = [
      `Sale Type: ${safe(item.saleType)}`,
      `SRO Schedule: ${safe(item.sroScheduleNo)}`,
      `SRO Item Serial: ${safe(item.sroItemSerialNo)}`,
    ].join('   |   ');
    const detailLine2 = [
      `Fixed/Notified/Retail: ${fmt(item.fixedNotifiedValueOrRetailPrice)}`,
      `ST Withheld: ${fmt(item.salesTaxWithheldAtSource)}`,
      `Extra Tax: ${fmt(item.extraTax)}`,
      `Discount: ${fmt(item.discount)}`,
    ].join('   |   ');
    doc.text(detailLine1, ML + pad, y + 9, { maxWidth: CW - pad * 2 });
    doc.text(detailLine2, ML + pad, y + 19, { maxWidth: CW - pad * 2 });
    y += detailRowH;
  });

  newPageIfNeeded(rowH + 4);
  doc.setFillColor(242, 242, 242);
  doc.rect(ML, y, CW, rowH, 'F');
  doc.rect(ML, y, CW, rowH);
  doc.setFont('helvetica', 'bold');
  const totalCells = [
    '',
    '',
    'TOTAL',
    '',
    '',
    fmt(totals.valueExcl),
    '',
    fmt(totals.salesTax),
    fmt(totals.furtherTax),
    fmt(totals.fed),
    fmt(totals.grand),
  ];
  let cx = ML;
  totalCells.forEach((txt, ci) => {
    if (txt) cellText(doc, txt, colDefs[ci], cx, y, rowH, pad);
    cx += colDefs[ci].w;
  });
  y += rowH + 12;

  newPageIfNeeded(92);
  y = drawSummary(doc, y, PW - MR - 250, 250, [
    ['Total Value Excl. Sales Tax', `PKR ${fmt(totals.valueExcl)}`],
    ['Total Sales Tax', `PKR ${fmt(totals.salesTax)}`],
    ['Total Sales Tax Withheld', `PKR ${fmt(totals.withheld)}`],
    ['Total Extra Tax', `PKR ${fmt(totals.extraTax)}`],
    ['Total Further Tax', `PKR ${fmt(totals.furtherTax)}`],
    ['Total FED', `PKR ${fmt(totals.fed)}`],
    ['Total Discount', `PKR ${fmt(totals.discount)}`],
    ['Grand Total (PKR)', `PKR ${fmt(totals.grand || data.amountPkr)}`],
  ]);
  y += 14;

  const qrText = buildQrText(data, totals.grand || data.amountPkr);
  const qrDataUrl = await buildQrDataUrl(qrText);
  newPageIfNeeded(QR_SIZE_PT + 56);
  if (qrDataUrl) {
    doc.addImage(qrDataUrl, 'PNG', ML, y, QR_SIZE_PT, QR_SIZE_PT);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Scan to verify invoice', ML + QR_SIZE_PT / 2, y + QR_SIZE_PT + 9, { align: 'center' });
    doc.text(safe(data.fbrInvoiceNumber || data.invoiceRefNo), ML + QR_SIZE_PT + 12, y + 16, { maxWidth: 220 });
  }

  const sigY = y + QR_SIZE_PT + 26;
  newPageIfNeeded(48);
  doc.setLineWidth(0.5);
  doc.line(ML, sigY, ML + 140, sigY);
  doc.line(PW - MR - 140, sigY, PW - MR, sigY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Authorised Signatory', ML, sigY + 11);
  doc.text('Stamp', PW - MR, sigY + 11, { align: 'right' });
  y = sigY + 28;

  newPageIfNeeded(30);
  doc.setLineWidth(0.3);
  doc.line(ML, y, PW - MR, y);
  y += 9;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  doc.text(
    `Integrated with FBR Digital Invoicing System | Software Reg. No: ${SOFTWARE_REG_NO} | Printed: ${new Date().toLocaleDateString('en-PK')}`,
    PW / 2,
    y,
    { align: 'center', maxWidth: CW }
  );
  y += 10;
  doc.text(
    'This invoice has been generated/submitted through the Digital Invoicing System under Rule 150R of the Sales Tax Rules, 2006.',
    PW / 2,
    y,
    { align: 'center', maxWidth: CW }
  );
  doc.setTextColor(0, 0, 0);

  stampPages(doc, data, PW, PH, ML, MR, CW);
  return doc.output('blob');
}

function drawMetaGrid(doc, y, x, width, rows) {
  const gap = 12;
  const padY = 3;
  const minRowH = 16;
  const labelW = 82;

  rows.forEach((row) => {
    const cells = row.length === 1
      ? [{ field: row[0], x, width }]
      : row.map((field, index) => ({
          field,
          x: x + index * ((width - gap) / 2 + gap),
          width: (width - gap) / 2,
        }));

    const prepared = cells.map((cell) => {
      const [label, value] = cell.field;
      const valueW = Math.max(40, cell.width - labelW - 8);
      return {
        ...cell,
        label,
        lines: doc.splitTextToSize(safe(value), valueW),
        valueW,
      };
    });
    const rowH = Math.max(minRowH, ...prepared.map((cell) => cell.lines.length * 9 + padY * 2));

    prepared.forEach((cell) => {
      const baseline = y + padY + 8;
      doc.setFont('helvetica', 'bold');
      doc.text(cell.label, cell.x, baseline, { maxWidth: labelW - 2 });
      doc.setFont('helvetica', 'normal');
      doc.text(cell.lines, cell.x + labelW, baseline, { maxWidth: cell.valueW });
    });

    y += rowH;
  });

  return y;
}

function estimatePartyHeight(doc, width, fields) {
  const labelW = 58;
  const valueW = width - labelW - 12;
  return fields.reduce((height, [, value]) => {
    const lines = doc.splitTextToSize(safe(value), valueW);
    return height + Math.max(11, lines.length * 9);
  }, 27);
}

function writeParty(doc, x, y, width, title, fields) {
  const labelW = 58;
  const padX = 6;
  const valueX = x + padX + labelW;
  const valueW = width - labelW - padX * 2;
  let py = y + 12;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(title, x + 5, py);

  fields.forEach(([label, value]) => {
    const valueLines = doc.splitTextToSize(safe(value), valueW);
    py += 11;
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, x + padX, py, { maxWidth: labelW - 2 });
    doc.setFont('helvetica', 'normal');
    doc.text(valueLines, valueX, py, { maxWidth: valueW });
    py += Math.max(0, (valueLines.length - 1) * 9);
  });
}

function drawTableHeader(doc, x, y, width, height, colDefs, pad) {
  doc.setFillColor(215, 215, 215);
  doc.rect(x, y, width, height, 'F');
  doc.setLineWidth(0.4);
  doc.rect(x, y, width, height);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  let cx = x;
  colDefs.forEach((col) => {
    cellText(doc, col.header, col, cx, y, height, pad);
    cx += col.w;
  });
}

function cellText(doc, txt, col, cx, y, rowH, pad) {
  const x = col.align === 'right'
    ? cx + col.w - pad
    : col.align === 'center'
      ? cx + col.w / 2
      : cx + pad;
  doc.text(String(txt), x, y + rowH / 2 + 2.5, {
    align: col.align === 'center' ? 'center' : col.align === 'right' ? 'right' : 'left',
    maxWidth: col.w - pad * 2,
  });
}

function drawSummary(doc, y, x, width, rows) {
  const labelW = width * 0.62;
  const valueW = width - labelW;
  const rowH = 15;
  const pad = 5;
  doc.setFontSize(8.5);
  rows.forEach(([label, value], index) => {
    const bold = index === rows.length - 1;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setLineWidth(0.3);
    doc.rect(x, y, labelW, rowH);
    doc.rect(x + labelW, y, valueW, rowH);
    doc.text(label, x + pad, y + rowH - 4, { maxWidth: labelW - pad * 2 });
    doc.text(value, x + width - pad, y + rowH - 4, { align: 'right' });
    y += rowH;
  });
  return y;
}

function buildQrText(data, grandTotal) {
  if (data.fbrInvoiceNumber) {
    return data.fbrInvoiceNumber;
  }

  return [
    'OFFLINE-INVOICE',
    safe(data.invoiceRefNo),
    safe(data.invoiceDate),
    safe(data.sellerNTNCNIC),
    safe(data.buyerNTNCNIC),
    fmt(grandTotal),
  ].join('|');
}

function formatRate(rate) {
  const text = safe(rate, '0');
  return text.includes('%') ? text : `${text}%`;
}

function stampPages(doc, data, PW, PH, ML, MR, CW) {
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(`Page ${p} of ${totalPages}`, PW - MR, PH - 18, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    if (data.isOffline) {
      doc.setFillColor(180, 0, 0);
      doc.rect(ML, 6, CW, 16, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('OFFLINE INVOICE - NOT YET SUBMITTED TO FBR', PW / 2, 18, { align: 'center' });
      doc.setTextColor(0, 0, 0);
    }
  }
}
