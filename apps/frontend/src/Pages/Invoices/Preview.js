import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CiCalendar } from 'react-icons/ci';
import { MdExpandMore, MdExpandLess, MdCheckCircle, MdError } from 'react-icons/md';
import { FiArrowLeft, FiCheckCircle, FiSend } from 'react-icons/fi';
import useBlockBackButton from '../../Components/useBlockBackButton';
import { submitInvoice } from '../../services/fbrInvoiceApi';
import './Preview.css';

const STATUS = { PENDING: 'pending', SUBMITTING: 'submitting', SUCCESS: 'success', FAILED: 'failed' };

function statusBadge({ hasErrors, stateVal, status }) {
  if (hasErrors && stateVal === STATUS.PENDING) {
    return <span className="upload-preview-status danger">Errors</span>;
  }
  if (!hasErrors && stateVal === STATUS.PENDING) {
    return <span className="upload-preview-status success">Valid</span>;
  }
  if (stateVal === STATUS.SUBMITTING) {
    return (
      <span className="upload-preview-status warning">
        <span className="spinner-border spinner-border-sm" /> Submitting
      </span>
    );
  }
  if (stateVal === STATUS.SUCCESS) {
    return (
      <span className="upload-preview-status success">
        <MdCheckCircle /> Sent - {status.fbrInvoiceNo}
      </span>
    );
  }
  if (stateVal === STATUS.FAILED) {
    return (
      <span className="upload-preview-status danger" title={status.error}>
        <MdError /> Failed
      </span>
    );
  }
  return <span className="upload-preview-status neutral">Pending</span>;
}

export default function Preview() {
  useBlockBackButton();
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [statuses, setStatuses] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('upload_invoices');
    if (!raw) { navigate('/invoice/upload'); return; }
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) { navigate('/invoice/upload'); return; }
      setInvoices(parsed);
      const s = {};
      parsed.forEach(inv => { s[inv.invoiceRefNo] = STATUS.PENDING; });
      setStatuses(s);
    } catch {
      navigate('/invoice/upload');
    }
  }, [navigate]);

  const validInvoices = invoices.filter(inv => !inv.errors || inv.errors.length === 0);
  const errorInvoices = invoices.filter(inv => inv.errors && inv.errors.length > 0);

  const toggleExpanded = (ref) => setExpanded(prev => ({ ...prev, [ref]: !prev[ref] }));

  const handleSubmitAll = useCallback(async () => {
    if (validInvoices.length === 0) return;
    setSubmitting(true);
    setDone(false);

    for (const inv of validInvoices) {
      setStatuses(prev => ({ ...prev, [inv.invoiceRefNo]: STATUS.SUBMITTING }));
      try {
        const result = await submitInvoice(inv);
        setStatuses(prev => ({
          ...prev,
          [inv.invoiceRefNo]: { state: STATUS.SUCCESS, fbrInvoiceNo: result?.fbrInvoiceNo || result?.invoiceNumber || 'Submitted' },
        }));
      } catch (err) {
        const msg = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Submission failed';
        setStatuses(prev => ({
          ...prev,
          [inv.invoiceRefNo]: { state: STATUS.FAILED, error: msg },
        }));
      }
    }

    setSubmitting(false);
    setDone(true);
  }, [validInvoices]);

  const handleBack = () => {
    sessionStorage.removeItem('upload_invoices');
    navigate('/invoice/upload');
  };

  const successCount = Object.values(statuses).filter(s => s?.state === STATUS.SUCCESS).length;
  const failCount = Object.values(statuses).filter(s => s?.state === STATUS.FAILED).length;

  if (invoices.length === 0) return null;

  return (
    <div className="upload-preview-page">
      <div className="upload-preview-header">
        <div>
          <span>Bulk invoice import</span>
          <h1>Upload Preview</h1>
          <p>Review parsed invoices, expand line items, and submit valid invoices to FBR.</p>
        </div>

        <div className="upload-preview-header__actions">
          <Link to="/invoice" className="upload-preview-secondary-action">Back to invoices</Link>
          <button className="upload-preview-secondary-action" onClick={handleBack} disabled={submitting}>
            <FiArrowLeft size={16} /> Upload another file
          </button>
        </div>
      </div>

      <div className="upload-invoice-steps">
        <div className="upload-invoice-step done"><div className="upload-invoice-step__dot"><FiCheckCircle size={12} /></div><span>Upload File</span></div>
        <div className="upload-invoice-step__line" />
        <div className="upload-invoice-step done"><div className="upload-invoice-step__dot"><FiCheckCircle size={12} /></div><span>Validate</span></div>
        <div className="upload-invoice-step__line" />
        <div className={`upload-invoice-step ${done ? 'done' : 'active'}`}><div className="upload-invoice-step__dot">{done ? <FiCheckCircle size={12} /> : 3}</div><span>Review &amp; Confirm</span></div>
        <div className="upload-invoice-step__line" />
        <div className={`upload-invoice-step ${done ? 'active' : ''}`}><div className="upload-invoice-step__dot">4</div><span>Submit</span></div>
      </div>

      <div className="upload-preview-summary">
        {[
          { label: 'Total Invoices', value: invoices.length, tone: 'neutral' },
          { label: 'Valid', value: validInvoices.length, tone: 'success' },
          { label: 'Errors', value: errorInvoices.length, tone: 'danger' },
          ...(done ? [
            { label: 'Submitted', value: successCount, tone: 'success' },
            { label: 'Failed', value: failCount, tone: 'danger' },
          ] : []),
        ].map(({ label, value, tone }) => (
          <div key={label}>
            <span>{label}</span>
            <strong className={tone}>{value}</strong>
          </div>
        ))}
      </div>

      {done && (
        <div className={`upload-preview-result ${failCount === 0 ? 'success' : 'warning'}`}>
          <FiCheckCircle size={22} />
          <div>
            <strong>{failCount === 0 ? 'Submission complete' : 'Submission finished with failures'}</strong>
            <p>
              {failCount === 0
                ? `All ${successCount} invoice(s) submitted successfully to FBR.`
                : `${successCount} submitted, ${failCount} failed. Review failed invoices below.`}
            </p>
          </div>
        </div>
      )}

      <section className="upload-preview-panel">
        <div className="upload-preview-panel__top">
          <div>
            <h2>Parsed invoices</h2>
            <p>{invoices.length} invoice{invoices.length !== 1 ? 's' : ''} found in the uploaded workbook.</p>
          </div>
        </div>

        <div className="upload-preview-table-wrap">
          <table className="upload-preview-table">
            <thead>
              <tr>
                <th></th>
                <th>Invoice Ref No</th>
                <th>Type</th>
                <th><CiCalendar /> Date</th>
                <th>Buyer</th>
                <th>Items</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => {
                const hasErrors = inv.errors && inv.errors.length > 0;
                const st = statuses[inv.invoiceRefNo];
                const isExpanded = !!expanded[inv.invoiceRefNo];
                const stateVal = typeof st === 'object' ? st.state : st;

                return (
                  <React.Fragment key={inv.invoiceRefNo}>
                    <tr className={hasErrors ? 'has-errors' : ''}>
                      <td>
                        <button
                          className="upload-preview-expand-action"
                          onClick={() => toggleExpanded(inv.invoiceRefNo)}
                          title={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          {isExpanded ? <MdExpandLess size={20} /> : <MdExpandMore size={20} />}
                        </button>
                      </td>
                      <td className="upload-preview-ref">{inv.invoiceRefNo}</td>
                      <td>{inv.invoiceType}</td>
                      <td>{inv.invoiceDate}</td>
                      <td className="upload-preview-buyer">{inv.buyerBusinessName}</td>
                      <td>{inv.items?.length ?? 0}</td>
                      <td>{statusBadge({ hasErrors, stateVal, status: st })}</td>
                    </tr>

                    {isExpanded && (
                      <tr className="upload-preview-detail-row">
                        <td colSpan={7}>
                          <div className="upload-preview-detail">
                            {hasErrors && (
                              <div className="upload-preview-errors">
                                <strong>Validation Errors</strong>
                                <ul>
                                  {inv.errors.map((e, i) => (
                                    <li key={i}>{e}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {stateVal === STATUS.FAILED && (
                              <div className="upload-preview-errors">
                                <strong>Submission error</strong>
                                <p>{st.error}</p>
                              </div>
                            )}

                            <div className="upload-preview-line-heading">
                              <strong>Line Items</strong>
                              <span>{inv.items?.length ?? 0} item{(inv.items?.length ?? 0) !== 1 ? 's' : ''}</span>
                            </div>

                            <div className="upload-preview-line-wrap">
                              <table className="upload-preview-line-table">
                                <thead>
                                  <tr>
                                    <th>HS Code</th>
                                    <th>Description</th>
                                    <th>UOM</th>
                                    <th>Qty</th>
                                    <th>Rate</th>
                                    <th>Value Excl ST</th>
                                    <th>Sales Tax</th>
                                    <th>Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(inv.items || []).map((item, idx) => (
                                    <tr key={idx}>
                                      <td className="upload-preview-ref">{item.hsCode}</td>
                                      <td>{item.productDescription}</td>
                                      <td>{item.uoM}</td>
                                      <td>{item.quantity}</td>
                                      <td>{item.rate}</td>
                                      <td>{item.valueSalesExcludingST?.toLocaleString()}</td>
                                      <td>{item.salesTaxApplicable?.toLocaleString()}</td>
                                      <td>{item.totalValues?.toLocaleString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="upload-preview-actions">
        <button className="upload-preview-secondary-action" onClick={handleBack} disabled={submitting}>
          <FiArrowLeft size={16} /> Back
        </button>
        {!done ? (
          <button
            className="upload-preview-primary-action"
            onClick={handleSubmitAll}
            disabled={submitting || validInvoices.length === 0}
          >
            {submitting
              ? <><span className="spinner-border spinner-border-sm" role="status" /> Submitting...</>
              : <><FiSend size={16} /> Submit {validInvoices.length} Valid Invoice{validInvoices.length !== 1 ? 's' : ''} to FBR</>}
          </button>
        ) : (
          <button className="upload-preview-primary-action" onClick={handleBack}>
            Upload More
          </button>
        )}
        {validInvoices.length === 0 && !done && (
          <span>Fix all validation errors before submitting.</span>
        )}
      </div>
    </div>
  );
}
