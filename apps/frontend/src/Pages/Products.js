import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { FiDownload, FiEdit, FiRefreshCw, FiSearch, FiTrash2, FiUpload } from 'react-icons/fi';
import { LuEye } from 'react-icons/lu';
import useBlockBackButton from '../Components/useBlockBackButton';
import { FaPlus } from 'react-icons/fa6';
import { hsCodes, hsCodeLookup } from '../Components/hsCodes';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getCompanyProfile } from '../services/companyProfileApi';
import { getFbrReferenceBootstrap } from '../services/fbrReferenceApi';
import {
  bulkImportProductMappings,
  createProductMapping,
  deleteProductMapping,
  getProductMapping,
  getProductMappings,
  resolveHsInvoiceFields,
  searchHsCodeSuggestions,
  updateProductMapping,
} from '../services/fbrProductMappingsApi';
import './Products.css';

/* ─── helpers ─────────────────────────────────────────────── */
const avatarTones = ['av-p', 'av-b', 'av-g', 'av-o', 'av-s'];

function initialsOf(name) {
  const words = String(name || '').trim().split(/[\s—\-]+/);
  return ((words[0]?.[0] || '') + (words[1]?.[0] || '')).toUpperCase() || 'PR';
}

function toneFor(id, name) {
  const key = String(id || '') + String(name || '');
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) & 0xffff;
  return avatarTones[h % avatarTones.length];
}

function downloadProductsCsv(rows) {
  if (!rows.length) return;
  const cols = ['Product Name', 'HS Code', 'Description', 'Tax Rate', 'UoM', 'In Stock', 'Status', 'Sale Type', 'SRO Schedule'];
  const lines = [cols.join(',')];
  rows.forEach(p => {
    lines.push([
      `"${productName(p)}"`,
      `"${productHsCode(p)}"`,
      `"${productDescription(p)}"`,
      productRate(p),
      `"${productUom(p)}"`,
      productStock(p),
      `"${productStatus(p)}"`,
      `"${productSaleType(p)}"`,
      `"${p.sro_schedule_no || p.sroScheduleNo || ''}"`,
    ].join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'products.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── constants ────────────────────────────────────────────── */
const emptyProductForm = {
  product_name: '',
  rate: '',
  unit_of_measure: '',
  hs_code: '',
  in_stock: '',
  tax: 0,
  tax_type: String(' '),
  description: '',
  status: 'Active',
  sale_type: 'Goods at standard rate (default)',
  sro_schedule_no: '',
  further_tax_applicable: false,
  extra_tax_applicable: false,
};

const emptyReferenceData = { hsCodes: [], uoms: [], transactionTypes: [] };

const importColumnAliases = {
  productName: ['productName', 'product_name', 'product name', 'name', 'product'],
  hsCode: ['hsCode', 'hs_code', 'hs code', 'hscode'],
  hsDescription: ['hsDescription', 'hs_description', 'description', 'hs description', 'product description'],
  salesTaxRate: ['salesTaxRate', 'sales_tax_rate', 'sales tax rate', 'rate', 'tax rate'],
  unitOfMeasurement: ['unitOfMeasurement', 'unit_of_measure', 'unit of measure', 'unit_of_measurement', 'uom', 'uoM'],
  inStock: ['inStock', 'in_stock', 'in stock', 'stock'],
  saleType: ['saleType', 'sale_type', 'sale type', 'transaction type'],
  sroScheduleNo: ['sroScheduleNo', 'sro_schedule_no', 'sro schedule no', 'sro'],
  status: ['status', 'active'],
  furtherTaxApplicable: ['furtherTaxApplicable', 'further_tax_applicable', 'further tax applicable'],
  extraTaxApplicable: ['extraTaxApplicable', 'extra_tax_applicable', 'extra tax applicable'],
};

const unwrapReferenceList = (entry) => Array.isArray(entry?.data) ? entry.data : [];

const productFormToPayload = (formData) => ({
  productName: formData.product_name,
  hsCode: formData.hs_code,
  hsDescription: formData.description,
  salesTaxRate: Number(formData.rate) || 0,
  unitOfMeasurement: formData.unit_of_measure,
  inStock: formData.in_stock,
  sroScheduleNo: formData.sro_schedule_no,
  saleType: formData.sale_type,
  furtherTaxApplicable: Boolean(formData.further_tax_applicable),
  extraTaxApplicable: Boolean(formData.extra_tax_applicable),
  status: formData.status,
});

const productName = (p) => p.product_name || p.productName || '';
const productRate = (p) => p.rate ?? p.salesTaxRate ?? '';
const productStock = (p) => p.in_stock ?? p.inStock ?? '';
const productHsCode = (p) => p.hs_code || p.hsCode || '';
const productUom = (p) => p.unit_of_measure || p.unitOfMeasurement || '';
const productDescription = (p) => p.description || p.hsDescription || '';
const productStatus = (p) => p.status || 'Active';
const productSaleType = (p) => p.sale_type || p.saleType || '';

const isOutOfStock = (p) => {
  const s = productStock(p);
  return s !== '' && s !== null && s !== undefined && parseInt(s, 10) === 0;
};

const getDisplayStatus = (p) => {
  if (isOutOfStock(p)) return 'Out of Stock';
  return productStatus(p);
};

const normalizeHeader = (v) => String(v || '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');
const normalizeHs = (v) => String(v || '').trim().replace(/\s+/g, '').toLowerCase();

const getImportCell = (row, field) => {
  const aliases = importColumnAliases[field] || [field];
  const normalized = Object.entries(row).reduce((acc, [k, v]) => { acc[normalizeHeader(k)] = v; return acc; }, {});
  for (const alias of aliases) {
    const val = normalized[normalizeHeader(alias)];
    if (val !== undefined && val !== null && String(val).trim() !== '') return String(val).trim();
  }
  return '';
};

const parseImportBoolean = (v) => ['true', 'yes', 'y', '1'].includes(String(v || '').trim().toLowerCase());

/* ─── component ────────────────────────────────────────────── */
function Products() {
  useBlockBackButton();

  const [products, setProducts] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [formData, setFormData] = useState(emptyProductForm);
  const [referenceData, setReferenceData] = useState(emptyReferenceData);
  const [sellerProvince, setSellerProvince] = useState('');
  const [hsSearch, setHsSearch] = useState('');
  const [hsSuggestions, setHsSuggestions] = useState([]);
  const [productNotice, setProductNotice] = useState('');
  const [apiError, setApiError] = useState('');
  const [importError, setImportError] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [importRows, setImportRows] = useState([]);
  const [importResult, setImportResult] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [selectedIds, setSelectedIds] = useState([]);
  const [viewingProduct, setViewingProduct] = useState(null);
  const [loading, setLoading] = useState({
    add: false, edit: false, delete: false, fetch: false,
    fetchSingle: false, fetchSingleEdit: false, fetchSingleView: false,
    hsSearch: false, autofill: false, import: false,
  });
  const itemsPerPage = 8;
  const modalRef = useRef();

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetchProducts();
    loadProductReferences();
    loadSellerProfile();
  }, []);

  /* ─── API functions ─────── */
  const fetchProducts = async () => {
    try {
      setLoading(prev => ({ ...prev, fetch: true }));
      const data = await getProductMappings({ limit: 250 });
      setProducts(data);
      setApiError('');
      return data;
    } catch (error) {
      console.error('Failed to fetch products:', error);
      setApiError(error.response?.data?.error || 'Failed to fetch product mappings.');
      return [];
    } finally {
      setLoading(prev => ({ ...prev, fetch: false }));
    }
  };

  const loadProductReferences = async () => {
    try {
      const bootstrap = await getFbrReferenceBootstrap();
      setReferenceData({
        hsCodes: unwrapReferenceList(bootstrap?.itemDescriptions),
        uoms: unwrapReferenceList(bootstrap?.uoms),
        transactionTypes: unwrapReferenceList(bootstrap?.transactionTypes),
      });
    } catch (error) {
      console.error('Failed to load FBR product references:', error);
      setReferenceData(emptyReferenceData);
    }
  };

  useEffect(() => {
    const shouldOpenModal = searchParams.get('modal') === 'open';
    if (shouldOpenModal && modalRef.current) {
      setFormData(emptyProductForm);
      setEditingProduct(null);
      setIsReadOnly(false);
      setApiError('');
      window.bootstrap.Modal.getOrCreateInstance(modalRef.current).show();
      navigate(location.pathname, { replace: true });
    }
  }, [searchParams, navigate, location.pathname]);

  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    const handleHidden = () => {
      document.body.classList.remove('modal-open');
      Array.from(document.getElementsByClassName('modal-backdrop')).forEach(b => b.remove());
    };
    el.addEventListener('hidden.bs.modal', handleHidden);
    return () => el.removeEventListener('hidden.bs.modal', handleHidden);
  }, []);

  const handleShowModal = async (productId = null, viewOnly = false) => {
    if (productId !== null) {
      try {
        setLoading(prev => ({ ...prev, fetchSingle: true, fetchSingleView: viewOnly, fetchSingleEdit: !viewOnly }));
        const product = await getProductMapping(productId);
        setEditingProduct(product);
        setFormData({
          product_name: product.product_name || product.productName || '',
          rate: product.rate ?? product.salesTaxRate ?? '',
          unit_of_measure: product.unit_of_measure || product.unitOfMeasurement || '',
          hs_code: product.hs_code || product.hsCode || '',
          in_stock: product.in_stock || product.inStock || '',
          tax: 0,
          tax_type: product.tax_type || String(' '),
          description: product.description || product.hsDescription || '',
          status: product.status || 'Active',
          sale_type: product.sale_type || product.saleType || 'Goods at standard rate (default)',
          sro_schedule_no: product.sro_schedule_no || product.sroScheduleNo || '',
          further_tax_applicable: Boolean(product.further_tax_applicable ?? product.furtherTaxApplicable),
          extra_tax_applicable: Boolean(product.extra_tax_applicable ?? product.extraTaxApplicable),
        });
        setHsSearch(`${product.hs_code || product.hsCode || ''}${product.description || product.hsDescription ? ` - ${product.description || product.hsDescription}` : ''}`.trim());
        setApiError('');
      } catch (error) {
        console.error('Error fetching product:', error);
        setApiError(error.response?.data?.error || 'Error fetching product mapping.');
      } finally {
        setLoading(prev => ({ ...prev, fetchSingle: false, fetchSingleView: false, fetchSingleEdit: false }));
      }
    } else {
      setFormData(emptyProductForm);
      setEditingProduct(null);
      setHsSearch('');
    }
    setApiError('');
    setProductNotice('');
    setHsSuggestions([]);
    setIsReadOnly(viewOnly);
    window.bootstrap.Modal.getOrCreateInstance(modalRef.current).show();
  };

  const handleInputChange = (e) => {
    const { name, value, checked, type } = e.target;
    const inputValue = type === 'checkbox' ? checked : value;
    if (name === 'hs_code') {
      const selectedHsCode = referenceData.hsCodes.find(item => item.hsCode === inputValue);
      setFormData(prev => ({
        ...prev,
        hs_code: inputValue,
        description: selectedHsCode?.description || hsCodeLookup[inputValue] || prev.description,
        tax: 0,
      }));
      if (inputValue) {
        setHsSearch(`${inputValue}${selectedHsCode?.description || hsCodeLookup[inputValue] ? ` - ${selectedHsCode?.description || hsCodeLookup[inputValue]}` : ''}`);
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: name === 'tax_type' ? String(' ') : inputValue, tax: 0 }));
    }
  };

  const hideModal = () => {
    try {
      const instance = window.bootstrap?.Modal?.getInstance(modalRef.current);
      if (instance) { instance.hide(); return; }
    } catch (e) {}
    if (modalRef.current) {
      modalRef.current.classList.remove('show');
      modalRef.current.style.display = 'none';
    }
    document.body.classList.remove('modal-open');
    Array.from(document.getElementsByClassName('modal-backdrop')).forEach(b => b.remove());
  };

  const handleSave = async () => {
    setApiError('');
    setLoading(prev => ({ ...prev, add: true }));
    try {
      const created = await createProductMapping(productFormToPayload(formData));
      hideModal();
      setFormData(emptyProductForm);
      setEditingProduct(null);
      setCurrentPage(1);
      const refreshed = await fetchProducts();
      setProducts([created, ...refreshed.filter(p => p.id !== created.id)]);
    } catch (error) {
      console.error('Error saving product:', error);
      setApiError(error.response?.data?.error || error.message || 'Error saving product mapping.');
    } finally {
      setLoading(prev => ({ ...prev, add: false }));
    }
  };

  const handleUpdate = async () => {
    setApiError('');
    setLoading(prev => ({ ...prev, edit: true }));
    try {
      await updateProductMapping(editingProduct.id, productFormToPayload(formData));
      hideModal();
      fetchProducts();
    } catch (error) {
      console.error('Error updating product:', error);
      setApiError(error.response?.data?.error || error.message || 'Error updating product mapping.');
    } finally {
      setLoading(prev => ({ ...prev, edit: false }));
    }
  };

  const handleDelete = async (productId) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      setLoading(prev => ({ ...prev, delete: true }));
      try {
        await deleteProductMapping(productId);
        setApiError('');
        if (viewingProduct?.id === productId) setViewingProduct(null);
        setSelectedIds(prev => prev.filter(id => id !== productId));
        fetchProducts();
      } catch (error) {
        console.error('Error deleting product:', error);
        setApiError(error.response?.data?.error || 'Error deleting product mapping.');
      } finally {
        setLoading(prev => ({ ...prev, delete: false }));
        setFormData(prev => ({ ...prev, tax: 0 }));
      }
    }
  };

  const handleHsSearchChange = async (event) => {
    const value = event.target.value;
    setHsSearch(value);
    setProductNotice('');
    if (value.trim().length < 2) { setHsSuggestions([]); return; }
    setLoading(prev => ({ ...prev, hsSearch: true }));
    try {
      const suggestions = await searchHsCodeSuggestions(value.trim(), 12);
      setHsSuggestions(suggestions);
    } catch (error) {
      console.error('Failed to search HS codes:', error);
      setHsSuggestions([]);
      setProductNotice('HS search is unavailable. You can still select a code manually.');
    } finally {
      setLoading(prev => ({ ...prev, hsSearch: false }));
    }
  };

  const selectHsSuggestion = (suggestion) => {
    setFormData(prev => ({ ...prev, hs_code: suggestion.hsCode || '', description: suggestion.description || prev.description }));
    setHsSearch(`${suggestion.hsCode}${suggestion.description ? ` - ${suggestion.description}` : ''}`);
    setHsSuggestions([]);
    setProductNotice('HS code and description filled from FBR reference data.');
  };

  const autofillFbrFields = async () => {
    if (!formData.hs_code) { setProductNotice('Select an HS code before autofill.'); return; }
    setLoading(prev => ({ ...prev, autofill: true }));
    setProductNotice('');
    setApiError('');
    try {
      const resolved = await resolveHsInvoiceFields({
        hsCode: formData.hs_code,
        saleType: formData.sale_type,
        invoiceDate: new Date().toISOString().slice(0, 10),
        originationSupplier: sellerProvince,
      });
      setFormData(prev => ({
        ...prev,
        description: resolved.hsDescription || prev.description,
        sale_type: resolved.saleType || prev.sale_type,
        rate: resolved.salesTaxRate !== undefined && resolved.salesTaxRate !== '' ? resolved.salesTaxRate : prev.rate,
        unit_of_measure: resolved.unitOfMeasurement || prev.unit_of_measure,
      }));
      setHsSearch(`${resolved.hsCode || formData.hs_code}${resolved.hsDescription ? ` - ${resolved.hsDescription}` : ''}`);
      setHsSuggestions([]);
      setProductNotice(resolved.salesTaxRate
        ? 'FBR fields autofilled from HS code, sale type, and seller province.'
        : 'Description and UOM were autofilled. Add seller province in Company Profile for rate lookup if needed.');
    } catch (error) {
      console.error('Failed to autofill product fields:', error);
      setApiError(error.response?.data?.error || error.message || 'Unable to autofill FBR product fields.');
    } finally {
      setLoading(prev => ({ ...prev, autofill: false }));
    }
  };

  const loadSellerProfile = async () => {
    try {
      const profile = await getCompanyProfile();
      setSellerProvince((profile?.province || '').toUpperCase());
    } catch (error) {
      console.error('Failed to load seller profile for product autofill:', error);
      setSellerProvince('');
    }
  };

  const buildImportRows = (rawRows) => {
    const hsReference = referenceData.hsCodes.length
      ? referenceData.hsCodes.map(item => ({ code: item.hsCode, description: item.description }))
      : hsCodes.map(item => ({ code: item.code, description: item.description }));
    const hsReferenceMap = new Map(hsReference.map(item => [normalizeHs(item.code), item]));
    const knownUoms = new Set(uomOptions.map(item => String(item.value).trim().toLowerCase()).filter(Boolean));
    const knownSaleTypes = new Set(saleTypeOptions.map(item => String(item.value).trim().toLowerCase()).filter(Boolean));

    return rawRows
      .filter(row => Object.values(row).some(v => String(v || '').trim() !== ''))
      .map((row, index) => {
        const hsCode = getImportCell(row, 'hsCode');
        const hsMatch = hsReferenceMap.get(normalizeHs(hsCode));
        const payload = {
          productName: getImportCell(row, 'productName'),
          hsCode,
          hsDescription: getImportCell(row, 'hsDescription') || hsMatch?.description || '',
          salesTaxRate: getImportCell(row, 'salesTaxRate'),
          unitOfMeasurement: getImportCell(row, 'unitOfMeasurement'),
          inStock: getImportCell(row, 'inStock'),
          saleType: getImportCell(row, 'saleType') || 'Goods at standard rate (default)',
          sroScheduleNo: getImportCell(row, 'sroScheduleNo'),
          status: getImportCell(row, 'status') || 'Active',
          furtherTaxApplicable: parseImportBoolean(getImportCell(row, 'furtherTaxApplicable')),
          extraTaxApplicable: parseImportBoolean(getImportCell(row, 'extraTaxApplicable')),
        };
        const errors = [];
        if (!payload.productName) errors.push('Product name is required');
        if (!payload.hsCode) errors.push('HS code is required');
        if (payload.hsCode && hsReferenceMap.size > 0 && !hsMatch) errors.push('HS code was not found in loaded FBR references');
        if (!payload.hsDescription) errors.push('Description is required');
        if (!payload.unitOfMeasurement) errors.push('UOM is required');
        if (payload.unitOfMeasurement && knownUoms.size > 0 && !knownUoms.has(payload.unitOfMeasurement.toLowerCase())) errors.push('UOM is not in loaded FBR references');
        if (!payload.saleType) errors.push('Sale type is required');
        if (payload.saleType && knownSaleTypes.size > 0 && !knownSaleTypes.has(payload.saleType.toLowerCase())) errors.push('Sale type is not in loaded FBR references');
        if (payload.salesTaxRate !== '' && Number.isNaN(Number(String(payload.salesTaxRate).replace('%', '')))) errors.push('Sales tax rate must be numeric');
        return {
          rowNumber: index + 2,
          payload: { ...payload, salesTaxRate: payload.salesTaxRate === '' ? 0 : Number(String(payload.salesTaxRate).replace('%', '')) },
          errors,
          status: errors.length ? 'invalid' : 'ready',
        };
      });
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    setImportResult(null);
    setImportError('');
    setImportRows([]);
    setImportFileName(file?.name || '');
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) { setImportError('No worksheet was found in the selected file.'); return; }
      const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: '' });
      const rows = buildImportRows(rawRows);
      if (rows.length === 0) { setImportError('No product rows were found in the selected file.'); return; }
      setImportRows(rows);
    } catch (error) {
      console.error('Failed to parse product import file:', error);
      setImportError('Could not read this file. Please upload a CSV or Excel file.');
    }
  };

  const handleImportProducts = async () => {
    const readyRows = importRows.filter(row => row.status === 'ready');
    if (readyRows.length === 0) { setImportError('No valid rows are ready to import.'); return; }
    setLoading(prev => ({ ...prev, import: true }));
    setImportError('');
    try {
      const result = await bulkImportProductMappings(readyRows.map(row => row.payload));
      const resultByIndex = new Map((result.results || []).map(item => [item.index, item]));
      let ri = 0;
      const rowsWithResult = importRows.map(row => {
        if (row.status !== 'ready') return row;
        const r = resultByIndex.get(ri++);
        if (r?.status === 'created') return { ...row, status: 'created', createdId: r.id };
        return { ...row, status: 'failed', errors: [r?.error || 'Import failed'] };
      });
      setImportRows(rowsWithResult);
      setImportResult({
        total: importRows.length,
        submitted: readyRows.length,
        created: result.created || 0,
        failed: result.failed || 0,
        skipped: importRows.length - readyRows.length,
      });
      await fetchProducts();
    } catch (error) {
      console.error('Failed to import products:', error);
      setImportError(error.response?.data?.error || error.message || 'Product import failed.');
    } finally {
      setLoading(prev => ({ ...prev, import: false }));
    }
  };

  const clearImport = () => {
    setImportRows([]);
    setImportResult(null);
    setImportError('');
    setImportFileName('');
  };

  const downloadImportTemplate = () => {
    const rows = [{
      productName: 'Sample Product',
      hsCode: '0101.2100',
      hsDescription: 'Pure-bred breeding horses',
      salesTaxRate: 18,
      unitOfMeasurement: 'KG',
      inStock: 10,
      saleType: 'Goods at standard rate (default)',
      sroScheduleNo: '',
      status: 'Active',
      furtherTaxApplicable: 'No',
      extraTaxApplicable: 'No',
    }];
    const ws = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ─── bulk actions ─────────────────────────────────────────── */
  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Delete ${selectedIds.length} product(s)?`)) return;
    for (const id of selectedIds) {
      try { await deleteProductMapping(id); } catch (e) { console.error(e); }
    }
    if (viewingProduct && selectedIds.includes(viewingProduct.id)) setViewingProduct(null);
    setSelectedIds([]);
    fetchProducts();
  };

  const handleBulkMarkInactive = async () => {
    if (!selectedIds.length) return;
    const toMark = products.filter(p => selectedIds.includes(p.id));
    for (const p of toMark) {
      try {
        await updateProductMapping(p.id, {
          productName: productName(p),
          hsCode: productHsCode(p),
          hsDescription: productDescription(p),
          salesTaxRate: Number(productRate(p)) || 0,
          unitOfMeasurement: productUom(p),
          inStock: productStock(p),
          sroScheduleNo: p.sro_schedule_no || p.sroScheduleNo || '',
          saleType: productSaleType(p),
          furtherTaxApplicable: Boolean(p.further_tax_applicable ?? p.furtherTaxApplicable),
          extraTaxApplicable: Boolean(p.extra_tax_applicable ?? p.extraTaxApplicable),
          status: 'Inactive',
        });
      } catch (e) { console.error(e); }
    }
    setSelectedIds([]);
    fetchProducts();
  };

  /* ─── selection ────────────────────────────────────────────── */
  const toggleSelectAll = () => {
    const pageIds = paginatedProducts.map(p => p.id);
    const allSelected = pageIds.every(id => selectedIds.includes(id));
    if (allSelected) setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
    else setSelectedIds(prev => [...new Set([...prev, ...pageIds])]);
  };

  const toggleSelectOne = (id) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  /* ─── derived data ─────────────────────────────────────────── */
  const hsCodeOptions = referenceData.hsCodes.length
    ? referenceData.hsCodes.map(item => ({ value: item.hsCode, label: `${item.hsCode}${item.description ? ` - ${item.description}` : ''}` }))
    : hsCodes.map(item => ({ value: item.code, label: `${item.code}${item.description ? ` - ${item.description}` : ''}` }));

  const uomOptions = referenceData.uoms.length
    ? referenceData.uoms.map(u => ({ value: u.description, label: u.description }))
    : [{ value: 'Hour', label: 'Hour' }, { value: 'Kg', label: 'Kg' }, { value: 'unit 5%', label: 'unit 5%' }];

  const saleTypeOptions = referenceData.transactionTypes.length
    ? referenceData.transactionTypes.map(t => ({ value: t.description, label: t.description }))
    : [
        { value: 'Goods at standard rate (default)', label: 'Goods at standard rate (default)' },
        { value: 'Goods at Reduced Rate', label: 'Goods at Reduced Rate' },
        { value: 'Exempt Goods', label: 'Exempt Goods' },
      ];

  const filteredProducts = (products || []).filter(product => {
    if (!product) return false;
    const term = searchTerm.toLowerCase();
    const matchSearch =
      productName(product).toLowerCase().includes(term) ||
      productHsCode(product).toLowerCase().includes(term) ||
      productDescription(product).toLowerCase().includes(term);

    const stock = parseInt(productStock(product) || '-1', 10);
    const status = productStatus(product);
    let matchStatus = true;
    if (statusFilter === 'Active') matchStatus = status === 'Active' && stock !== 0;
    else if (statusFilter === 'Inactive') matchStatus = status === 'Inactive';
    else if (statusFilter === 'OOS') matchStatus = stock === 0;

    return matchSearch && matchStatus;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'Newest': return new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0);
      case 'Oldest': return new Date(a.created_at || a.createdAt || 0) - new Date(b.created_at || b.createdAt || 0);
      case 'A-Z': return productName(a).localeCompare(productName(b));
      case 'Z-A': return productName(b).localeCompare(productName(a));
      case 'Rate-High': return parseFloat(productRate(b) || 0) - parseFloat(productRate(a) || 0);
      case 'Rate-Low': return parseFloat(productRate(a) || 0) - parseFloat(productRate(b) || 0);
      case 'Stock-High': return parseInt(productStock(b) || 0, 10) - parseInt(productStock(a) || 0, 10);
      case 'Stock-Low': return parseInt(productStock(a) || 0, 10) - parseInt(productStock(b) || 0, 10);
      default: return 0;
    }
  });

  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
  const paginatedProducts = sortedProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const pageIds = paginatedProducts.map(p => p.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id));

  const activeCount = products.filter(p => productStatus(p) === 'Active').length;
  const oosCount = products.filter(p => isOutOfStock(p)).length;
  const taxRates = products.map(p => parseFloat(productRate(p))).filter(Number.isFinite);
  const avgTaxRate = taxRates.length ? Math.round(taxRates.reduce((t, r) => t + r, 0) / taxRates.length) : 0;

  const importReadyCount = importRows.filter(r => r.status === 'ready').length;
  const importInvalidCount = importRows.filter(r => r.status === 'invalid').length;
  const importCreatedCount = importRows.filter(r => r.status === 'created').length;
  const importFailedCount = importRows.filter(r => r.status === 'failed').length;

  const Spinner = () => (
    <span className="spinner-border spinner-border-sm" role="status">
      <span className="visually-hidden">Loading…</span>
    </span>
  );

  /* ─── render ───────────────────────────────────────────────── */
  return (
    <div className="prd-page">

      {/* Page header */}
      <div className="prd-page-hdr">
        <div className="prd-page-hdr__left">
          <h2>Products</h2>
          <p>Manage product catalog with HS codes and sales tax mapping for FBR invoices</p>
        </div>
        <div className="prd-page-hdr__right">
          <button className="prd-btn-outline" onClick={() => downloadProductsCsv(sortedProducts)}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
          <button className="prd-btn-primary" onClick={() => handleShowModal()} disabled={loading.add}>
            {loading.add ? <Spinner /> : (
              <>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Product
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mini-stats */}
      <div className="prd-mini-stats">
        <div className="prd-mini-card c-p">
          <div className="prd-mini-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
          </div>
          <div>
            <div className="prd-mini-num">{products.length}</div>
            <div className="prd-mini-lbl">Total Products</div>
          </div>
        </div>
        <div className="prd-mini-card c-g">
          <div className="prd-mini-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div>
            <div className="prd-mini-num">{activeCount}</div>
            <div className="prd-mini-lbl">Active</div>
          </div>
        </div>
        <div className="prd-mini-card c-red">
          <div className="prd-mini-ico" style={{ background: 'rgba(239,68,68,.1)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
          </div>
          <div>
            <div className="prd-mini-num" style={{ color: '#EF4444' }}>{oosCount}</div>
            <div className="prd-mini-lbl">Out of Stock</div>
          </div>
        </div>
        <div className="prd-mini-card c-b">
          <div className="prd-mini-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <div>
            <div className="prd-mini-num">{avgTaxRate}%</div>
            <div className="prd-mini-lbl">Avg Sales Tax Rate</div>
          </div>
        </div>
      </div>

      {/* Bulk Import card */}
      <div className="prd-import-card">
        <div className="prd-import-hdr">
          <div>
            <div className="prd-import-title">Bulk Import</div>
            <div className="prd-import-sub">Upload CSV or Excel, review validation results, then import ready rows</div>
          </div>
          <div className="prd-import-hdr-actions">
            <button className="prd-btn-outline prd-btn-sm" type="button" onClick={downloadImportTemplate}>
              <FiDownload size={13} /> Template
            </button>
            <label className="prd-btn-outline prd-btn-sm prd-upload-lbl">
              <FiUpload size={13} /> Choose file
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleImportFile} />
            </label>
          </div>
        </div>

        {importFileName && (
          <div className="prd-import-summary">
            <div><span>File</span><strong>{importFileName}</strong></div>
            <div><span>Ready</span><strong className="ok">{importReadyCount}</strong></div>
            <div><span>Needs Fix</span><strong className={importInvalidCount ? 'err' : ''}>{importInvalidCount}</strong></div>
            <div><span>Imported</span><strong className="ok">{importCreatedCount}</strong></div>
            <div><span>Failed</span><strong className={importFailedCount ? 'err' : ''}>{importFailedCount}</strong></div>
          </div>
        )}

        {importError && <div className="prd-import-error">{importError}</div>}
        {importResult && (
          <div className={`prd-import-result${importResult.failed ? ' warn' : ' ok'}`}>
            Imported {importResult.created} of {importResult.submitted} submitted rows. {importResult.skipped} invalid row{importResult.skipped === 1 ? '' : 's'} skipped.
          </div>
        )}

        {importRows.length > 0 && (
          <>
            <div className="prd-import-actions">
              <button className="prd-btn-primary prd-btn-sm" type="button" onClick={handleImportProducts} disabled={loading.import || importReadyCount === 0}>
                {loading.import ? <Spinner /> : <><FiUpload size={13} /> Import ready rows</>}
              </button>
              <button className="prd-btn-outline prd-btn-sm" type="button" onClick={clearImport} disabled={loading.import}>Clear</button>
            </div>
            <div className="prd-import-tbl-wrap">
              <table className="prd-import-tbl">
                <thead>
                  <tr>
                    <th>Row</th><th>Product</th><th>HS Code</th><th>Rate</th>
                    <th>UOM</th><th>Sale Type</th><th>Status</th><th>Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.slice(0, 25).map(row => (
                    <tr key={row.rowNumber}>
                      <td className="prd-mono">{row.rowNumber}</td>
                      <td>
                        <strong>{row.payload.productName || '—'}</strong>
                        <span>{row.payload.hsDescription || 'No description'}</span>
                      </td>
                      <td className="prd-mono">{row.payload.hsCode || '—'}</td>
                      <td>{row.payload.salesTaxRate !== '' ? `${row.payload.salesTaxRate}%` : '—'}</td>
                      <td>{row.payload.unitOfMeasurement || '—'}</td>
                      <td>{row.payload.saleType || '—'}</td>
                      <td>
                        <span className={`prd-badge ${['ready', 'created'].includes(row.status) ? 'b-ok' : row.status === 'invalid' || row.status === 'failed' ? 'b-bad' : 'b-neutral'}`}>
                          {row.status}
                        </span>
                      </td>
                      <td>{row.errors?.length ? row.errors.join('; ') : row.createdId ? `Created #${row.createdId}` : 'Ready to import'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {importRows.length > 25 && <div className="prd-import-limit">Showing first 25 of {importRows.length} parsed rows.</div>}
            </div>
          </>
        )}
      </div>

      {/* Main table card */}
      <div className="prd-tbl-card">
        <div className="prd-filter-bar">
          <div className="prd-chip-row">
            {[
              { key: 'All Status', label: 'All Status' },
              { key: 'Active', label: 'Active' },
              { key: 'Inactive', label: 'Inactive' },
              { key: 'OOS', label: 'Out of Stock' },
            ].map(({ key, label }) => (
              <span
                key={key}
                className={`prd-chip${statusFilter === key ? ' on' : ''}`}
                onClick={() => { setStatusFilter(key); setCurrentPage(1); }}
              >{label}</span>
            ))}
          </div>
          <div className="prd-filter-sep" />
          <label className="prd-search">
            <FiSearch size={14} />
            <input
              type="search"
              placeholder="Search name or HS code…"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </label>
          <select
            className="prd-sort-select"
            value={sortBy}
            onChange={e => { setSortBy(e.target.value); setCurrentPage(1); }}
          >
            <option value="">Sort: Name A→Z</option>
            <option value="Newest">Newest first</option>
            <option value="Oldest">Oldest first</option>
            <option value="A-Z">Name A→Z</option>
            <option value="Z-A">Name Z→A</option>
            <option value="Rate-High">Tax Rate High→Low</option>
            <option value="Rate-Low">Tax Rate Low→High</option>
            <option value="Stock-High">Stock High→Low</option>
            <option value="Stock-Low">Stock Low→High</option>
          </select>
          <span className="prd-results-count">Showing {paginatedProducts.length} of {sortedProducts.length}</span>
        </div>

        {apiError && <div className="prd-api-error">{apiError}</div>}

        <div className="prd-tbl-wrap">
          <table className="prd-table">
            <thead>
              <tr>
                <th className="prd-th-check">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAll}
                    style={{ accentColor: '#F05C44' }}
                  />
                </th>
                <th>
                  <div className="prd-th-inner">
                    Product
                    <span className="prd-sort-ico">
                      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="20" x2="12" y2="4"/>
                        <polyline points="6 10 12 4 18 10"/>
                      </svg>
                    </span>
                  </div>
                </th>
                <th>HS Code</th>
                <th>Tax Rate</th>
                <th>UoM</th>
                <th>In Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading.fetch ? (
                <tr><td colSpan="8" className="prd-empty-cell"><Spinner /> Loading products…</td></tr>
              ) : paginatedProducts.length === 0 ? (
                <tr><td colSpan="8" className="prd-empty-cell">No products found</td></tr>
              ) : (
                paginatedProducts.map(product => {
                  const init = initialsOf(productName(product));
                  const tone = toneFor(product.id, productName(product));
                  const stockRaw = productStock(product);
                  const stockNum = (stockRaw === '' || stockRaw == null) ? null : parseInt(stockRaw, 10);
                  const oos = stockNum === 0;
                  const dStatus = getDisplayStatus(product);
                  const isSelected = selectedIds.includes(product.id);
                  return (
                    <tr key={product.id} className={isSelected ? 'prd-row-sel' : ''}>
                      <td className="prd-td-check">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(product.id)}
                          style={{ accentColor: '#F05C44' }}
                        />
                      </td>
                      <td>
                        <div className="prd-name-cell">
                          <div className={`prd-row-avatar ${tone}`}>{init}</div>
                          <div>
                            <div className="prd-row-name">{productName(product) || '—'}</div>
                            <div className="prd-row-sub">{productSaleType(product) || productHsCode(product) || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className="prd-mono">{productHsCode(product) || '—'}</span></td>
                      <td>
                        {productRate(product) !== '' && productRate(product) !== null
                          ? <span className="prd-badge b-info">{productRate(product)}%</span>
                          : <span className="prd-badge b-neutral">0%</span>
                        }
                      </td>
                      <td>{productUom(product) || '—'}</td>
                      <td>
                        <span style={{ fontWeight: 700, color: oos ? '#DC2626' : '#1A1D23' }}>
                          {stockNum === null ? '∞' : stockNum.toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <span className={`prd-badge ${dStatus === 'Active' ? 'b-ok' : dStatus === 'Out of Stock' ? 'b-bad' : 'b-neutral'}`}>
                          {dStatus}
                        </span>
                      </td>
                      <td>
                        <div className="prd-acts">
                          <button className="prd-act-btn" title="View" onClick={() => setViewingProduct(product)}>
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                              <circle cx="12" cy="12" r="3"/>
                            </svg>
                          </button>
                          <button className="prd-act-btn" title="Edit" onClick={() => handleShowModal(product.id, false)} disabled={loading.fetchSingleEdit}>
                            {loading.fetchSingleEdit ? <Spinner /> : (
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            )}
                          </button>
                          <button className="prd-act-btn danger" title="Delete" onClick={() => handleDelete(product.id)} disabled={loading.delete}>
                            {loading.delete ? <Spinner /> : (
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6l-1 14H6L5 6"/>
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="prd-pager">
          <span className="prd-pager-info">
            {sortedProducts.length > 0
              ? `Showing ${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, sortedProducts.length)} of ${sortedProducts.length} products`
              : '0 products'}
          </span>
          {totalPages > 1 && (
            <div className="prd-pager-btns">
              <button className="prd-pg-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>‹</button>
              {[...Array(Math.min(totalPages, 5))].map((_, i) => (
                <button key={i + 1} className={`prd-pg-btn${currentPage === i + 1 ? ' on' : ''}`} onClick={() => setCurrentPage(i + 1)}>{i + 1}</button>
              ))}
              {totalPages > 5 && (
                <>
                  <span style={{ padding: '0 3px', color: '#9CA3AF', fontSize: 12 }}>…</span>
                  <button className={`prd-pg-btn${currentPage === totalPages ? ' on' : ''}`} onClick={() => setCurrentPage(totalPages)}>{totalPages}</button>
                </>
              )}
              <button className="prd-pg-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>›</button>
            </div>
          )}
        </div>
      </div>

      {/* Slide-in detail panel */}
      <div className={`prd-overlay${viewingProduct ? ' open' : ''}`} onClick={() => setViewingProduct(null)} />
      <div className={`prd-panel${viewingProduct ? ' open' : ''}`}>
        <div className="prd-dp-hdr">
          <div>
            <div className="prd-dp-title">Product Details</div>
            <div className="prd-dp-sub">HS code &amp; tax mapping</div>
          </div>
          <button className="prd-dp-close" onClick={() => setViewingProduct(null)}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        {viewingProduct && (
          <div className="prd-dp-body">
            <div className="prd-dp-avatar-wrap">
              <div className={`prd-dp-avatar ${toneFor(viewingProduct.id, productName(viewingProduct))}`}>
                {initialsOf(productName(viewingProduct))}
              </div>
              <div className="prd-dp-av-name">{productName(viewingProduct)}</div>
              <div className="prd-dp-av-type">
                <span
                  className={`prd-badge ${getDisplayStatus(viewingProduct) === 'Active' ? 'b-ok' : getDisplayStatus(viewingProduct) === 'Out of Stock' ? 'b-bad' : 'b-neutral'}`}
                  style={{ fontSize: 11 }}
                >
                  {getDisplayStatus(viewingProduct)}
                </span>
              </div>
            </div>
            <div className="prd-dp-section">
              <div className="prd-dp-section-title">Classification</div>
              <div className="prd-dp-row">
                <span className="prd-dp-row-key">HS Code</span>
                <span className="prd-dp-row-val prd-mono">{productHsCode(viewingProduct) || '—'}</span>
              </div>
              <div className="prd-dp-row">
                <span className="prd-dp-row-key">HS Description</span>
                <span className="prd-dp-row-val" style={{ maxWidth: 200, textAlign: 'right' }}>{productDescription(viewingProduct) || '—'}</span>
              </div>
              <div className="prd-dp-row">
                <span className="prd-dp-row-key">SRO Schedule</span>
                <span className="prd-dp-row-val prd-mono">{viewingProduct.sro_schedule_no || viewingProduct.sroScheduleNo || '—'}</span>
              </div>
            </div>
            <div className="prd-dp-section">
              <div className="prd-dp-section-title">Pricing &amp; Tax</div>
              <div className="prd-dp-row">
                <span className="prd-dp-row-key">Sales Tax Rate</span>
                <span className="prd-dp-row-val">{productRate(viewingProduct) !== '' ? `${productRate(viewingProduct)}%` : '0%'}</span>
              </div>
              <div className="prd-dp-row">
                <span className="prd-dp-row-key">Unit of Measure</span>
                <span className="prd-dp-row-val">{productUom(viewingProduct) || '—'}</span>
              </div>
              <div className="prd-dp-row">
                <span className="prd-dp-row-key">Sale Type</span>
                <span className="prd-dp-row-val" style={{ maxWidth: 200, textAlign: 'right', fontSize: 12 }}>{productSaleType(viewingProduct) || '—'}</span>
              </div>
              <div className="prd-dp-row">
                <span className="prd-dp-row-key">Further Tax</span>
                <span className="prd-dp-row-val">
                  {(viewingProduct.further_tax_applicable || viewingProduct.furtherTaxApplicable) ? 'Applicable' : 'Not Applicable'}
                </span>
              </div>
              <div className="prd-dp-row">
                <span className="prd-dp-row-key">Extra Tax</span>
                <span className="prd-dp-row-val">
                  {(viewingProduct.extra_tax_applicable || viewingProduct.extraTaxApplicable) ? 'Applicable' : 'Not Applicable'}
                </span>
              </div>
            </div>
            <div className="prd-dp-section">
              <div className="prd-dp-section-title">Inventory</div>
              <div className="prd-dp-row">
                <span className="prd-dp-row-key">In Stock</span>
                <span className="prd-dp-row-val">
                  {productStock(viewingProduct) !== '' && productStock(viewingProduct) != null
                    ? `${parseInt(productStock(viewingProduct), 10).toLocaleString()} units`
                    : '∞ (unlimited)'}
                </span>
              </div>
            </div>
          </div>
        )}
        <div className="prd-dp-footer">
          <button
            className="prd-dp-btn-edit"
            onClick={() => {
              const id = viewingProduct?.id;
              setViewingProduct(null);
              if (id) handleShowModal(id, false);
            }}
          >Edit Product</button>
          <button className="prd-dp-btn-del" onClick={() => viewingProduct && handleDelete(viewingProduct.id)}>Delete</button>
        </div>
      </div>

      {/* Bulk action bar */}
      <div className={`prd-bulk-bar${selectedIds.length > 0 ? ' show' : ''}`}>
        <span className="prd-bulk-count">{selectedIds.length} selected</span>
        <div className="prd-bulk-sep" />
        <button className="prd-bulk-btn primary" onClick={() => downloadProductsCsv(products.filter(p => selectedIds.includes(p.id)))}>
          Export Selected
        </button>
        <button className="prd-bulk-btn ghost" onClick={handleBulkMarkInactive}>Mark Inactive</button>
        <button className="prd-bulk-btn danger" onClick={handleBulkDelete}>Delete</button>
        <button className="prd-bulk-close" onClick={() => setSelectedIds([])}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Bootstrap modal – add / edit */}
      <div className="modal fade prd-modal-shell" id="productModal" tabIndex="-1" aria-hidden="true" ref={modalRef}>
        <div className="modal-dialog modal-xl modal-dialog-centered">
          <div className="modal-content prd-modal">
            <div className="prd-modal__header">
              <div>
                <span>Product Mapping</span>
                <h2>{editingProduct ? (isReadOnly ? 'View Product' : 'Edit Product') : 'Add Product'}</h2>
              </div>
              <button type="button" className="prd-modal__close" data-bs-dismiss="modal" aria-label="Close">&times;</button>
            </div>

            <div className="prd-modal__body">
              {apiError && <div className="prd-api-error">{apiError}</div>}
              {productNotice && <div className="prd-notice">{productNotice}</div>}
              {loading.fetchSingle ? (
                <div className="prd-modal-loading"><Spinner /> Loading product data…</div>
              ) : (
                <>
                  <div className="prd-form-grid">
                    <label>
                      <span>Product Name</span>
                      <input name="product_name" value={formData.product_name} onChange={handleInputChange} disabled={isReadOnly} />
                    </label>
                    <label>
                      <span>Sales Tax Rate (%)</span>
                      <input name="rate" value={formData.rate} onChange={handleInputChange} disabled={isReadOnly} />
                    </label>
                    <label>
                      <span>Unit of Measure</span>
                      <select name="unit_of_measure" value={formData.unit_of_measure} onChange={handleInputChange} disabled={isReadOnly}>
                        <option value="">Select Unit</option>
                        {uomOptions.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                    </label>
                    <label className="prd-form-grid__wide prd-hs-search-field">
                      <span>HS Code Search</span>
                      <div className="prd-hs-search-row">
                        <input
                          type="search"
                          value={hsSearch}
                          onChange={handleHsSearchChange}
                          disabled={isReadOnly}
                          placeholder="Search HS code or description"
                        />
                        <button
                          type="button"
                          className="prd-btn-outline prd-btn-sm"
                          onClick={autofillFbrFields}
                          disabled={isReadOnly || loading.autofill || !formData.hs_code}
                        >
                          {loading.autofill ? <Spinner /> : 'Autofill'}
                        </button>
                      </div>
                      {hsSuggestions.length > 0 && (
                        <div className="prd-hs-suggestions">
                          {hsSuggestions.map(s => (
                            <button key={s.hsCode} type="button" onClick={() => selectHsSuggestion(s)}>
                              <strong>{s.hsCode}</strong>
                              <span>{s.description}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {loading.hsSearch && <small>Searching FBR references…</small>}
                    </label>
                    <label>
                      <span>HS Code</span>
                      <select name="hs_code" value={formData.hs_code} onChange={handleInputChange} disabled={isReadOnly}>
                        <option value="">Select HS Code</option>
                        {hsCodeOptions.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>In Stock</span>
                      <input name="in_stock" value={formData.in_stock} onChange={handleInputChange} disabled={isReadOnly} />
                    </label>
                    <label>
                      <span>Status</span>
                      <select name="status" value={formData.status} onChange={handleInputChange} disabled={isReadOnly}>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </label>
                    <label className="prd-form-grid__wide">
                      <span>Description</span>
                      <textarea name="description" value={formData.description} onChange={handleInputChange} disabled={isReadOnly} rows={3} />
                    </label>
                    <label className="prd-form-grid__wide">
                      <span>Sale Type</span>
                      <select name="sale_type" value={formData.sale_type} onChange={handleInputChange} disabled={isReadOnly}>
                        <option value="">Select Sale Type</option>
                        {saleTypeOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </label>
                    <label className="prd-form-grid__wide">
                      <span>SRO Schedule No</span>
                      <input name="sro_schedule_no" value={formData.sro_schedule_no} onChange={handleInputChange} disabled={isReadOnly} />
                    </label>
                  </div>

                  <input name="tax" value={formData.tax} onChange={handleInputChange} className="d-none" disabled={isReadOnly} />
                  <select name="tax_type" value={formData.tax_type} onChange={handleInputChange} className="d-none" disabled={isReadOnly}>
                    <option value="">Select</option>
                    <option value="Sales Tax">Sales Tax</option>
                    <option value="Excise Tax">Excise Tax</option>
                    <option value="Further Tax">Further Tax</option>
                    <option value="Sales Tax,Extra Tax">Sales Tax, Extra Tax</option>
                  </select>

                  <div className="prd-check-grid">
                    <label>
                      <input type="checkbox" name="further_tax_applicable" checked={formData.further_tax_applicable} onChange={handleInputChange} disabled={isReadOnly} />
                      <span>Further Tax Applicable</span>
                    </label>
                    <label>
                      <input type="checkbox" name="extra_tax_applicable" checked={formData.extra_tax_applicable} onChange={handleInputChange} disabled={isReadOnly} />
                      <span>Extra Tax Applicable</span>
                    </label>
                  </div>
                </>
              )}
            </div>

            <div className="prd-modal__footer">
              <button type="button" className="prd-btn-outline" data-bs-dismiss="modal">Cancel</button>
              {!isReadOnly && (
                <button
                  type="button"
                  className="prd-btn-primary"
                  onClick={editingProduct ? handleUpdate : handleSave}
                  disabled={loading.add || loading.edit}
                >
                  {loading.add || loading.edit ? <Spinner /> : editingProduct ? 'Update' : 'Save'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default Products;
