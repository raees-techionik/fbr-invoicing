import React, { useMemo, useRef, useState } from 'react';
import {
  FiBookOpen,
  FiCheckCircle,
  FiFileText,
  FiHelpCircle,
  FiMail,
  FiMessageCircle,
  FiPhone,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiShield,
  FiUpload,
} from 'react-icons/fi';
import useBlockBackButton from '../Components/useBlockBackButton';
import './Support.css';

const documentationLinks = [
  'Invoice Creation Guide',
  'API Token Setup',
  'Troubleshooting Submissions',
  'Item Configuration',
  'PDF & QR Code Printing',
];

const faqItems = [
  {
    question: 'How do I submit an invoice to FBR?',
    answer: 'Create or upload an invoice, check required seller and buyer fields, then submit from Add Invoice or the upload preview.',
  },
  {
    question: 'Why is my invoice submission failing?',
    answer: 'Most failures come from token validity, missing seller profile fields, buyer registration details, or item mapping values.',
  },
  {
    question: 'What does Scenario ID mean?',
    answer: 'Scenario IDs are sandbox fixtures used for FBR testing. They remain available in sandbox and are removed for production submissions.',
  },
  {
    question: 'Why is my token not working?',
    answer: 'Check Settings for active environment, mock/live mode, token status, and outbound IP whitelisting.',
  },
];

const contactItems = [
  { label: 'Support Phone', value: '+92 300 0000000', icon: <FiPhone /> },
  { label: 'WhatsApp Support', value: '+92 300 0000000', icon: <FiMessageCircle /> },
  { label: 'Email', value: 'support@techionik.com', icon: <FiMail /> },
];

const helpCategories = [
  { title: 'Invoicing', description: 'Create, submit, and manage invoices', term: 'invoice', icon: <FiFileText /> },
  { title: 'FBR Integration', description: 'Tokens, sandbox, and IRIS setup', term: 'token sandbox', icon: <FiShield /> },
  { title: 'Account & Team', description: 'Members, roles, and permissions', term: 'account', icon: <FiHelpCircle /> },
  { title: 'Guides', description: 'Documentation and tutorials', term: 'documentation', icon: <FiBookOpen /> },
];

const searchableSections = [
  'Ask a Question',
  'Bug Report',
  'Documentation',
  'Email Support',
  'FAQs',
  'Contact Info',
  ...documentationLinks,
  ...faqItems.flatMap(item => [item.question, item.answer]),
  ...contactItems.flatMap(item => [item.label, item.value]),
];

function Support() {
  useBlockBackButton();

  const [searchTerm, setSearchTerm] = useState('');
  const [question, setQuestion] = useState('');
  const [bugReport, setBugReport] = useState('');
  const [emailForm, setEmailForm] = useState({
    theme: '',
    email: '',
    category: 'Invoice Submission',
    message: '',
  });
  const [fileName, setFileName] = useState('');
  const [notice, setNotice] = useState('');
  const fileInputRef = useRef(null);

  const lowerSearch = searchTerm.trim().toLowerCase();
  const hasSearchMatch = useMemo(() => {
    if (!lowerSearch) return true;
    return searchableSections.some(item => item.toLowerCase().includes(lowerSearch));
  }, [lowerSearch]);

  const filteredDocs = documentationLinks.filter(item => item.toLowerCase().includes(lowerSearch));
  const filteredFaqs = faqItems.filter(item => (
    item.question.toLowerCase().includes(lowerSearch) ||
    item.answer.toLowerCase().includes(lowerSearch)
  ));
  const filteredContacts = contactItems.filter(item => (
    item.label.toLowerCase().includes(lowerSearch) ||
    item.value.toLowerCase().includes(lowerSearch)
  ));

  const showDocs = !lowerSearch || filteredDocs.length > 0 || 'documentation'.includes(lowerSearch);
  const showFaqs = !lowerSearch || filteredFaqs.length > 0 || 'faqs'.includes(lowerSearch);
  const showContacts = !lowerSearch || filteredContacts.length > 0 || 'contact info'.includes(lowerSearch);
  const showQuestion = !lowerSearch || 'ask a question'.includes(lowerSearch) || question.toLowerCase().includes(lowerSearch);
  const showBugReport = !lowerSearch || 'bug report'.includes(lowerSearch) || bugReport.toLowerCase().includes(lowerSearch);
  const showEmailSupport = !lowerSearch || 'email support'.includes(lowerSearch) || emailForm.message.toLowerCase().includes(lowerSearch);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setFileName(file.name);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const showNotice = (message) => {
    setNotice(message);
    setTimeout(() => setNotice(''), 3000);
  };

  const handleQuestionSubmit = () => {
    if (!question.trim()) {
      showNotice('Add a question before submitting.');
      return;
    }
    setQuestion('');
    showNotice('Question captured locally. Support workflow can be connected next.');
  };

  const handleBugSubmit = () => {
    if (!bugReport.trim()) {
      showNotice('Describe the issue before submitting.');
      return;
    }
    setBugReport('');
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    showNotice('Bug report captured locally. Ticket API can be connected next.');
  };

  const handleEmailSubmit = () => {
    if (!emailForm.email.trim() || !emailForm.message.trim()) {
      showNotice('Email and message are required.');
      return;
    }
    setEmailForm({ theme: '', email: '', category: 'Invoice Submission', message: '' });
    showNotice('Support message captured locally. Email API can be connected next.');
  };

  return (
    <div className="support-page">
      <section className="support-hero">
        <div className="support-hero__glow" />
        <h1>How can we help you?</h1>
        <p>Search the knowledge base or browse categories below.</p>
        <label className="support-search">
          <FiSearch size={17} />
          <input
            type="search"
            placeholder="Search articles, e.g. 'sandbox token expired'..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </label>
        <div className="support-hero__actions">
          <button className="support-secondary-action" type="button" onClick={() => setSearchTerm('')}>
            <FiRefreshCw size={16} /> Reset
          </button>
          <a className="support-primary-action" href="mailto:support@techionik.com">
            <FiMail size={16} /> Email Support
          </a>
        </div>
      </section>

      {notice && (
        <div className="support-notice">
          <FiCheckCircle size={18} />
          <span>{notice}</span>
        </div>
      )}

      <section className="support-category-grid" aria-label="Support categories">
        {helpCategories.map((category) => (
          <button type="button" className="support-help-cat" key={category.title} onClick={() => setSearchTerm(category.term)}>
            <span className="support-help-cat__icon">{category.icon}</span>
            <strong>{category.title}</strong>
            <small>{category.description}</small>
          </button>
        ))}
      </section>

      {!hasSearchMatch && (
        <div className="support-empty">
          No support topics matched your search.
        </div>
      )}

      <section className="support-workspace">
        <div className="support-main-column">
          {(showQuestion || showBugReport || showEmailSupport) && (
            <section className="support-panel">
              <div className="support-panel__top">
                <div>
                  <h2>Contact Support</h2>
                  <p>Share questions, issue details, or a message for the Techionik support team.</p>
                </div>
              </div>

              <div className="support-form-grid">
                {showQuestion && (
                  <article className="support-form-card">
                    <div className="support-card-heading">
                      <FiHelpCircle size={20} />
                      <div>
                        <strong>Ask a Question</strong>
                        <span>Use this for workflow or configuration questions.</span>
                      </div>
                    </div>
                    <label>
                      <span>Question</span>
                      <input
                        type="text"
                        placeholder="Can’t find what you are looking for?"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                      />
                    </label>
                    <button className="support-primary-action" type="button" onClick={handleQuestionSubmit}>
                      <FiSend size={16} /> Submit Question
                    </button>
                  </article>
                )}

                {showBugReport && (
                  <article className="support-form-card">
                    <div className="support-card-heading">
                      <FiShield size={20} />
                      <div>
                        <strong>Bug Report</strong>
                        <span>Attach context when something blocks invoice work.</span>
                      </div>
                    </div>
                    <label>
                      <span>Issue Details</span>
                      <textarea
                        rows="5"
                        placeholder="Describe the issue"
                        value={bugReport}
                        onChange={(e) => setBugReport(e.target.value)}
                      />
                    </label>
                    <input
                      type="file"
                      className="support-hidden-input"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                    />
                    <button type="button" className="support-secondary-action" onClick={triggerFileInput}>
                      <FiUpload size={16} /> Upload Screenshot
                    </button>
                    {fileName && <small className="support-file-name">{fileName}</small>}
                    <button className="support-primary-action" type="button" onClick={handleBugSubmit}>
                      <FiSend size={16} /> Submit Report
                    </button>
                  </article>
                )}
              </div>

              {showEmailSupport && (
                <article className="support-email-card">
                  <div className="support-card-heading">
                    <FiMail size={20} />
                    <div>
                      <strong>Email Support</strong>
                      <span>Prepare a structured support message.</span>
                    </div>
                  </div>

                  <div className="support-email-grid">
                    <label>
                      <span>Theme</span>
                      <input
                        value={emailForm.theme}
                        onChange={(e) => setEmailForm(prev => ({ ...prev, theme: e.target.value }))}
                        placeholder="Token setup, invoice failure..."
                      />
                    </label>
                    <label>
                      <span>Email</span>
                      <input
                        type="email"
                        value={emailForm.email}
                        onChange={(e) => setEmailForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="you@company.com"
                      />
                    </label>
                    <label>
                      <span>Category</span>
                      <select
                        value={emailForm.category}
                        onChange={(e) => setEmailForm(prev => ({ ...prev, category: e.target.value }))}
                      >
                        <option>Invoice Submission</option>
                        <option>Token / Settings</option>
                        <option>Sandbox Testing</option>
                        <option>Product Mapping</option>
                        <option>Account Access</option>
                      </select>
                    </label>
                    <label className="support-email-grid__wide">
                      <span>Message</span>
                      <textarea
                        value={emailForm.message}
                        onChange={(e) => setEmailForm(prev => ({ ...prev, message: e.target.value }))}
                        placeholder="Write the support message..."
                      />
                    </label>
                  </div>

                  <button className="support-primary-action" type="button" onClick={handleEmailSubmit}>
                    <FiSend size={16} /> Send Message
                  </button>
                </article>
              )}
            </section>
          )}

          {showFaqs && (
            <section className="support-panel">
              <div className="support-panel__top">
                <div>
                  <h2>FAQs</h2>
                  <p>Quick answers for common FBR digital invoicing issues.</p>
                </div>
              </div>

              <div className="support-faq-list">
                {(lowerSearch ? filteredFaqs : faqItems).map((item) => (
                  <details key={item.question}>
                    <summary>{item.question}</summary>
                    <p>{item.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="support-side-column">
          {showDocs && (
            <section className="support-panel">
              <div className="support-panel__top compact">
                <div>
                  <h2>Documentation</h2>
                  <p>Guides for common setup and invoice workflows.</p>
                </div>
              </div>

              <div className="support-link-list">
                {(lowerSearch ? filteredDocs : documentationLinks).map((item) => (
                  <button type="button" key={item} onClick={() => showNotice(`${item} can be connected to documentation next.`)}>
                    <FiBookOpen size={16} />
                    <span>{item}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {showContacts && (
            <section className="support-panel">
              <div className="support-panel__top compact">
                <div>
                  <h2>Contact Info</h2>
                  <p>Primary support channels for the invoicing portal.</p>
                </div>
              </div>

              <div className="support-contact-list">
                {(lowerSearch ? filteredContacts : contactItems).map((item) => (
                  <div key={item.label}>
                    <span className="support-contact-icon">{item.icon}</span>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.value}</small>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>
      </section>
    </div>
  );
}

export default Support;
