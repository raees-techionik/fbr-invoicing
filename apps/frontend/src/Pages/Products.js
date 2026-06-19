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

const emptyReferenceData = {
  hsCodes: [],
  uoms: [],
  transactionTypes: [],
};

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

const productName = (product) => product.product_name || product.productName || '';
const productRate = (product) => product.rate ?? product.salesTaxRate ?? '';
const productStock = (product) => product.in_stock ?? product.inStock ?? '';
const productHsCode = (product) => product.hs_code || product.hsCode || '';
const productUom = (product) => product.unit_of_measure || product.unitOfMeasurement || '';
const productDescription = (product) => product.description || product.hsDescription || '';
const productStatus = (product) => product.status || 'Active';
const productSaleType = (product) => product.sale_type || product.saleType || '';

const normalizeHeader = (value) => String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');
const normalizeHs = (value) => String(value || '').trim().replace(/\s+/g, '').toLowerCase();

const getImportCell = (row, field) => {
  const aliases = importColumnAliases[field] || [field];
  const normalizedRow = Object.entries(row).reduce((acc, [key, value]) => {
    acc[normalizeHeader(key)] = value;
    return acc;
  }, {});

  for (const alias of aliases) {
    const value = normalizedRow[normalizeHeader(alias)];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }

  return '';
};

const parseImportBoolean = (value) => ['true', 'yes', 'y', '1'].includes(String(value || '').trim().toLowerCase());

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
  const [loading, setLoading] = useState({
    add: false,
    edit: false,
    delete: false,
    fetch: false,
    fetchSingle: false,
    fetchSingleEdit: false,
    fetchSingleView: false,
    hsSearch: false,
    autofill: false,
    import: false,
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
    const modalElement = modalRef.current;
    if (modalElement) {
      const handleHidden = () => {
        document.body.classList.remove('modal-open');
        Array.from(document.getElementsByClassName('modal-backdrop')).forEach(backdrop => backdrop.remove());
      };

      modalElement.addEventListener('hidden.bs.modal', handleHidden);
      return () => {
        modalElement.removeEventListener('hidden.bs.modal', handleHidden);
      };
    }
  }, []);

  const handleShowModal = async (productId = null, viewOnly = false) => {
    if (productId !== null) {
      try {
        setLoading(prev => ({
          ...prev,
          fetchSingle: true,
          fetchSingleView: viewOnly,
          fetchSingleEdit: !viewOnly,
        }));
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
        setLoading(prev => ({
          ...prev,
          fetchSingle: false,
          fetchSingleView: false,
          fetchSingleEdit: false,
        }));
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
      const selectedHsCode = referenceData.hsCodes.find((item) => item.hsCode === inputValue);
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
      setFormData(prev => ({
        ...prev,
        [name]: name === 'tax_type' ? String(' ') : inputValue,
        tax: 0,
      }));
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
    Array.from(document.getElementsByClassName('modal-backdrop')).forEach(backdrop => backdrop.remove());
  };

  const handleSave = async () => {
    setApiError('');
    setLoading(prev => ({ ...prev, add: true }));
    try {
      const createdProduct = await createProductMapping(productFormToPayload(formData));
      hideModal();
      setFormData(emptyProductForm);
      setEditingProduct(null);
      setCurrentPage(1);
      const refreshedProducts = await fetchProducts();
      setProducts([
        createdProduct,
        ...refreshedProducts.filter(product => product.id !== createdProduct.id),
      ]);
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
    if (value.trim().length < 2) {
      setHsSuggestions([]);
      return;
    }

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
    setFormData(prev => ({
      ...prev,
      hs_code: suggestion.hsCode || '',
      description: suggestion.description || prev.description,
    }));
    setHsSearch(`${suggestion.hsCode}${suggestion.description ? ` - ${suggestion.description}` : ''}`);
    setHsSuggestions([]);
    setProductNotice('HS code and description filled from FBR reference data.');
  };

  const autofillFbrFields = async () => {
    if (!formData.hs_code) {
      setProductNotice('Select an HS code before autofill.');
      return;
    }

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
      .filter(row => Object.values(row).some(value => String(value || '').trim() !== ''))
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
          payload: {
            ...payload,
            salesTaxRate: payload.salesTaxRate === '' ? 0 : Number(String(payload.salesTaxRate).replace('%', '')),
          },
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
      if (!firstSheet) {
        setImportError('No worksheet was found in the selected file.');
        return;
      }
      const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: '' });
      const rows = buildImportRows(rawRows);
      if (rows.length === 0) {
        setImportError('No product rows were found in the selected file.');
        return;
      }
      setImportRows(rows);
    } catch (error) {
      console.error('Failed to parse product import file:', error);
      setImportError('Could not read this file. Please upload a CSV or Excel file.');
    }
  };

  const handleImportProducts = async () => {
    const readyRows = importRows.filter(row => row.status === 'ready');
    if (readyRows.length === 0) {
      setImportError('No valid rows are ready to import.');
      return;
    }

    setLoading(prev => ({ ...prev, import: true }));
    setImportError('');
    try {
      const result = await bulkImportProductMappings(readyRows.map(row => row.payload));
      const resultByImportIndex = new Map((result.results || []).map(item => [item.index, item]));
      let readyIndex = 0;
      const rowsWithResult = importRows.map(row => {
        if (row.status !== 'ready') return row;
        const rowResult = resultByImportIndex.get(readyIndex++);
        if (rowResult?.status === 'created') return { ...row, status: 'created', createdId: rowResult.id };
        return { ...row, status: 'failed', errors: [rowResult?.error || 'Import failed'] };
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
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'product-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredProducts = (products || []).filter(product => {
    if (!product) return false;
    const term = searchTerm.toLowerCase();
    return (
      productName(product).toLowerCase().includes(term) ||
      productHsCode(product).toLowerCase().includes(term) ||
      productDescription(product).toLowerCase().includes(term)
    );
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'Newest':
        return new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0);
      case 'Oldest':
        return new Date(a.created_at || a.createdAt || 0) - new Date(b.created_at || b.createdAt || 0);
      case 'A-Z':
        return productName(a).localeCompare(productName(b));
      case 'Z-A':
        return productName(b).localeCompare(productName(a));
      case 'Rate-High':
        return parseFloat(productRate(b) || 0) - parseFloat(productRate(a) || 0);
      case 'Rate-Low':
        return parseFloat(productRate(a) || 0) - parseFloat(productRate(b) || 0);
      case 'Stock-High':
        return parseInt(productStock(b) || 0, 10) - parseInt(productStock(a) || 0, 10);
      case 'Stock-Low':
        return parseInt(productStock(a) || 0, 10) - parseInt(productStock(b) || 0, 10);
      default:
        return 0;
    }
  });

  const activeCount = products.filter(product => productStatus(product) === 'Active').length;
  const inactiveCount = products.length - activeCount;
  const mappedHsCount = products.filter(product => productHsCode(product)).length;
  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const importReadyCount = importRows.filter(row => row.status === 'ready').length;
  const importInvalidCount = importRows.filter(row => row.status === 'invalid').length;
  const importCreatedCount = importRows.filter(row => row.status === 'created').length;
  const importFailedCount = importRows.filter(row => row.status === 'failed').length;

  const Spinner = ({ sm } = {}) => (
    <span className={`spinner-border${sm ? ' spinner-border-sm' : ' spinner-border-sm'}`} role="status">
      <span className="visually-hidden">Loading...</span>
    </span>
  );

  const hsCodeOptions = referenceData.hsCodes.length
    ? referenceData.hsCodes.map((item) => ({
        value: item.hsCode,
        label: `${item.hsCode}${item.description ? ` - ${item.description}` : ''}`,
      }))
    : hsCodes.map((item) => ({
        value: item.code,
        label: `${item.code}${item.description ? ` - ${item.description}` : ''}`,
      }));

  const uomOptions = referenceData.uoms.length
    ? referenceData.uoms.map((uom) => ({
        value: uom.description,
        label: uom.description,
      }))
    : [
        { value: 'Hour', label: 'Hour' },
        { value: 'Kg', label: 'Kg' },
        { value: 'unit 5%', label: 'unit 5%' },
      ];

  const saleTypeOptions = referenceData.transactionTypes.length
    ? referenceData.transactionTypes.map((transactionType) => ({
        value: transactionType.description,
        label: transactionType.description,
      }))
    : [
        { value: 'Goods at standard rate (default)', label: 'Goods at standard rate (default)' },
        { value: 'Goods at Reduced Rate', label: 'Goods at Reduced Rate' },
        { value: 'Exempt Goods', label: 'Exempt Goods' },
      ];

  return (
    <div className="products-page">
      <div className="products-header">
        <div>
          <span>Product mappings</span>
          <h1>Products</h1>
          <p>Manage HS code, UoM, tax rate, and sale type mappings used by Add Invoice.</p>
        </div>

        <div className="products-header__actions">
          <button className="products-secondary-action" onClick={fetchProducts} disabled={loading.fetch}>
            <FiRefreshCw size={16} /> Refresh
          </button>
          <button
            className="products-primary-action"
            onClick={() => handleShowModal()}
            disabled={loading.add}
          >
            {loading.add ? <Spinner sm /> : <><FaPlus /> Add Product</>}
          </button>
        </div>
      </div>

      <div className="products-stat-grid">
        <div>
          <span>Total mappings</span>
          <strong>{products.length}</strong>
        </div>
        <div>
          <span>Active</span>
          <strong className="success">{activeCount}</strong>
        </div>
        <div>
          <span>Inactive</span>
          <strong>{inactiveCount}</strong>
        </div>
        <div>
          <span>HS mapped</span>
          <strong className="success">{mappedHsCount}</strong>
        </div>
      </div>

      <section className="products-import-panel">
        <div className="products-panel__top">
          <div>
            <h2>Bulk Import</h2>
            <p>Upload a CSV or Excel file, review validation results, then import the rows that are ready.</p>
          </div>
          <div className="products-header__actions">
            <button className="products-secondary-action" type="button" onClick={downloadImportTemplate}>
              <FiDownload size={16} /> Template
            </button>
            <label className="products-secondary-action products-upload-action">
              <FiUpload size={16} /> Choose file
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleImportFile} />
            </label>
          </div>
        </div>

        {importFileName && (
          <div className="products-import-summary">
            <div><span>File</span><strong>{importFileName}</strong></div>
            <div><span>Ready</span><strong className="success">{importReadyCount}</strong></div>
            <div><span>Needs Fix</span><strong className={importInvalidCount ? 'danger' : ''}>{importInvalidCount}</strong></div>
            <div><span>Imported</span><strong className="success">{importCreatedCount}</strong></div>
            <div><span>Failed</span><strong className={importFailedCount ? 'danger' : ''}>{importFailedCount}</strong></div>
          </div>
        )}

        {importError && <div className="products-error">{importError}</div>}
        {importResult && (
          <div className={`products-import-result ${importResult.failed ? 'warning' : 'success'}`}>
            Imported {importResult.created} of {importResult.submitted} submitted rows. {importResult.skipped} invalid row{importResult.skipped === 1 ? '' : 's'} skipped.
          </div>
        )}

        {importRows.length > 0 && (
          <>
            <div className="products-import-actions">
              <button className="products-primary-action" type="button" onClick={handleImportProducts} disabled={loading.import || importReadyCount === 0}>
                {loading.import ? <Spinner sm /> : <><FiUpload size={16} /> Import ready rows</>}
              </button>
              <button className="products-secondary-action" type="button" onClick={clearImport} disabled={loading.import}>Clear import</button>
            </div>
            <div className="products-table-wrap products-import-table-wrap">
              <table className="products-table products-import-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Product</th>
                    <th>HS Code</th>
                    <th>Rate</th>
                    <th>UOM</th>
                    <th>Sale Type</th>
                    <th>Status</th>
                    <th>Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.slice(0, 25).map(row => (
                    <tr key={row.rowNumber}>
                      <td className="products-ref">{row.rowNumber}</td>
                      <td><strong>{row.payload.productName || '-'}</strong><span>{row.payload.hsDescription || 'No description'}</span></td>
                      <td className="products-ref">{row.payload.hsCode || '-'}</td>
                      <td>{row.payload.salesTaxRate !== '' ? `${row.payload.salesTaxRate}%` : '-'}</td>
                      <td>{row.payload.unitOfMeasurement || '-'}</td>
                      <td>{row.payload.saleType || '-'}</td>
                      <td><span className={`products-status ${['ready', 'created'].includes(row.status) ? 'success' : row.status === 'invalid' || row.status === 'failed' ? 'danger' : 'neutral'}`}>{row.status}</span></td>
                      <td>{row.errors?.length ? row.errors.join('; ') : row.createdId ? `Created #${row.createdId}` : 'Ready to import'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {importRows.length > 25 && <div className="products-import-limit">Showing first 25 of {importRows.length} parsed rows.</div>}
            </div>
          </>
        )}
      </section>

      <section className="products-panel">
        <div className="products-panel__top">
          <div>
            <h2>All Products</h2>
            <p>{sortedProducts.length} product mapping{sortedProducts.length !== 1 ? 's' : ''} match the current view.</p>
          </div>
          <div className="products-toolbar">
            <label className="products-search">
              <FiSearch size={16} />
              <input
                type="search"
                placeholder="Search name, HS code, description..."
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </label>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">Sort by</option>
              <option value="Newest">Newest</option>
              <option value="Oldest">Oldest</option>
              <option value="A-Z">Name (A-Z)</option>
              <option value="Z-A">Name (Z-A)</option>
              <option value="Rate-High">Rate (High to Low)</option>
              <option value="Rate-Low">Rate (Low to High)</option>
              <option value="Stock-High">Stock (High to Low)</option>
              <option value="Stock-Low">Stock (Low to High)</option>
            </select>
          </div>
        </div>

        {apiError && <div className="products-error">{apiError}</div>}

        <div className="products-table-wrap">
          <table className="products-table">
            <thead>
              <tr>
                <th>Tracking No</th>
                <th>Product Name</th>
                <th>Tax Rate</th>
                <th>In Stock</th>
                <th>HS Code</th>
                <th>UOM</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading.fetch ? (
                <tr>
                  <td colSpan="8" className="products-empty-cell"><Spinner sm /> Loading products...</td>
                </tr>
              ) : paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan="8" className="products-empty-cell">No products found</td>
                </tr>
              ) : (
                paginatedProducts.map((product) => (
                  <tr key={product.id}>
                    <td className="products-ref">#{product.id}</td>
                    <td>
                      <strong>{productName(product) || '-'}</strong>
                      <span>{productSaleType(product) || 'No sale type set'}</span>
                    </td>
                    <td>{productRate(product) !== '' ? `${productRate(product)}%` : '-'}</td>
                    <td>{productStock(product) || '-'}</td>
                    <td className="products-ref">{productHsCode(product) || '-'}</td>
                    <td>{productUom(product) || '-'}</td>
                    <td><span className={`products-status ${productStatus(product) === 'Active' ? 'success' : 'neutral'}`}>{productStatus(product)}</span></td>
                    <td>
                      <div className="products-row-actions">
                        <button
                          className="products-icon-action success"
                          aria-label="View product"
                          onClick={() => handleShowModal(product.id, true)}
                          disabled={loading.fetchSingleView}
                        >
                          {loading.fetchSingleView ? <Spinner sm /> : <LuEye />}
                        </button>
                        <button
                          className="products-icon-action primary"
                          aria-label="Edit product"
                          onClick={() => handleShowModal(product.id, false)}
                          disabled={loading.fetchSingleEdit}
                        >
                          {loading.fetchSingleEdit ? <Spinner sm /> : <FiEdit />}
                        </button>
                        <button
                          className="products-icon-action danger"
                          aria-label="Delete product"
                          onClick={() => handleDelete(product.id)}
                          disabled={loading.delete}
                        >
                          {loading.delete ? <Spinner sm /> : <FiTrash2 />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="products-pagination">
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                className={i + 1 === currentPage ? 'active' : ''}
                onClick={() => setCurrentPage(i + 1)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="modal fade products-modal-shell" id="customerModal" tabIndex="-1" aria-hidden="true" ref={modalRef}>
        <div className="modal-dialog modal-xl modal-dialog-centered">
          <div className="modal-content products-modal">
            <div className="products-modal__header">
              <div>
                <span>Product Mapping</span>
                <h2>{editingProduct ? (isReadOnly ? 'View Product' : 'Edit Product') : 'Add Product'}</h2>
              </div>
              <button type="button" className="products-modal__close" data-bs-dismiss="modal" aria-label="Close">&times;</button>
            </div>

            <div className="products-modal__body">
              {apiError && <div className="products-error">{apiError}</div>}
              {productNotice && <div className="products-notice">{productNotice}</div>}
              {loading.fetchSingle && editingProduct ? (
                <div className="products-modal-loading"><Spinner sm /> Loading product data...</div>
              ) : (
                <>
                  <div className="products-form-grid">
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
                        {uomOptions.map((uom) => (
                          <option key={uom.value} value={uom.value}>{uom.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="products-form-grid__wide products-hs-search-field">
                      <span>HS Code Search</span>
                      <div className="products-hs-search-row">
                        <input
                          type="search"
                          value={hsSearch}
                          onChange={handleHsSearchChange}
                          disabled={isReadOnly}
                          placeholder="Search HS code or description"
                        />
                        <button type="button" className="products-secondary-action" onClick={autofillFbrFields} disabled={isReadOnly || loading.autofill || !formData.hs_code}>
                          {loading.autofill ? <Spinner sm /> : 'Autofill'}
                        </button>
                      </div>
                      {hsSuggestions.length > 0 && (
                        <div className="products-hs-suggestions">
                          {hsSuggestions.map((suggestion) => (
                            <button key={suggestion.hsCode} type="button" onClick={() => selectHsSuggestion(suggestion)}>
                              <strong>{suggestion.hsCode}</strong>
                              <span>{suggestion.description}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {loading.hsSearch && <small>Searching FBR references...</small>}
                    </label>
                    <label>
                      <span>HS Code</span>
                      <select name="hs_code" value={formData.hs_code} onChange={handleInputChange} disabled={isReadOnly}>
                        <option value="">Select HS Code</option>
                        {hsCodeOptions.map((hsCode) => (
                          <option key={hsCode.value} value={hsCode.value}>{hsCode.label}</option>
                        ))}
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
                    <label className="products-form-grid__wide">
                      <span>Description</span>
                      <textarea name="description" value={formData.description} onChange={handleInputChange} disabled={isReadOnly} />
                    </label>
                    <label className="products-form-grid__wide">
                      <span>Sale Type</span>
                      <select name="sale_type" value={formData.sale_type} onChange={handleInputChange} disabled={isReadOnly}>
                        <option value="">Select Sale Type</option>
                        {saleTypeOptions.map((saleType) => (
                          <option key={saleType.value} value={saleType.value}>{saleType.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="products-form-grid__wide">
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

                  <div className="products-check-grid">
                    <label>
                      <input
                        type="checkbox"
                        name="further_tax_applicable"
                        checked={formData.further_tax_applicable}
                        onChange={handleInputChange}
                        disabled={isReadOnly}
                      />
                      <span>Further Tax Applicable</span>
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        name="extra_tax_applicable"
                        checked={formData.extra_tax_applicable}
                        onChange={handleInputChange}
                        disabled={isReadOnly}
                      />
                      <span>Extra Tax Applicable</span>
                    </label>
                  </div>
                </>
              )}
            </div>

            <div className="products-modal__footer">
              <button type="button" className="products-secondary-action" data-bs-dismiss="modal">Cancel</button>
              {!isReadOnly && (
                <button
                  type="button"
                  className="products-primary-action"
                  onClick={editingProduct ? handleUpdate : handleSave}
                  disabled={loading.add || loading.edit}
                >
                  {loading.add || loading.edit ? <Spinner sm /> : (editingProduct ? 'Update' : 'Save')}
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
