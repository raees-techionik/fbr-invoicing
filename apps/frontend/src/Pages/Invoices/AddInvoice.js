import React, { useState, useEffect, useRef, useMemo } from "react";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { IoMdAdd } from "react-icons/io";
import { Link } from "react-router-dom";
import useBlockBackButton from "../../Components/useBlockBackButton";
import { hsCodes, hsCodeLookup } from "../../Components/hsCodes";
import FbrErrorDisplay, { getFbrErrorsFromApiResponse } from "../../Components/FbrErrorDisplay";
import { getFbrReferenceBootstrap } from "../../services/fbrReferenceApi";
import { getProductMappings, resolveHsInvoiceFields } from "../../services/fbrProductMappingsApi";
import { formatInvoice, lookupReferenceInvoice, submitInvoice } from "../../services/fbrInvoiceApi";
import { enqueueOfflineInvoice } from "../../services/fbrOfflineQueueApi";
import { getSandboxScenarios } from "../../services/fbrSandboxApi";
import { getCustomers } from "../../services/customersApi";
import { getCompanyProfile } from "../../services/companyProfileApi";
import { saveAs } from "file-saver";
import { generateInvoicePdfFromForm } from "../../utils/generateInvoicePdf";
import techionikLogo from "../../Images/TechionikIcon.png";
import { IoMdArrowRoundForward } from "react-icons/io";
import { MdCancel } from "react-icons/md";
import "./AddInvoice.css";

const fallbackDocumentTypeOptions = [
  { value: "Sale Invoice", label: "Sale Invoice (Taxable)" },
  { value: "02", label: "Sale Invoice (Exempt/Zero-Rated)" },
  { value: "03", label: "Credit Note" },
  { value: "04", label: "Debit Note" },
  { value: "05", label: "Purchase Invoice (B2B)" },
];

const fallbackProvinceOptions = [
  { value: "Punjab", label: "Punjab" },
  { value: "Sindh", label: "Sindh" },
  { value: "Khyber Pakhtunkhwa", label: "Khyber Pakhtunkhwa" },
  { value: "Balochistan", label: "Balochistan" },
  { value: "Gilgit Baltistan", label: "Gilgit Baltistan" },
];

const fallbackUomOptions = [
  { value: "MT", label: "MT" },
  { value: "Bill of lading", label: "Bill of lading" },
  { value: "LTR", label: "LTR" },
  { value: "Numbers, pieces, unit", label: "Numbers, pieces, unit" },
  { value: "KWH", label: "KWH" },
  { value: "KG", label: "KG" },
  { value: "MMBTU", label: "MMBTU" },
  { value: "GWH", label: "GWH" },
  { value: "MTR", label: "MTR" },
];

const fallbackSaleTypeOptions = [
  "Goods at standard rate (default)",
  "Goods at Reduced Rate",
  "3rd Schedule Goods",
  "Goods at zero-rate",
  "Exempt Goods",
  "Taxable Activity - Not for Sale",
  "Not Applicable",
  "Services at standard rate",
  "Services at reduced rate",
  "Services at zero-rate",
  "Exempt Services",
  "Export of Goods",
  "Export of Services",
  "Goods on Approval",
  "Goods on Consignment",
  "Free Samples",
  "Temporary Imports",
  "Warranty Replacements",
  "Inter-Branch Transfers",
  "Self-Consumption",
  "Donation",
  "Return of Goods",
  "Return of Services",
  "Barter Transactions",
  "Trial Goods",
  "Leased Goods",
  "Rental Services",
  "Gift",
  "Not Defined",
].map((value) => ({ value, label: value }));

const emptyReferenceData = {
  provinces: [],
  documentTypes: [],
  hsCodes: [],
  uoms: [],
  sroItemCodes: [],
  transactionTypes: [],
};

const unwrapReferenceList = (entry) => Array.isArray(entry?.data) ? entry.data : [];

const AddInvoice = () => {
  useBlockBackButton();
  const [invoiceData, setInvoiceData] = useState({
    invoiceType: "Sale Invoice",  
    invoiceDate: "",    
    sellerNTNCNIC: "",     
    sellerBusinessName: "",
    sellerProvince: "",      
    sellerAddress: "",     
    buyerNTNCNIC: "", 
    buyerBusinessName: "", 
    buyerProvince: "",       
    buyerAddress: "",      
    buyerRegistrationType: "Registered", 
    invoiceRefNo: "", 
    scenarioId: "",            
    items: [
      {
        productMappingId: "",
        hsCode: "",
        productDescription: "", 
        rate: 0,              
        uoM: "",
        quantity: 0,
        totalValues: "",           
        valueSalesExcludingST: 0, 
        fixedNotifiedValueOrRetailPrice: 0, 
        salesTaxApplicable: 0,
        salesTaxWithheldAtSource: 0,
        extraTax: 0,
        furtherTax: 0,      
        sroScheduleNo: "",        
        fedPayable: 0,           
        discount: 0,             
        saleType: "", 
        sroItemSerialNo: ""       
      }
    ]
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitErrorType, setSubmitErrorType] = useState(null); // null | '401' | '500'
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [offlineQueueSuccess, setOfflineQueueSuccess] = useState("");
  const [fbrInvoiceNumber, setFbrInvoiceNumber] = useState('');
  const [fbrValidationErrors, setFbrValidationErrors] = useState([]);
  const [salesTaxOptions, setSalesTaxOptions] = useState([]);
  const [currentScenarioData, setCurrentScenarioData] = useState(null);
  const [allScenarios, setAllScenarios] = useState([]);
  const scenarioOptions = useMemo(() => allScenarios.map((scenario) => ({
    value: scenario.id || scenario.scenarioId,
    label: `${scenario.id || scenario.scenarioId}${scenario.name ? ` - ${scenario.name}` : ""}`,
    disabled: Boolean(scenario.isPlaceholder),
  })).filter(option => option.value), [allScenarios]);
  const [referenceData, setReferenceData] = useState(emptyReferenceData);
  const [referenceError, setReferenceError] = useState("");
  const [productMappings, setProductMappings] = useState([]);
  const [productMappingError, setProductMappingError] = useState("");
  const [isFormattingInvoice, setIsFormattingInvoice] = useState(false);
  const [formattedInvoicePreview, setFormattedInvoicePreview] = useState(null);
  const [isLookingUpReference, setIsLookingUpReference] = useState(false);
  const [referenceLookupResult, setReferenceLookupResult] = useState(null);
  const [invoiceToolError, setInvoiceToolError] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadReferenceData = async () => {
      try {
        const bootstrap = await getFbrReferenceBootstrap();

        if (!mounted) return;

        setReferenceData({
          provinces: unwrapReferenceList(bootstrap?.provinces),
          documentTypes: unwrapReferenceList(bootstrap?.documentTypes),
          hsCodes: unwrapReferenceList(bootstrap?.itemDescriptions),
          uoms: unwrapReferenceList(bootstrap?.uoms),
          sroItemCodes: unwrapReferenceList(bootstrap?.sroItemCodes),
          transactionTypes: unwrapReferenceList(bootstrap?.transactionTypes),
        });
        setReferenceError("");
      } catch (error) {
        console.error("Failed to load FBR reference data:", error);
        if (mounted) {
          setReferenceError("FBR reference data is unavailable. Using local fallback options.");
        }
      }
    };

    loadReferenceData();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadProductMappings = async () => {
      try {
        const data = await getProductMappings({ status: "Active", limit: 250 });
        if (mounted) {
          setProductMappings(data);
          setProductMappingError("");
        }
      } catch (error) {
        console.error("Failed to load product mappings:", error);
        if (mounted) {
          setProductMappingError("Saved product mappings are unavailable.");
        }
      }
    };

    loadProductMappings();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    getSandboxScenarios()
      .then((data) => { if (mounted) setAllScenarios(data); })
      .catch((err) => console.error("Failed to load sandbox scenarios:", err));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    getCompanyProfile()
      .then((profile) => {
        if (!mounted || !profile) return;
        setInvoiceData((prev) => ({
          ...prev,
          sellerNTNCNIC: profile.ntn_or_cnic || prev.sellerNTNCNIC,
          sellerBusinessName: profile.company_name || prev.sellerBusinessName,
          sellerProvince: (profile.province || '').toUpperCase() || prev.sellerProvince,
          sellerAddress: profile.address || prev.sellerAddress,
        }));
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

// Update the calculateTotalValues function
const calculateTotalValues = (item) => {
 // Determine which value to use for tax calculations
  const baseValue = (invoiceData.scenarioId === "SN008" || invoiceData.scenarioId === "SN027")
    ? parseFloat(item.fixedNotifiedValueOrRetailPrice) || 0
    : parseFloat(item.valueSalesExcludingST) || 0;

  const rate = parseFloat(item.rate) || 0;
  const furtherTax = parseFloat(item.furtherTax) || 0;
  const extraTax = parseFloat(item.extraTax) || 0;
  const salesTaxWithheldAtSource = parseFloat(item.salesTaxWithheldAtSource) || 0;

  // Calculate tax amounts
  const salesTaxAmount = baseValue * (rate / 100);
  const furtherTaxAmount = baseValue * (furtherTax / 100);
  const extraTaxAmount = baseValue * (extraTax / 100);
  const salesTaxWithheldAmount = baseValue * (salesTaxWithheldAtSource / 100);

  // Calculate total (withheld tax is subtracted)
  const total = baseValue + salesTaxAmount + furtherTaxAmount + extraTaxAmount - salesTaxWithheldAmount;

  return {
    total: total.toFixed(2),
    salesTaxAmount: salesTaxAmount.toFixed(2),
    furtherTaxAmount: furtherTaxAmount.toFixed(2),
    baseValue: baseValue.toFixed(2)
  };
};
// Update handleInputChange to recalculate when relevant fields change
const handleInputChange = (e, field, index) => {
  const { name, value } = e.target;
  setFbrValidationErrors([]);
  setSubmitError(null);
  setSubmitErrorType(null);
  setOfflineQueueSuccess("");
  
  if (index !== undefined) {
    const updatedItems = [...invoiceData.items];
    updatedItems[index] = {
      ...updatedItems[index],
      [name]: value
    };

    // Recalculate total values whenever relevant fields change
    if (name === 'valueSalesExcludingST' || 
        name === 'fixedNotifiedValueOrRetailPrice' || 
        name === 'rate' || 
        name === 'furtherTax' || 
        name === 'extraTax' ||
        name === 'salesTaxWithheldAtSource') {
      const calculated = calculateTotalValues(updatedItems[index]);
      updatedItems[index].totalValues = calculated.total;
      updatedItems[index].salesTaxApplicable = calculated.salesTaxAmount;
      // If using fixed notified value, update valueSalesExcludingST to match
      if (invoiceData.scenarioId === "SN008" || invoiceData.scenarioId === "SN027") {
        updatedItems[index].valueSalesExcludingST = calculated.baseValue;
      }
    }

    setInvoiceData({ ...invoiceData, items: updatedItems });
  } else {
    setInvoiceData({ ...invoiceData, [name]: value });
  }
};

// Derive scenario tax data from the locally-loaded sandbox scenarios list
useEffect(() => {
  if (!invoiceData.scenarioId || allScenarios.length === 0) {
    setCurrentScenarioData(null);
    setSalesTaxOptions([]);
    return;
  }

  const scenario = allScenarios.find((s) => (s.id || s.scenarioId) === invoiceData.scenarioId);
  const firstItem = scenario?.invoice?.items?.[0] || scenario?.fixture?.items?.[0];

  if (!firstItem) {
    setCurrentScenarioData(null);
    setSalesTaxOptions([]);
    return;
  }

  const rate = parseFloat(firstItem.rate) || 0;
  const taxOptions = rate > 0 ? [String(rate)] : [];
  const scenarioMeta = {
    salesTaxApplicable: taxOptions,
    furtherTax: String(firstItem.furtherTax ?? "0"),
    extraTax: String(firstItem.extraTax ?? "0"),
    salesTaxWithheldAtSource: String(firstItem.salesTaxWithheldAtSource ?? "0"),
  };

  setCurrentScenarioData(scenarioMeta);
  setSalesTaxOptions(taxOptions);

  setInvoiceData((prev) => ({
    ...prev,
    items: prev.items.map((item) => {
      const updated = {
        ...item,
        rate: taxOptions[0] || "0",
        furtherTax: scenarioMeta.furtherTax,
        extraTax: scenarioMeta.extraTax,
        salesTaxWithheldAtSource: scenarioMeta.salesTaxWithheldAtSource,
      };
      const calculated = calculateTotalValues(updated);
      return { ...updated, totalValues: calculated.total, salesTaxApplicable: calculated.salesTaxAmount };
    }),
  }));
}, [invoiceData.scenarioId, allScenarios]); // eslint-disable-line react-hooks/exhaustive-deps

  

  const handleAddItem = () => {
    setInvoiceData({
      ...invoiceData,
      items: [
        ...invoiceData.items,
        {
          productMappingId: "",
          hsCode: "",
          productDescription: "",
          rate: "",
          uoM: "",
          quantity: "",
          totalValues: "",
          valueSalesExcludingST: "",
          fixedNotifiedValueOrRetailPrice: 0,
          salesTaxApplicable: "0",
          salesTaxWithheldAtSource: "0",
          extraTax: currentScenarioData?.extraTax || "0",
          furtherTax: currentScenarioData?.furtherTax || "0",
          sroScheduleNo: "",
          fedPayable: "",
          discount: "",
          saleType: "",
          sroItemSerialNo: ""
        }
      ]
    });



  };

  // NEW: combined total of item.totalValues across all items
  const itemsTotalValue = invoiceData.items.reduce(
    (sum, item) => sum + (parseFloat(item.totalValues) || 0),
    0
  );

const buildInvoicePayload = () => ({
  invoiceType: invoiceData.invoiceType || "Sale Invoice",
  invoiceDate: invoiceData.invoiceDate || new Date().toISOString().split('T')[0],
  sellerNTNCNIC: invoiceData.sellerNTNCNIC || "0000000000000",
  sellerBusinessName: invoiceData.sellerBusinessName || "",
  sellerProvince: invoiceData.sellerProvince || "",
  sellerAddress: invoiceData.sellerAddress || "",
  buyerNTNCNIC: invoiceData.buyerNTNCNIC || "",
  buyerBusinessName: invoiceData.buyerBusinessName || "",
  buyerProvince: invoiceData.buyerProvince || "",
  buyerAddress: invoiceData.buyerAddress || "",
  buyerRegistrationType: invoiceData.buyerRegistrationType || "Registered",
  invoiceRefNo: invoiceData.invoiceRefNo || "",
  scenarioId: invoiceData.scenarioId || "",
  items: invoiceData.items.map(item => ({
    hsCode: item.hsCode || "0000.0000",
    productDescription: item.productDescription || "",
    rate: `${Number(item.rate) || 0}%`,
    uoM: item.uoM || "",
    quantity: parseInt(item.quantity) || 0,
    totalValues: parseFloat(item.totalValues) || 0,
    valueSalesExcludingST: parseFloat(item.valueSalesExcludingST) || 0,
    fixedNotifiedValueOrRetailPrice: parseFloat(item.fixedNotifiedValueOrRetailPrice) || 0,
    salesTaxApplicable: parseInt(item.salesTaxApplicable) || 0,
    salesTaxWithheldAtSource: parseFloat(item.salesTaxWithheldAtSource) || 0,
    extraTax: parseFloat(item.extraTax) || '',
    furtherTax: parseFloat(item.furtherTax) || 0,
    sroScheduleNo: item.sroScheduleNo || "",
    fedPayable: parseFloat(item.fedPayable) || 0,
    discount: parseFloat(item.discount) || 0,
    saleType: item.saleType || "Goods at standard rate (default)",
    sroItemSerialNo: item.sroItemSerialNo || ""
  }))
});

const handlePrintInvoice = async () => {
  try {
    const blob = await generateInvoicePdfFromForm(invoiceData, fbrInvoiceNumber, { isOffline });
    const url = URL.createObjectURL(blob);
    const pdfWindow = window.open(url, "_blank");

    if (pdfWindow) {
      pdfWindow.onload = () => {
        pdfWindow.focus();
        pdfWindow.print();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      };
      return;
    }

    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('PDF print generation failed:', err);
  }

  const printWindow = window.open("", "_blank");

  const fmtN = (n) => (parseFloat(n) || 0).toFixed(2);
  const totalValueExcl = invoiceData.items.reduce((s, it) => s + (parseFloat(it.valueSalesExcludingST) || 0), 0);
  const totalST = invoiceData.items.reduce((s, it) => s + (parseFloat(it.salesTaxApplicable) || 0), 0);
  const totalFurther = invoiceData.items.reduce((s, it) => s + (parseFloat(it.furtherTax) || 0), 0);
  const totalGrand = invoiceData.items.reduce((s, it) => s + (parseFloat(it.totalValues) || 0), 0);
  const printDate = new Date().toLocaleDateString("en-PK");

  // D9/D10 — generate QR data URL (FBR invoice number if available, else ref no)
  const qrTarget = fbrInvoiceNumber || invoiceData.invoiceRefNo || '';
  let qrImgHtml = '';
  if (qrTarget) {
    try {
      const QRCode = (await import('qrcode')).default;
      const qrDataUrl = await QRCode.toDataURL(qrTarget, { version: 2, width: 96, margin: 2, errorCorrectionLevel: 'M' });
      qrImgHtml = `<img src="${qrDataUrl}" width="96" height="96" alt="Invoice QR" style="display:block;" />
                   <div style="font-size:8px;text-align:center;margin-top:3px;">Scan to verify</div>`;
    } catch { /* QR optional — continue without it */ }
  }

  // D12 — offline banner HTML
  const offlineBannerHtml = isOffline
    ? `<div style="background:#b40000;color:#fff;font-weight:bold;text-align:center;padding:5px 0;font-size:11px;margin-bottom:8px;letter-spacing:0.5px;">
         OFFLINE INVOICE &mdash; NOT YET SUBMITTED TO FBR
       </div>`
    : '';

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Sales Tax Invoice</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; padding: 15px; color: #000; }
    .page-border { border: 2px solid #000; padding: 10px; }
    .header { position: relative; min-height: 72px; text-align: center; border-bottom: 2px solid #000; padding: 0 112px 8px; margin-bottom: 8px; }
    .invoice-brand { position: absolute; top: 0; right: 0; width: 104px; text-align: center; font-size: 9px; font-weight: bold; color: #1e293b; }
    .invoice-brand img { display: block; width: 38px; height: 38px; object-fit: contain; margin: 0 auto 4px; }
    .header h2 { font-size: 16px; text-transform: uppercase; letter-spacing: 1px; }
    .header h3 { font-size: 12px; font-weight: normal; margin: 2px 0; }
    .header .invoice-type { font-size: 13px; font-weight: bold; text-decoration: underline; margin: 4px 0; }
    .meta-row { display: none; }
    .invoice-meta-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px 14px; margin-bottom: 8px; font-size: 11px; }
    .invoice-meta-row div { display: grid; grid-template-columns: 92px minmax(0, 1fr); column-gap: 4px; min-width: 0; align-items: start; }
    .invoice-meta-row .full { grid-column: 1 / -1; }
    .invoice-meta-row span { font-weight: bold; }
    .invoice-meta-row b { font-weight: normal; overflow-wrap: anywhere; }
    .parties { display: flex; gap: 10px; margin-bottom: 10px; border: 1px solid #999; }
    .party { flex: 1; padding: 6px 8px; }
    .party:first-child { border-right: 1px solid #999; }
    .party h4 { font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 3px; margin-bottom: 4px; }
    .party p { display: grid; grid-template-columns: 80px minmax(0, 1fr); gap: 4px; margin: 2px 0; }
    .party p strong { display: block; min-width: 0; }
    .party p span { display: block; overflow-wrap: anywhere; }
    table.items { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 10px; }
    table.items th { background: #e0e0e0; border: 1px solid #000; padding: 4px 3px; text-align: center; font-size: 10px; }
    table.items td { border: 1px solid #555; padding: 3px; text-align: right; }
    table.items td.left { text-align: left; }
    table.items td.center { text-align: center; }
    table.items tr.total-row td { font-weight: bold; background: #f5f5f5; }
    .summary { display: flex; justify-content: flex-end; margin-bottom: 12px; }
    .summary-table { border-collapse: collapse; min-width: 280px; }
    .summary-table td { padding: 3px 8px; border: 1px solid #999; }
    .summary-table td:last-child { text-align: right; font-weight: bold; min-width: 90px; }
    .footer { display: flex; align-items: flex-end; justify-content: space-between; border-top: 1px solid #000; padding-top: 8px; margin-top: 8px; gap: 8px; }
    .footer .qr-block { flex: 0 0 auto; }
    .footer .sig-group { flex: 1; display: flex; justify-content: space-between; }
    .footer .sig { width: 45%; }
    .sig-line { border-bottom: 1px solid #000; margin-top: 30px; margin-bottom: 3px; }
    .fbr-note { font-size: 9px; color: #444; text-align: center; margin-top: 8px; border-top: 1px solid #ccc; padding-top: 4px; }
    @media print { body { padding: 0; } .page-border { border: none; } }
  </style>
</head>
<body>
<div class="page-border">

  ${offlineBannerHtml}

  <div class="header">
    <div class="invoice-brand">
      <img src="${techionikLogo}" alt="Techionik" />
      <div>Powered by Techionik</div>
    </div>
    <h2>${invoiceData.sellerBusinessName || 'Seller'}</h2>
    <h3>NTN/CNIC: ${invoiceData.sellerNTNCNIC || '—'} | Province: ${invoiceData.sellerProvince || '—'}</h3>
    <h3>${invoiceData.sellerAddress || ''}</h3>
    <div class="invoice-type">${invoiceData.invoiceType || 'Sales Tax Invoice'}</div>
  </div>

  <div class="invoice-meta-row">
    <div><span>Invoice Ref No:</span><b>${invoiceData.invoiceRefNo || '-'}</b></div>
    <div><span>Invoice Date:</span><b>${invoiceData.invoiceDate || '-'}</b></div>
    ${fbrInvoiceNumber ? `<div class="full"><span>FBR Invoice No:</span><b>${fbrInvoiceNumber}</b></div>` : ''}
    <div><span>Status:</span><b>${fbrInvoiceNumber ? 'SUBMITTED' : 'DRAFT'}</b></div>
    <div><span>Software Reg. No:</span><b>${SOFTWARE_REG_NO}</b></div>
    <div><span>Print Date:</span><b>${printDate}</b></div>
  </div>

  <div class="meta-row">
    <div><span>Invoice Ref No:</span> ${invoiceData.invoiceRefNo || '—'}</div>
    <div><span>Invoice Date:</span> ${invoiceData.invoiceDate || '—'}</div>
    ${fbrInvoiceNumber ? `<div><span>FBR Invoice No:</span> ${fbrInvoiceNumber}</div>` : ''}
    <div><span>Print Date:</span> ${printDate}</div>
  </div>

  <div class="parties">
    <div class="party">
      <h4>Supplier (Seller)</h4>
      <p><strong>Name:</strong> ${invoiceData.sellerBusinessName || '—'}</p>
      <p><strong>NTN/CNIC:</strong> ${invoiceData.sellerNTNCNIC || '—'}</p>
      <p><strong>Province:</strong> ${invoiceData.sellerProvince || '—'}</p>
      <p><strong>Address:</strong> ${invoiceData.sellerAddress || '—'}</p>
    </div>
    <div class="party">
      <h4>Recipient (Buyer)</h4>
      <p><strong>Name:</strong> ${invoiceData.buyerBusinessName || '—'}</p>
      <p><strong>NTN/CNIC:</strong> ${invoiceData.buyerNTNCNIC || '—'}</p>
      <p><strong>Province:</strong> ${invoiceData.buyerProvince || '—'}</p>
      <p><strong>Address:</strong> ${invoiceData.buyerAddress || '—'}</p>
      <p><strong>Reg. Type:</strong> ${invoiceData.buyerRegistrationType || '—'}</p>
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th style="width:4%">Sr.</th>
        <th style="width:10%">HS Code</th>
        <th style="width:28%">Description</th>
        <th style="width:6%">UOM</th>
        <th style="width:5%">Qty</th>
        <th style="width:11%">Value Excl. ST</th>
        <th style="width:7%">Rate (%)</th>
        <th style="width:10%">Sales Tax</th>
        <th style="width:8%">Further Tax</th>
        <th style="width:11%">Total Value</th>
      </tr>
    </thead>
    <tbody>
      ${invoiceData.items.map((item, i) => `
      <tr>
        <td class="center">${i + 1}</td>
        <td class="center">${item.hsCode || '—'}</td>
        <td class="left">${item.productDescription || '—'}</td>
        <td class="center">${item.uoM || '—'}</td>
        <td class="center">${item.quantity || 0}</td>
        <td>${fmtN(item.valueSalesExcludingST)}</td>
        <td class="center">${item.rate || 0}%</td>
        <td>${fmtN(item.salesTaxApplicable)}</td>
        <td>${fmtN(item.furtherTax)}</td>
        <td>${fmtN(item.totalValues)}</td>
      </tr>`).join('')}
      <tr class="total-row">
        <td colspan="5" class="left" style="padding-left:6px">TOTAL</td>
        <td>${fmtN(totalValueExcl)}</td>
        <td></td>
        <td>${fmtN(totalST)}</td>
        <td>${fmtN(totalFurther)}</td>
        <td>${fmtN(totalGrand)}</td>
      </tr>
    </tbody>
  </table>

  <div class="summary">
    <table class="summary-table">
      <tr><td>Total Value Excl. Sales Tax</td><td>PKR ${fmtN(totalValueExcl)}</td></tr>
      <tr><td>Total Sales Tax</td><td>PKR ${fmtN(totalST)}</td></tr>
      <tr><td>Total Further Tax</td><td>PKR ${fmtN(totalFurther)}</td></tr>
      <tr><td><strong>Grand Total (PKR)</strong></td><td><strong>${fmtN(totalGrand)}</strong></td></tr>
    </table>
  </div>

  <div class="footer">
    ${qrImgHtml ? `<div class="qr-block">${qrImgHtml}</div>` : ''}
    <div class="sig-group">
      <div class="sig">
        <div class="sig-line"></div>
        <div>Authorised Signatory</div>
      </div>
      <div class="sig" style="text-align:right">
        <div class="sig-line"></div>
        <div>Stamp</div>
      </div>
    </div>
  </div>

  <div class="fbr-note">
    Integrated with FBR Digital Invoicing System &mdash; Software Reg. No: ${SOFTWARE_REG_NO}<br/>
    This invoice has been submitted to FBR under the Digital Invoicing (DI) System as required under
    Rule 150R of the Sales Tax Rules, 2006. Printed by TECHIONIK FBR Portal &mdash; ${printDate}
  </div>

</div>
<script>window.onload = function(){ window.print(); }</script>
</body>
</html>`);
  printWindow.document.close();
};

  const handleSubmitInvoice = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitErrorType(null);
    setSubmitSuccess(false);
    setOfflineQueueSuccess("");
    let apiData;

    try {
      // Validate required fields before submission
      const requiredFields = [
        'invoiceType',
        'invoiceDate',
        'sellerNTNCNIC',
        'sellerBusinessName',
        'sellerProvince',
        'sellerAddress',
        'buyerNTNCNIC',
        'buyerBusinessName',
        'buyerProvince',
        'buyerAddress',
        'buyerRegistrationType'
      ];

      const fieldLabels = {
        invoiceType: 'Invoice Type',
        invoiceDate: 'Invoice Date',
        sellerNTNCNIC: 'Seller NTN/CNIC',
        sellerBusinessName: 'Seller Business Name',
        sellerProvince: 'Seller Province',
        sellerAddress: 'Seller Address',
        buyerNTNCNIC: 'Buyer NTN/CNIC',
        buyerBusinessName: 'Buyer Business Name',
        buyerProvince: 'Buyer Province',
        buyerAddress: 'Buyer Address',
        buyerRegistrationType: 'Buyer Registration Type',
      };

      const missingFields = requiredFields.filter(field => !invoiceData[field]);

      if (missingFields.length > 0) {
        const missing = missingFields.map(f => fieldLabels[f] || f).join(', ');
        setSubmitError(`Please fill in all required fields: ${missing}`);
        setIsSubmitting(false);
        return;
      }

      // Validate items
      if (invoiceData.items.length === 0) {
        setSubmitError('Please add at least one item to the invoice');
        setIsSubmitting(false);
        return;
      }

    

      apiData = buildInvoicePayload();

      const queueInvoiceForLater = async (reason) => {
        const queued = await enqueueOfflineInvoice({
          invoicePayload: apiData,
          settings: {
            environment: "sandbox",
          },
        });

        setOfflineQueueSuccess(
          `${reason} Invoice has been saved to the offline queue and will be submitted when processing runs.`
        );
        return queued;
      };

      if (isOffline) {
        await queueInvoiceForLater("You are offline.");
        return;
      }

      // Submit to FBR via new backend (auto-saves to dashboard on success)
      const result = await submitInvoice(apiData);

      if (result?.isValid) {
        setSubmitSuccess(true);
        if (result.invoiceNumber) {
          setFbrInvoiceNumber(result.invoiceNumber);
        }
      } else {
        const normalizedErrors = getFbrErrorsFromApiResponse(result);
        if (normalizedErrors.length > 0) {
          setFbrValidationErrors(normalizedErrors);
        }
        setSubmitError("Invoice validation failed. Please fix the highlighted errors and try again.");
      }
  } catch (error) {
    console.error("[invoice-submit]", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });

    const status = error.response?.status;

    if (status === 401) {
      // B11 — token expired or invalid
      setSubmitErrorType('401');
      setSubmitError('Your FBR API token is expired or invalid.');

    } else if (status >= 500) {
      // B12 — server error; invoice data stays in the form untouched
      const detail = error.response?.data?.error || error.response?.data?.message || '';
      try {
        await enqueueOfflineInvoice({
          invoicePayload: apiData,
          settings: {
            environment: "sandbox",
          },
        });
        setSubmitErrorType(null);
        setSubmitError(null);
        setOfflineQueueSuccess(
          "FBR/server submission failed, so the invoice has been saved to the offline queue for retry."
        );
      } catch (queueError) {
        console.error("[invoice-offline-queue]", queueError);
        setSubmitErrorType('500');
        setSubmitError(detail || 'The FBR server returned an unexpected error. The invoice could not be queued automatically.');
      }

    } else if (error.response) {
      // 4xx validation / business errors
      const normalizedErrors = getFbrErrorsFromApiResponse(error.response.data);
      if (normalizedErrors.length > 0) {
        setFbrValidationErrors(normalizedErrors);
      }
      if (error.response.data?.errors) {
        const errorMessages = Object.values(error.response.data.errors).flat().join(', ');
        setSubmitError(`Validation errors: ${errorMessages}`);
      } else {
        setSubmitError(error.response.data?.message || 'An error occurred while submitting the invoice.');
      }

    } else if (error.request) {
      try {
        await enqueueOfflineInvoice({
          invoicePayload: apiData,
          settings: {
            environment: "sandbox",
          },
        });
        setOfflineQueueSuccess(
          "No submit response was received, so the invoice has been saved to the offline queue for retry."
        );
      } catch (queueError) {
        console.error("[invoice-offline-queue]", queueError);
        setSubmitError('No response from the server. Please check your connection and try again. The invoice could not be queued automatically.');
      }

    } else {
      setSubmitError('An unexpected error occurred. Please try again.');
    }
  } finally {
    setIsSubmitting(false);
  }
};

 const applyItemAutofill = (item, fields) => {
    const nextItem = {
      ...item,
      productMappingId: fields.productMappingId ?? item.productMappingId,
      hsCode: fields.hsCode ?? item.hsCode,
      productDescription: fields.productDescription ?? item.productDescription,
      rate: fields.rate !== undefined && fields.rate !== "" ? fields.rate : item.rate,
      uoM: fields.uoM || fields.unitOfMeasurement || item.uoM,
      sroScheduleNo: fields.sroScheduleNo ?? item.sroScheduleNo,
      saleType: fields.saleType ?? item.saleType,
      furtherTax: fields.furtherTax ?? item.furtherTax,
      extraTax: fields.extraTax ?? item.extraTax,
    };
    const calculated = calculateTotalValues(nextItem);

    return {
      ...nextItem,
      totalValues: calculated.total,
      salesTaxApplicable: calculated.salesTaxAmount,
    };
  };

 const handleProductSelect = (e, index) => {
    const productMappingId = e.target.value;
    const selectedProduct = productMappings.find((product) => product.id === productMappingId);

    const updatedItems = [...invoiceData.items];

    if (!selectedProduct) {
      updatedItems[index] = {
        ...updatedItems[index],
        productMappingId: "",
      };
      setInvoiceData({ ...invoiceData, items: updatedItems });
      return;
    }

    updatedItems[index] = applyItemAutofill(updatedItems[index], {
      productMappingId,
      ...(selectedProduct.invoiceFields || {}),
    });
    setFbrValidationErrors([]);
    setInvoiceData({ ...invoiceData, items: updatedItems });
  };

 const handleHsCodeChange = async (e, index) => {
    const hsCode = e.target.value;
    const selectedHsCode = referenceData.hsCodes.find((item) => item.hsCode === hsCode);
    const description = selectedHsCode?.description || hsCodeLookup[hsCode] || "";
    
    const updatedItems = [...invoiceData.items];
    updatedItems[index] = {
      ...updatedItems[index],
      hsCode,
      productDescription: description 
    };

    setInvoiceData({ ...invoiceData, items: updatedItems });

    try {
      const resolvedFields = await resolveHsInvoiceFields({
        hsCode,
        saleType: updatedItems[index].saleType,
        invoiceDate: invoiceData.invoiceDate,
        originationSupplier: invoiceData.sellerNTNCNIC,
      });

      const refreshedItems = [...updatedItems];
      refreshedItems[index] = applyItemAutofill(refreshedItems[index], {
        productDescription: resolvedFields.hsDescription || description,
        rate: resolvedFields.salesTaxRate,
        uoM: resolvedFields.unitOfMeasurement,
        saleType: resolvedFields.saleType,
      });
      setInvoiceData((prev) => ({ ...prev, items: refreshedItems }));
    } catch (error) {
      console.error("Failed to resolve HS code invoice fields:", error);
    }
  };


  const [allCustomers, setAllCustomers] = useState([]);
  const [buyerSearchResults, setBuyerSearchResults] = useState([]);
  const [showBuyerDropdown, setShowBuyerDropdown] = useState(false);
  const [isBuyerSelected, setIsBuyerSelected] = useState(false);
  const buyerDropdownRef = useRef(null);

  useEffect(() => {
    getCustomers({ limit: 250 })
      .then(data => setAllCustomers(data || []))
      .catch(err => console.error("Failed to load customers:", err));
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (buyerDropdownRef.current && !buyerDropdownRef.current.contains(e.target)) {
        setShowBuyerDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleBuyerSelect = (buyer) => {
    setInvoiceData(prev => ({
      ...prev,
      buyerNTNCNIC: buyer.cnic || '',
      buyerBusinessName: buyer.name || '',
      buyerProvince: buyer.province || '',
      buyerAddress: buyer.address || '',
      buyerRegistrationType: buyer.registration_type === "Unregistered" ? "Unregistered"
        : buyer.registration_type === "Retail Consumer" ? "Retail Consumer"
        : "Registered",
    }));
    setShowBuyerDropdown(false);
    setIsBuyerSelected(true);
    setBuyerSearchResults([]);
  };

  const handleSearchFieldChange = (e, field) => {
    if (isBuyerSelected) setIsBuyerSelected(false);
    handleInputChange(e, field);
    const term = e.target.value.toLowerCase();
    if (term.length < 1) {
      setBuyerSearchResults([]);
      setShowBuyerDropdown(false);
      return;
    }
    const results = allCustomers.filter(c =>
      (c.name?.toLowerCase() || '').includes(term) ||
      (c.cnic?.toLowerCase() || '').includes(term)
    ).slice(0, 8);
    setBuyerSearchResults(results);
    setShowBuyerDropdown(results.length > 0);
  };

const { isOnline } = useOnlineStatus();
const isOffline = !isOnline;

// Software reg number constant kept in sync with generateInvoicePdf.js
const SOFTWARE_REG_NO = 'TECHIONIK-FBR-001';

const handleDownloadPdf = async () => {
  try {
    const blob = await generateInvoicePdfFromForm(invoiceData, fbrInvoiceNumber, { isOffline });
    const name = (invoiceData.buyerBusinessName || 'invoice').replace(/[/\\?%*:|"<>]/g, '_');
    saveAs(blob, `${name}.pdf`);
  } catch (err) {
    console.error('PDF generation failed:', err);
  }
};

const handlePreviewFormattedPayload = async () => {
  setIsFormattingInvoice(true);
  setInvoiceToolError("");
  setFormattedInvoicePreview(null);
  try {
    const result = await formatInvoice({
      invoice: buildInvoicePayload(),
      settings: { environment: "sandbox", useMock: true },
    });
    setFormattedInvoicePreview(result);
  } catch (error) {
    console.error("[invoice-format-preview]", error);
    setInvoiceToolError(error.response?.data?.error || error.response?.data?.message || error.message || "Unable to format invoice payload.");
  } finally {
    setIsFormattingInvoice(false);
  }
};

const handleLookupReferenceInvoice = async () => {
  setInvoiceToolError("");
  setReferenceLookupResult(null);
  if (!invoiceData.invoiceRefNo) {
    setInvoiceToolError("Enter an invoice reference number before lookup.");
    return;
  }

  setIsLookingUpReference(true);
  try {
    const result = await lookupReferenceInvoice(invoiceData.invoiceRefNo, {
      environment: "sandbox",
      useMock: true,
    });
    setReferenceLookupResult(result);
  } catch (error) {
    console.error("[invoice-reference-lookup]", error);
    setInvoiceToolError(error.response?.data?.error || error.response?.data?.message || error.message || "Reference invoice lookup failed.");
  } finally {
    setIsLookingUpReference(false);
  }
};

const provinceOptions = referenceData.provinces.length
  ? referenceData.provinces.map((province) => ({
      value: province.description,
      label: province.description,
    }))
  : fallbackProvinceOptions;

const documentTypeOptions = referenceData.documentTypes.length
  ? referenceData.documentTypes.map((documentType) => ({
      value: documentType.description,
      label: documentType.description,
    }))
  : fallbackDocumentTypeOptions;

const hsCodeOptions = referenceData.hsCodes.length
  ? referenceData.hsCodes.map((item) => ({
      value: item.hsCode,
      label: item.hsCode,
    }))
  : hsCodes.map((item) => ({
      value: item.code,
      label: item.code,
    }));

const uomOptions = referenceData.uoms.length
  ? referenceData.uoms.map((uom) => ({
      value: uom.description,
      label: uom.description,
    }))
  : fallbackUomOptions;

const saleTypeOptions = referenceData.transactionTypes.length
  ? referenceData.transactionTypes.map((transactionType) => ({
      value: transactionType.description,
      label: transactionType.description,
    }))
  : fallbackSaleTypeOptions;

const sroItemCodeOptions = referenceData.sroItemCodes.map((sroItem) => ({
  value: sroItem.description,
  label: sroItem.description,
}));

const productMappingOptions = productMappings.map((product) => ({
  value: product.id,
  label: `${product.product_name || product.productName} - ${product.hs_code || product.hsCode}`,
}));

const normalizeFbrField = (field) => {
  const aliases = {
    uom: "uoM",
    unitOfMeasurement: "uoM",
    ntnCnic: "buyerNTNCNIC",
    seller: "sellerBusinessName",
    buyer: "buyerBusinessName",
    registration: "buyerRegistrationType",
    invoice: "invoiceType",
    items: "items",
  };
  return aliases[field] || field;
};

const errorMessageFor = (error) => error?.userMessage || error?.message || error?.fbrMessage || "Review this field and retry.";
const headerFbrErrors = fbrValidationErrors.filter((error) => error.scope !== "item");
const getItemFbrErrors = (index) => fbrValidationErrors.filter((error) => error.scope === "item" && error.itemIndex === index);
const hasItemFbrError = (index) => getItemFbrErrors(index).length > 0;
const getFieldFbrErrors = (field, index) => {
  const normalizedField = normalizeFbrField(field);
  return fbrValidationErrors.filter((error) => {
    const errorField = normalizeFbrField(error.field);
    const sameField = errorField === normalizedField || (normalizedField === "items" && errorField === "items");
    if (!sameField) return false;
    if (index === undefined) return error.scope !== "item";
    return error.scope === "item" && error.itemIndex === index;
  });
};
const hasFieldFbrError = (field, index) => getFieldFbrErrors(field, index).length > 0;
const fieldClassName = (baseClassName, field, index) => `${baseClassName} ${hasFieldFbrError(field, index) ? "is-invalid border-danger" : ""}`;
const renderFbrFieldError = (field, index) => {
  const errors = getFieldFbrErrors(field, index);

  if (!errors.length) {
    return null;
  }

  return (
    <small className="text-danger d-block mt-1">
      {errors.map((error) => errorMessageFor(error)).join(" ")}
      {errors.some((error) => error.errorCode) && (
        <span className="ms-1">
          Code: {errors.map((error) => error.errorCode).filter(Boolean).join(", ")}
        </span>
      )}
    </small>
  );
};


  return (
    <div className="add-invoice-page">
      <div className="add-invoice-header">
        <div>
          <span className="add-invoice-eyebrow">FBR Digital Invoicing</span>
          <h1>Create New Invoice</h1>
          <p>Enter seller, buyer, and item details for FBR submission.</p>
        </div>

        <Link to="/invoice" className="add-invoice-close" aria-label="Back to invoices">
          <MdCancel size={22} />
        </Link>
      </div>

      <div className="add-invoice-summary">
        <div>
          <span>Connection</span>
          <strong className={isOffline ? "danger" : "success"}>{isOffline ? "Offline queue" : "Online"}</strong>
        </div>
        <div>
          <span>Scenario</span>
          <strong>{invoiceData.scenarioId || "Not selected"}</strong>
        </div>
        <div>
          <span>Items</span>
          <strong>{invoiceData.items.length}</strong>
        </div>
        <div>
          <span>Total</span>
          <strong>PKR {itemsTotalValue.toFixed(2)}</strong>
        </div>
      </div>

      <FbrErrorDisplay errors={headerFbrErrors} />

      {(invoiceToolError || formattedInvoicePreview || referenceLookupResult) && (
        <section className="add-invoice-tools-panel" aria-live="polite">
          {invoiceToolError && <div className="alert alert-warning mb-0">{invoiceToolError}</div>}
          {referenceLookupResult && (
            <div className="add-invoice-tool-card">
              <div>
                <span>Reference lookup</span>
                <strong>{referenceLookupResult.found ? "Reference available" : "Reference not confirmed"}</strong>
                <p>{referenceLookupResult.message}</p>
              </div>
              <code>{referenceLookupResult.invoiceRefNo}</code>
            </div>
          )}
          {formattedInvoicePreview && (
            <div className="add-invoice-tool-card add-invoice-tool-card--payload">
              <div>
                <span>FBR formatted payload</span>
                <strong>{formattedInvoicePreview.message}</strong>
                <p>{formattedInvoicePreview.payload?.items?.length || 0} item{(formattedInvoicePreview.payload?.items?.length || 0) === 1 ? "" : "s"} ready for {formattedInvoicePreview.environment} formatting.</p>
              </div>
              <pre>{JSON.stringify(formattedInvoicePreview.payload, null, 2)}</pre>
            </div>
          )}
        </section>
      )}

      <div className="add-invoice-steps" aria-label="Invoice progress">
        <div className={`add-invoice-step ${invoiceData.invoiceType && invoiceData.invoiceDate ? "done" : "active"}`}>
          <span className="add-invoice-step-circle">1</span>
          <span>Invoice Info</span>
        </div>
        <div className="add-invoice-step-line" />
        <div className={`add-invoice-step ${invoiceData.buyerNTNCNIC && invoiceData.buyerBusinessName ? "done" : "active"}`}>
          <span className="add-invoice-step-circle">2</span>
          <span>Buyer Details</span>
        </div>
        <div className="add-invoice-step-line" />
        <div className={`add-invoice-step ${invoiceData.items.length > 0 ? "done" : ""}`}>
          <span className="add-invoice-step-circle">3</span>
          <span>Line Items</span>
        </div>
        <div className="add-invoice-step-line" />
        <div className="add-invoice-step">
          <span className="add-invoice-step-circle">4</span>
          <span>Review</span>
        </div>
      </div>

      <div className="add-invoice-form-layout">
        <div className="add-invoice-form-main">
      <div className="container-fluid px-0 mt-3 mt-md-0">
        <div className="row">
          <div className="col-md-6">
            <div className="seller-buyer-section bg-invoice-shadow2 add-invoice-card">
              <h4 className="section-header px-3 text-white">Seller Information</h4>
              <div className="seller-info p-4 px-">
                <div className="row">
                    <div className="col-md-6 col-12">

                <label>Invoice Type</label>
                <select
                  name="invoiceType"
                  className={fieldClassName("invoice-input mt-2 form-control", "invoiceType")}
                  value={invoiceData.invoiceType}
                  onChange={(e) => handleInputChange(e, "invoiceType")}
                >
                  {documentTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {renderFbrFieldError("invoiceType")}
                {referenceError && <small className="text-warning">{referenceError}</small>}
                
                <label className="mt-3">Invoice Date</label>
                <input
                  type="date"
                  className={fieldClassName("invoice-input form-control", "invoiceDate")}
                  name="invoiceDate"
                  value={invoiceData.invoiceDate}
                  onChange={(e) => handleInputChange(e, "invoiceDate")}
                />
                {renderFbrFieldError("invoiceDate")}
                <label>Seller NTN/CNIC</label>
                <input
                  type="text"
                  className={fieldClassName("invoice-input form-control", "sellerNTNCNIC")}
                  name="sellerNTNCNIC"
                  value={invoiceData.sellerNTNCNIC}
                  onChange={(e) => handleInputChange(e, "sellerNTNCNIC")}
                />
                {renderFbrFieldError("sellerNTNCNIC")}
                   <label className="heighlight">Select Scenario Id</label>
        <select 
          className={fieldClassName("form-control", "scenarioId")}
          name="scenarioId"
          value={invoiceData.scenarioId}
          onChange={(e) => handleInputChange(e, "scenarioId")}
        >
          <option value="">Select Scenario</option>
          {scenarioOptions.map(option => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        {renderFbrFieldError("scenarioId")}

                
                    </div>
                     <div className="col-md-6 col-12">
                <label>Seller Business Name</label>
                <input
                  type="text"
                  className={fieldClassName("invoice-input form-control", "sellerBusinessName")}
                  name="sellerBusinessName"
                  value={invoiceData.sellerBusinessName}
                  onChange={(e) => handleInputChange(e, "sellerBusinessName")}
                />
                {renderFbrFieldError("sellerBusinessName")}
                <label>Seller Province</label>
                <select
                  className={fieldClassName("invoice-input form-control", "sellerProvince")}
                  name="sellerProvince"
                  value={invoiceData.sellerProvince}
                  onChange={(e) => handleInputChange(e, "sellerProvince")}
                >
                  <option value="">Select Province</option>
                  {provinceOptions.map((province) => (
                    <option key={province.value} value={province.value}>
                      {province.label}
                    </option>
                  ))}
                </select>
                {renderFbrFieldError("sellerProvince")}
                <label>Seller Address</label>
                <input
                  type="text"
                  className={fieldClassName("invoice-input form-control", "sellerAddress")}
                  name="sellerAddress"
                  value={invoiceData.sellerAddress}
                  onChange={(e) => handleInputChange(e, "sellerAddress")}
                />
                {renderFbrFieldError("sellerAddress")}

                     </div>
                </div>


                <div className="add-invoice-helper">Need to update seller details? <Link to={'/company-profile'} className="redirect"> <IoMdArrowRoundForward size={20} className="" /> Company Profile</Link></div>
              </div>
            </div>
          </div>

          <div className="col-md-6">
            <div className="seller-buyer-section bg-invoice-shadow2 add-invoice-card">
              <h4 className="section-header text-white">Buyer Information</h4>
              <div className="buyer-info p-4 ">
                <div className="row">
                  <div className="col-md-6">
                <label>Buyer NTN/CNIC</label>
                <div className="position-relative" ref={buyerDropdownRef}>
                  <input
                    type="text"
                    className={fieldClassName("invoice-input form-control", "buyerNTNCNIC")}
                    name="buyerNTNCNIC"
                    value={invoiceData.buyerNTNCNIC}
                    onChange={(e) => handleSearchFieldChange(e, "buyerNTNCNIC")}
                    autoComplete="off"
                  />
                  {showBuyerDropdown && buyerSearchResults.length > 0 && (
                    <div className="dropdown-menu show position-absolute w-100" style={{ zIndex: 1000, maxHeight: 200, overflowY: 'auto' }}>
                      {buyerSearchResults.map((buyer, index) => (
                        <button key={index} className="dropdown-item d-flex flex-column" type="button" onClick={() => handleBuyerSelect(buyer)}>
                          <span className="fw-semibold">{buyer.name}</span>
                          <span className="small text-muted">{buyer.cnic}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {renderFbrFieldError("buyerNTNCNIC")}

                <label>Buyer Business Name</label>
                <input
                  type="text"
                  className={fieldClassName("invoice-input form-control", "buyerBusinessName")}
                  name="buyerBusinessName"
                  value={invoiceData.buyerBusinessName}
                  onChange={(e) => handleSearchFieldChange(e, "buyerBusinessName")}
                  autoComplete="off"
                />
                {renderFbrFieldError("buyerBusinessName")}
                <label>Buyer Province</label>
                <select
                  className={fieldClassName("invoice-input form-control", "buyerProvince")}
                  name="buyerProvince"
                  value={invoiceData.buyerProvince}
                  onChange={(e) => handleInputChange(e, "buyerProvince")}
                >
                  <option value="">Select Province</option>
                  {provinceOptions.map((province) => (
                    <option key={province.value} value={province.value}>
                      {province.label}
                    </option>
                  ))}
                </select>
                {renderFbrFieldError("buyerProvince")}
                <label>Buyer Address</label>
                <input
                  type="text"
                  className={fieldClassName("invoice-input form-control", "buyerAddress")}
                  name="buyerAddress"
                  value={invoiceData.buyerAddress}
                  onChange={(e) => handleInputChange(e, "buyerAddress")}
                />
                {renderFbrFieldError("buyerAddress")}
                    
                  </div>
                  <div className="col-md-6">
                <label className="mb-2">Buyer Registration Type</label>
                <select
                  className={fieldClassName("form-control mb-2", "buyerRegistrationType")}
                  value={invoiceData.buyerRegistrationType}
                  onChange={(e) => handleInputChange(e, "buyerRegistrationType")}
                  name="buyerRegistrationType"
                >
                  <option value="Registered">Registered</option>
                  <option value="Unregistered">UnRegistered</option>
                  <option value="Retail Consumer">Retail Consumer</option>
                </select>
                {renderFbrFieldError("buyerRegistrationType")}
              
                <label>Invoice Reference No</label>
                <div className="add-invoice-reference-row">
                  <input
                    type="text"
                    className={fieldClassName("invoice-input form-control", "invoiceRefNo")}
                    name="invoiceRefNo"
                    value={invoiceData.invoiceRefNo}
                    onChange={(e) => handleInputChange(e, "invoiceRefNo")}
                  />
                  <button type="button" className="btn buttonsave" onClick={handleLookupReferenceInvoice} disabled={isLookingUpReference}>
                    {isLookingUpReference ? "Checking..." : "Lookup"}
                  </button>
                </div>
                {renderFbrFieldError("invoiceRefNo")}

                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="add-invoice-inline-action">
            <button type="button" className="invoice-button" onClick={handleAddItem}>
              <IoMdAdd size={18} /> Add Item
            </button>
          </div>
        </div>
      </div>

   

      <div className="container-fluid px-0 mt-4">
        <div className="items-section bg-invoice-shadow2 add-invoice-card add-invoice-items">
          <h4 className="section-header text-white">ITEM-LEVEL INFORMATION</h4>

          {/* Added button inside the card to add more items */}
          <div className="add-invoice-items-toolbar">
            <button type="button" className="btn btn-outline-primary" onClick={handleAddItem}>
              <IoMdAdd size={18} /> Add more items
            </button>
          </div>

          {invoiceData.items.map((item, index) => (
            <div className={`item-row p-4 add-invoice-item-card ${hasItemFbrError(index) ? "border border-danger rounded" : ""}`} key={index}>
              <div className="add-invoice-item-card__header">
                <div>
                  <span>Line Item</span>
                  <strong>Item {index + 1}</strong>
                </div>
                <span className="add-invoice-item-card__total">PKR {parseFloat(item.totalValues || 0).toFixed(2)}</span>
              </div>
              <FbrErrorDisplay errors={getItemFbrErrors(index)} compact />
              {productMappingError && <small className="text-warning">{productMappingError}</small>}
              <div className="row">
                <div className="col-md-6 form-group">
                  <label>Saved Product Mapping</label>
                  <select
                    className="invoice-input form-control"
                    name="productMappingId"
                    value={item.productMappingId || ""}
                    onChange={(e) => handleProductSelect(e, index)}
                  >
                    <option value="">Select Saved Product</option>
                    {productMappingOptions.map((product) => (
                      <option key={product.value} value={product.value}>
                        {product.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="row">
                <div className="col-md-6 form-group">
  <label>HS Code</label>
   <select
        className={fieldClassName("invoice-input form-control", "hsCode", index)}
        name="hsCode"
        value={item.hsCode}
        onChange={(e) => handleHsCodeChange(e, index)}
      >
        <option value="" disabled>Select HS Code</option>
        {hsCodeOptions.map((hsItem) => (
          <option key={hsItem.value} value={hsItem.value}>
            {hsItem.label} 
          </option>
        ))}
      </select>
      {renderFbrFieldError("hsCode", index)}
</div>

                <div className="col-md-6 form-group">
                  <label>Product Description</label>
                 {item.productDescription && item.productDescription.split(' ').length > 7 ? (
      <textarea
        className={fieldClassName("invoice-input form-control", "productDescription", index)}
        name="productDescription"
        value={item.productDescription}
        onChange={(e) => handleInputChange(e, "productDescription", index)}
        rows={4}
      />
    ) : (
      <input
        type="text"
        className={fieldClassName("invoice-input form-control", "productDescription", index)}
        name="productDescription"
        value={item.productDescription}
        onChange={(e) => handleInputChange(e, "productDescription", index)}
      />
    )}
    {renderFbrFieldError("productDescription", index)}
                  
                </div>
              </div>

              <div className="row">
                <div className="col-md-6 form-group">
                  <label>Rate</label>
                   {salesTaxOptions.length > 0 ? (
                    <select
                      className={fieldClassName("invoice-input form-control", "rate", index)}
                      name="rate"
                      value={item.rate}
                      onChange={(e) => handleInputChange(e, "rate", index)}
                    >
                      <option value="" disabled selected>Select Sales Tax Rate</option>
                      {salesTaxOptions.map((rate, i) => (
                        <option key={i} value={rate}>
                          {rate}%
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      className={fieldClassName("invoice-input form-control", "rate", index)}
                      name="rate"
                      value={item.rate}
                      onChange={(e) => handleInputChange(e, "rate", index)}
                    />
                  )} 
                  {renderFbrFieldError("rate", index)}


                  {/* <input
                    type="text"
                    className="invoice-input form-control"
                    name="rate"
                    value={item.rate}
                    onChange={(e) => handleInputChange(e, "rate", index)}
                  /> */}
                </div>

               <div className="col-md-6 form-group">
  <label>Unit of Measure</label>
  <select
    className={fieldClassName("invoice-input form-control", "uoM", index)}
    name="uoM"
    value={item.uoM}
    onChange={(e) => handleInputChange(e, "uoM", index)}
  >
    <option value="" disabled>Select Unit</option>
    {uomOptions.map((uom) => (
      <option key={uom.value} value={uom.value}>
        {uom.label}
      </option>
    ))}
  </select>
  {renderFbrFieldError("uoM", index)}
</div>
              </div>

              <div className="row">
                <div className="col-md-6 form-group">
                  <label>Quantity</label>
                  <input
                    type="number"
                    className={fieldClassName("invoice-input form-control", "quantity", index)}
                    name="quantity"
                    value={item.quantity}
                    onChange={(e) => handleInputChange(e, "quantity", index)}
                  />
                  {renderFbrFieldError("quantity", index)}
                </div>

                <div className="col-md-6 form-group">
                  <label>Total Values</label>
                  <input
                    type="number"
                    className={fieldClassName("invoice-input form-control", "totalValues", index)}
                    name="totalValues"
                    disabled
                    value={item.totalValues}
                    onChange={(e) => handleInputChange(e, "totalValues", index)}
                    readOnly
                  />
                  {renderFbrFieldError("totalValues", index)}
                </div>
              </div>

              <div className="row">
                <div className="col-md-6 form-group">
                  <label>Value Sales Excluding ST</label>
                  <input
                    type="number"
                    className={fieldClassName("invoice-input form-control", "valueSalesExcludingST", index)}
                    name="valueSalesExcludingST"
                    value={item.valueSalesExcludingST}
                    onChange={(e) => handleInputChange(e, "valueSalesExcludingST", index)}
                  />
                  {renderFbrFieldError("valueSalesExcludingST", index)}
                </div>

                <div className="col-md-6 form-group">
                  <label>Fixed Notified Value</label>
                  <input
  type="number"
  className={fieldClassName("invoice-input form-control", "fixedNotifiedValueOrRetailPrice", index)}
  name="fixedNotifiedValueOrRetailPrice"
  value={item.fixedNotifiedValueOrRetailPrice || ''}
   onChange={(e) => handleInputChange(e, "fixedNotifiedValueOrRetailPrice", index)}
/>
                  {renderFbrFieldError("fixedNotifiedValueOrRetailPrice", index)}
                </div>
              </div>

              <div className="row">
                <div className="col-md-6 form-group">
                  <label>Sales Tax Applicable</label>
                  <input
                      type="number"
                      disabled
                      className={fieldClassName("invoice-input form-control", "salesTaxApplicable", index)}
                      name="salesTaxApplicable"
                      value={item.salesTaxApplicable}
                      onChange={(e) => handleInputChange(e, "salesTaxApplicable", index)}
                    />
                  {renderFbrFieldError("salesTaxApplicable", index)}
                </div>

                <div className="col-md-6 form-group">
                  <label>Sales Tax Withheld At Source</label>
                  <input
                    type="number"
                    disabled
                    className={fieldClassName("invoice-input form-control", "salesTaxWithheldAtSource", index)}
                    name="salesTaxWithheldAtSource"
                    value={item.salesTaxWithheldAtSource}
                    onChange={(e) => handleInputChange(e, "salesTaxWithheldAtSource", index)}
                  />
                  {renderFbrFieldError("salesTaxWithheldAtSource", index)}
                </div>
              </div>

              <div className="row">
                <div className="col-md-6 form-group">
                  <label>Extra Tax</label>
                  <input
                    type="text"
                     disabled
                    className={fieldClassName("invoice-input form-control", "extraTax", index)}
                    name="extraTax"
                    value={item.extraTax}
                    onChange={(e) => handleInputChange(e, "extraTax", index)}
                  />
                  {renderFbrFieldError("extraTax", index)}
                </div>

                <div className="col-md-6 form-group">
                  <label>Further Tax</label>
                  <input
                    type="number"
                    disabled
                    className={fieldClassName("invoice-input form-control", "furtherTax", index)}
                    name="furtherTax"
                    value={item.furtherTax}
                    onChange={(e) => handleInputChange(e, "furtherTax", index)}
                  />
                  {renderFbrFieldError("furtherTax", index)}
                </div>
              </div>

              <div className="row">
                <div className="col-md-6 form-group">
                  <label>SRO Schedule No</label>
                  <input
                    type="text"
                    className={fieldClassName("invoice-input form-control", "sroScheduleNo", index)}
                    name="sroScheduleNo"
                    value={item.sroScheduleNo}
                    onChange={(e) => handleInputChange(e, "sroScheduleNo", index)}
                  />
                  {renderFbrFieldError("sroScheduleNo", index)}
                </div>

                <div className="col-md-6 form-group">
                  <label>FED Payable</label>
                  <input
                    type="number"
                    className={fieldClassName("invoice-input form-control", "fedPayable", index)}
                    name="fedPayable"
                    value={item.fedPayable}
                    onChange={(e) => handleInputChange(e, "fedPayable", index)}
                  />
                  {renderFbrFieldError("fedPayable", index)}
                </div>
              </div>

              <div className="row">
                <div className="col-md-6 form-group">
                  <label>Discount</label>
                  <input
                    type="number"
                    className={fieldClassName("invoice-input form-control", "discount", index)}
                    name="discount"
                    value={item.discount}
                    onChange={(e) => handleInputChange(e, "discount", index)}
                  />
                  {renderFbrFieldError("discount", index)}
                </div>

                <div className="col-md-6 form-group">
  <label>Sale Type</label>
  <select
    className={fieldClassName("invoice-input form-control", "saleType", index)}
    name="saleType"
    value={item.saleType}
    onChange={(e) => handleInputChange(e, "saleType", index)}
  >
    <option value="" disabled>Select Sale Type</option>
    {saleTypeOptions.map((saleType) => (
      <option key={saleType.value} value={saleType.value}>
        {saleType.label}
      </option>
    ))}
  </select>
  {renderFbrFieldError("saleType", index)}
</div>
              </div>

              <div className="row">
                <div className="col-md-6 form-group">
                  <label>SRO Item Serial No</label>
                  <select
                    className={fieldClassName("invoice-input form-control", "sroItemSerialNo", index)}
                    name="sroItemSerialNo"
                    value={item.sroItemSerialNo}
                    onChange={(e) => handleInputChange(e, "sroItemSerialNo", index)}
                  >
                    <option value="">Select SRO Item</option>
                    {sroItemCodeOptions.map((sroItem) => (
                      <option key={sroItem.value} value={sroItem.value}>
                        {sroItem.label}
                      </option>
                    ))}
                  </select>
                  {renderFbrFieldError("sroItemSerialNo", index)}
                </div>
              </div>
            </div>
          ))}

          {/* NEW: Show combined Total value of items when more than one item exists */}
          {invoiceData.items.length > 1 && (
            <div className="item-row p-4">
              <div className="row">
                <div className="col-md-6 form-group">
                  <label>Total value of items</label>
                  <input
                    type="number"
                    className="invoice-input form-control"
                    value={itemsTotalValue.toFixed(2)}
                    readOnly
                    disabled
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        {submitSuccess && (
          <div className="alert alert-success">
            Invoice submitted successfully!
            {fbrInvoiceNumber && (
              <div className="mt-1 small fw-semibold">FBR Invoice No: {fbrInvoiceNumber}</div>
            )}
          </div>
        )}

        {offlineQueueSuccess && (
          <div className="alert alert-info">
            {offlineQueueSuccess}
            <div className="mt-2">
              <Link to="/invoice/offline-queue" className="btn btn-sm btn-outline-primary">
                View Offline Queue
              </Link>
            </div>
          </div>
        )}

        {/* B11 — 401: token expired / invalid */}
        {submitErrorType === '401' && (
          <div className="alert alert-danger">
            <strong>Token Expired or Invalid</strong>
            <p className="mb-2 mt-1">
              Your FBR API token has expired or is not recognised. Invoices cannot be submitted until a valid token is saved.
            </p>
            <Link to="/settings" className="btn btn-sm btn-danger">
              Update Token in Settings
            </Link>
          </div>
        )}

        {/* B12 — 500: server error; data preserved */}
        {submitErrorType === '500' && (
          <div className="alert alert-warning">
            <strong>FBR Server Error</strong>
            <p className="mb-1 mt-1">
              The FBR server returned an error. <strong>Your invoice data has been preserved in the form</strong> — you can retry without re-entering anything.
            </p>
            {submitError && (
              <div className="small text-muted">Server detail: {submitError}</div>
            )}
          </div>
        )}

        {/* General errors (validation, network, etc.) */}
        {submitError && !submitErrorType && (
          <div className="alert alert-danger">
            {submitError}
          </div>
        )}
        <div className="add-invoice-actions">
          <button className="btn buttonsave" onClick={handlePrintInvoice}>Print Invoice</button>
          <button className="btn buttonsave" onClick={handleDownloadPdf}>Download PDF</button>
          <button className="btn buttonsave" onClick={handlePreviewFormattedPayload} disabled={isFormattingInvoice}>
            {isFormattingInvoice ? "Formatting..." : "Preview FBR Payload"}
          </button>
          <button
            className="btn buttonsubmitinvoice"
            onClick={handleSubmitInvoice}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Invoice'}
          </button>
        </div>
      </div>
        </div>

        <aside className="add-invoice-side-rail" aria-label="Invoice review summary">
          <section className="add-invoice-rail-card">
            <div className="add-invoice-rail-header">
              <div>
                <span>Live Summary</span>
                <h2>Invoice Review</h2>
              </div>
              <strong>{isOffline ? "Queue" : "Live"}</strong>
            </div>

            <div className="add-invoice-check-list">
              <div className={`add-invoice-check ${invoiceData.invoiceType && invoiceData.invoiceDate ? "ok" : "pending"}`}>
                Invoice details {invoiceData.invoiceType && invoiceData.invoiceDate ? "filled" : "pending"}
              </div>
              <div className={`add-invoice-check ${invoiceData.buyerNTNCNIC && invoiceData.buyerBusinessName ? "ok" : "pending"}`}>
                Buyer information {invoiceData.buyerNTNCNIC && invoiceData.buyerBusinessName ? "set" : "needed"}
              </div>
              <div className={`add-invoice-check ${invoiceData.items.length > 0 ? "ok" : "pending"}`}>
                {invoiceData.items.length} line item{invoiceData.items.length === 1 ? "" : "s"} added
              </div>
              <div className={`add-invoice-check ${headerFbrErrors.length || fbrValidationErrors.length ? "pending" : "ok"}`}>
                FBR validation {headerFbrErrors.length || fbrValidationErrors.length ? "needs review" : "ready"}
              </div>
            </div>

            <div className="add-invoice-rail-divider" />

            <div className="add-invoice-rail-row">
              <span>Scenario</span>
              <strong>{invoiceData.scenarioId || "Not selected"}</strong>
            </div>
            <div className="add-invoice-rail-row">
              <span>Reference</span>
              <strong>{invoiceData.invoiceRefNo || "Draft"}</strong>
            </div>
            <div className="add-invoice-rail-row total">
              <span>Grand Total</span>
              <strong>PKR {itemsTotalValue.toFixed(2)}</strong>
            </div>

            <button
              className="add-invoice-rail-submit"
              type="button"
              onClick={handleSubmitInvoice}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit to FBR"}
            </button>
            <button
              className="add-invoice-rail-save"
              type="button"
              onClick={handlePreviewFormattedPayload}
              disabled={isFormattingInvoice}
            >
              {isFormattingInvoice ? "Formatting..." : "Preview FBR Payload"}
            </button>
          </section>

          <section className="add-invoice-rail-card add-invoice-fbr-card">
            <div className="add-invoice-fbr-title">FBR Integration</div>
            <div className="add-invoice-rail-row">
              <span>Connection</span>
              <strong className={isOffline ? "danger" : "success"}>{isOffline ? "Offline" : "Online"}</strong>
            </div>
            <div className="add-invoice-rail-row">
              <span>Payload</span>
              <strong>{formattedInvoicePreview ? "Prepared" : "Not previewed"}</strong>
            </div>
            <div className="add-invoice-rail-row">
              <span>Items</span>
              <strong>{invoiceData.items.length}</strong>
            </div>
          </section>

          <section className="add-invoice-rail-card add-invoice-quick-links">
            <div className="add-invoice-fbr-title">Quick Links</div>
            <Link to="/customers">View All Customers</Link>
            <Link to="/products">Product Catalog</Link>
            <Link to="/invoice/upload">Upload CSV Instead</Link>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default AddInvoice;
