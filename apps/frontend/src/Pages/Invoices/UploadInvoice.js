import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LuUpload } from 'react-icons/lu';
import { PiDownloadSimpleBold } from 'react-icons/pi';
import { FiArrowRight, FiCheckCircle, FiFileText } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import useBlockBackButton from '../../Components/useBlockBackButton';
import './UploadInvoice.css';

// Required column headers in the Excel file
const REQUIRED_COLS = [
  'Invoice Ref No', 'Invoice Type', 'Invoice Date',
  'Seller NTN/CNIC', 'Seller Business Name', 'Seller Province', 'Seller Address',
  'Buyer NTN/CNIC', 'Buyer Business Name', 'Buyer Province', 'Buyer Address', 'Buyer Registration Type',
  'HS Code', 'Product Description', 'Sale Type', 'UOM', 'Quantity', 'Rate',
  'Value Excl ST', 'Sales Tax',
];

const OPTIONAL_COLS = ['Further Tax', 'Extra Tax', 'FED Payable', 'Discount', 'SRO Schedule No'];

// Sample data rows for the downloadable template
const SAMPLE_ROWS = [
  {
    'Invoice Ref No': 'INV-2026-001',
    'Invoice Type': 'Sale Invoice',
    'Invoice Date': '2026-05-07',
    'Seller NTN/CNIC': '0788762',
    'Seller Business Name': 'YOUR COMPANY NAME',
    'Seller Province': '7',
    'Seller Address': 'Your Address, City',
    'Buyer NTN/CNIC': '0123456',
    'Buyer Business Name': 'BUYER COMPANY LTD',
    'Buyer Province': '7',
    'Buyer Address': 'Buyer Address, City',
    'Buyer Registration Type': 'Registered',
    'HS Code': '8432.1010',
    'Product Description': 'Industrial Machinery Parts',
    'Sale Type': 'Goods at standard rate (default)',
    'UOM': 'KG',
    'Quantity': 10,
    'Rate': '18%',
    'Value Excl ST': 100000,
    'Sales Tax': 18000,
    'Further Tax': 0,
    'Extra Tax': 0,
    'FED Payable': 0,
    'Discount': 0,
    'SRO Schedule No': '',
  },
  {
    'Invoice Ref No': 'INV-2026-001',
    'Invoice Type': 'Sale Invoice',
    'Invoice Date': '2026-05-07',
    'Seller NTN/CNIC': '0788762',
    'Seller Business Name': 'YOUR COMPANY NAME',
    'Seller Province': '7',
    'Seller Address': 'Your Address, City',
    'Buyer NTN/CNIC': '0123456',
    'Buyer Business Name': 'BUYER COMPANY LTD',
    'Buyer Province': '7',
    'Buyer Address': 'Buyer Address, City',
    'Buyer Registration Type': 'Registered',
    'HS Code': '8432.2020',
    'Product Description': 'Spare Parts - Second Item',
    'Sale Type': 'Goods at standard rate (default)',
    'UOM': 'KG',
    'Quantity': 5,
    'Rate': '18%',
    'Value Excl ST': 50000,
    'Sales Tax': 9000,
    'Further Tax': 0,
    'Extra Tax': 0,
    'FED Payable': 0,
    'Discount': 0,
    'SRO Schedule No': '',
  },
  {
    'Invoice Ref No': 'INV-2026-002',
    'Invoice Type': 'Sale Invoice',
    'Invoice Date': '2026-05-07',
    'Seller NTN/CNIC': '0788762',
    'Seller Business Name': 'YOUR COMPANY NAME',
    'Seller Province': '7',
    'Seller Address': 'Your Address, City',
    'Buyer NTN/CNIC': '9876543',
    'Buyer Business Name': 'SECOND BUYER CO',
    'Buyer Province': '8',
    'Buyer Address': 'Karachi Address',
    'Buyer Registration Type': 'Registered',
    'HS Code': '3304.1000',
    'Product Description': 'Chemical Products',
    'Sale Type': 'Goods at standard rate (default)',
    'UOM': 'LTR',
    'Quantity': 100,
    'Rate': '18%',
    'Value Excl ST': 200000,
    'Sales Tax': 36000,
    'Further Tax': 0,
    'Extra Tax': 0,
    'FED Payable': 0,
    'Discount': 0,
    'SRO Schedule No': '',
  },
];

function downloadTemplate() {
  const ws = XLSX.utils.json_to_sheet(SAMPLE_ROWS, {
    header: [...REQUIRED_COLS, ...OPTIONAL_COLS],
  });
  ws['!cols'] = [...REQUIRED_COLS, ...OPTIONAL_COLS].map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
  XLSX.writeFile(wb, 'FBR_Invoice_Upload_Template.xlsx');
}

function validateRow(row, index) {
  const errors = [];
  for (const col of REQUIRED_COLS) {
    const val = row[col];
    if (val === undefined || val === null || String(val).trim() === '') {
      errors.push(`"${col}" is required`);
    }
  }
  const qty = parseFloat(row['Quantity']);
  if (isNaN(qty) || qty <= 0) errors.push('"Quantity" must be a positive number');
  const vst = parseFloat(row['Value Excl ST']);
  if (isNaN(vst) || vst < 0) errors.push('"Value Excl ST" must be a non-negative number');
  const st = parseFloat(row['Sales Tax']);
  if (isNaN(st) || st < 0) errors.push('"Sales Tax" must be a non-negative number');
  if (!row['Invoice Date'] || isNaN(Date.parse(String(row['Invoice Date'])))) {
    errors.push('"Invoice Date" must be a valid date (YYYY-MM-DD)');
  }
  return errors;
}

function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (rows.length === 0) { reject(new Error('The file is empty.')); return; }

        // Validate headers
        const headers = Object.keys(rows[0]);
        const missing = REQUIRED_COLS.filter(c => !headers.includes(c));
        if (missing.length > 0) {
          reject(new Error(`Missing required columns: ${missing.join(', ')}`)); return;
        }

        // Validate each row and group by Invoice Ref No
        const invoiceMap = new Map();
        rows.forEach((row, i) => {
          const errors = validateRow(row, i);
          const ref = String(row['Invoice Ref No'] || '').trim() || `row-${i + 2}`;

          if (!invoiceMap.has(ref)) {
            invoiceMap.set(ref, {
              invoiceRefNo: ref,
              invoiceType: String(row['Invoice Type'] || 'Sale Invoice'),
              invoiceDate: String(row['Invoice Date']).slice(0, 10),
              sellerNTNCNIC: String(row['Seller NTN/CNIC']),
              sellerBusinessName: String(row['Seller Business Name']),
              sellerProvince: String(row['Seller Province']),
              sellerAddress: String(row['Seller Address']),
              buyerNTNCNIC: String(row['Buyer NTN/CNIC']),
              buyerBusinessName: String(row['Buyer Business Name']),
              buyerProvince: String(row['Buyer Province']),
              buyerAddress: String(row['Buyer Address']),
              buyerRegistrationType: String(row['Buyer Registration Type'] || 'Registered'),
              items: [],
              errors: [],
              rowNumbers: [],
            });
          }

          const inv = invoiceMap.get(ref);
          inv.errors.push(...errors.map(e => `Row ${i + 2}: ${e}`));
          inv.rowNumbers.push(i + 2);
          inv.items.push({
            hsCode: String(row['HS Code']),
            productDescription: String(row['Product Description']),
            saleType: String(row['Sale Type']),
            uoM: String(row['UOM']),
            quantity: parseFloat(row['Quantity']) || 0,
            rate: String(row['Rate']),
            valueSalesExcludingST: parseFloat(row['Value Excl ST']) || 0,
            salesTaxApplicable: parseFloat(row['Sales Tax']) || 0,
            furtherTax: parseFloat(row['Further Tax']) || 0,
            extraTax: parseFloat(row['Extra Tax']) || 0,
            fedPayable: parseFloat(row['FED Payable']) || 0,
            discount: parseFloat(row['Discount']) || 0,
            sroScheduleNo: String(row['SRO Schedule No'] || ''),
            salesTaxWithheldAtSource: 0,
            fixedNotifiedValueOrRetailPrice: 0,
            totalValues: (parseFloat(row['Value Excl ST']) || 0) + (parseFloat(row['Sales Tax']) || 0),
          });
        });

        resolve(Array.from(invoiceMap.values()));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsArrayBuffer(file);
  });
}

export default function UploadInvoice() {
  useBlockBackButton();
  const navigate = useNavigate();
  const [fileName, setFileName] = useState('');
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef();

  const handleFile = (f) => {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (ext !== 'xlsx') { setParseError('Please upload a .xlsx file.'); return; }
    setFileName(f.name);
    setFile(f);
    setParseError('');
  };

  const handleNext = async () => {
    if (!file) { setParseError('Please select a file first.'); return; }
    setParsing(true);
    setParseError('');
    try {
      const invoices = await parseExcel(file);
      sessionStorage.setItem('upload_invoices', JSON.stringify(invoices));
      navigate('/invoice/upload/preview');
    } catch (err) {
      setParseError(err.message || 'Failed to parse file.');
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="upload-invoice-page">
      <div className="upload-invoice-header">
        <div>
          <span>Bulk invoice import</span>
          <h1>Upload Invoice</h1>
          <p>Import Excel rows, validate invoice groups, then preview before submission to FBR.</p>
        </div>

        <div className="upload-invoice-header__actions">
          <Link to="/invoice" className="upload-invoice-secondary-action">Back to invoices</Link>
          <button className="upload-invoice-secondary-action" onClick={downloadTemplate}>
            <PiDownloadSimpleBold size={18} /> Download template
          </button>
        </div>
      </div>

      <div className="upload-invoice-steps">
        <div className="upload-invoice-step active"><div className="upload-invoice-step__dot">1</div><span>Upload File</span></div>
        <div className="upload-invoice-step__line" />
        <div className="upload-invoice-step"><div className="upload-invoice-step__dot">2</div><span>Validate</span></div>
        <div className="upload-invoice-step__line" />
        <div className="upload-invoice-step"><div className="upload-invoice-step__dot">3</div><span>Review &amp; Confirm</span></div>
        <div className="upload-invoice-step__line" />
        <div className="upload-invoice-step"><div className="upload-invoice-step__dot">4</div><span>Submit</span></div>
      </div>

      <div className="upload-invoice-summary">
        <div>
          <span>File type</span>
          <strong>.xlsx only</strong>
        </div>
        <div>
          <span>Required columns</span>
          <strong>{REQUIRED_COLS.length}</strong>
        </div>
        <div>
          <span>Optional columns</span>
          <strong>{OPTIONAL_COLS.length}</strong>
        </div>
        <div>
          <span>Selected file</span>
          <strong>{fileName || 'None'}</strong>
        </div>
      </div>

      <section className="upload-invoice-workspace">
        <div className="upload-invoice-panel upload-invoice-drop-panel">
          <div className="upload-invoice-panel__top">
            <div>
              <h2>Upload spreadsheet</h2>
              <p>Use the template so column names match the parser exactly.</p>
            </div>
          </div>

          <button
            type="button"
            className={`upload-invoice-dropzone ${isDragging ? 'is-dragging' : ''} ${fileName ? 'has-file' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFile(e.dataTransfer.files[0]);
            }}
          >
            <input
              type="file"
              accept=".xlsx"
              ref={inputRef}
              onChange={(e) => handleFile(e.target.files[0])}
            />
            <span className="upload-invoice-dropzone__icon">
              {fileName ? <FiCheckCircle size={34} /> : <LuUpload size={36} />}
            </span>
            {fileName ? (
              <>
                <strong>{fileName}</strong>
                <small>Click to choose a different spreadsheet</small>
              </>
            ) : (
              <>
                <strong>Drag and drop your Excel file here</strong>
                <small>Accepts .xlsx files only</small>
              </>
            )}
          </button>

          {parseError && <div className="upload-invoice-error">{parseError}</div>}

          <div className="upload-invoice-actions">
            <button
              className="upload-invoice-primary-action"
              onClick={handleNext}
              disabled={!file || parsing}
            >
              {parsing
                ? <><span className="spinner-border spinner-border-sm" role="status" /> Parsing...</>
                : <><FiArrowRight size={17} /> Continue to preview</>}
            </button>
          </div>
        </div>

        <aside className="upload-invoice-side-panel">
          <div>
            <FiFileText size={22} />
            <h2>Template rules</h2>
            <p>Each row is one line item. Reuse the same Invoice Ref No to group multiple line items into one invoice.</p>
          </div>
          <button className="upload-invoice-template-card" onClick={downloadTemplate}>
            <PiDownloadSimpleBold size={22} />
            <span>
              <strong>FBR_Invoice_Upload_Template.xlsx</strong>
              <small>Download the sample workbook</small>
            </span>
          </button>
        </aside>
      </section>

      <section className="upload-invoice-panel">
        <div className="upload-invoice-panel__top">
          <div>
            <h2>Excel Format Guide</h2>
            <p>Column names must match the template. Required fields are checked before preview.</p>
          </div>
        </div>

        <div className="upload-invoice-table-wrap">
          <table className="upload-invoice-table">
            <thead>
              <tr><th>Column</th><th>Required</th><th>Example</th></tr>
            </thead>
            <tbody>
              {[
                ['Invoice Ref No', 'Yes', 'INV-2026-001'],
                ['Invoice Type', 'Yes', 'Sale Invoice'],
                ['Invoice Date', 'Yes', '2026-05-07'],
                ['Seller NTN/CNIC', 'Yes', '0788762'],
                ['Seller Business Name', 'Yes', 'MY COMPANY LTD'],
                ['Seller Province', 'Yes', '7 (Punjab)'],
                ['Buyer Business Name', 'Yes', 'BUYER CO'],
                ['HS Code', 'Yes', '8432.1010'],
                ['Sale Type', 'Yes', 'Goods at standard rate (default)'],
                ['UOM', 'Yes', 'KG'],
                ['Quantity', 'Yes', '10'],
                ['Rate', 'Yes', '18%'],
                ['Value Excl ST', 'Yes', '100000'],
                ['Sales Tax', 'Yes', '18000'],
                ['Further Tax / Extra Tax / FED Payable / Discount', 'No', '0'],
              ].map(([col, req, ex]) => (
                <tr key={col}>
                  <td className="upload-invoice-mono">{col}</td>
                  <td><span className={`upload-invoice-required ${req === 'Yes' ? 'danger' : 'neutral'}`}>{req === 'Yes' ? 'Required' : 'Optional'}</span></td>
                  <td>{ex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
