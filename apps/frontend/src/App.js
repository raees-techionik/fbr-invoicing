import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import Login from "./Login";
import Signup from "./Signup";
import Dashboard from "./Pages/Dashboard";
import Sidebar from "./Components/Sidebar";
import Company from "./Pages/Company";
import Customers from "./Pages/Customers";
import Services from "./Pages/Services";
import Products from "./Pages/Products";
import Staff from "./Pages/Staff";
import AccApp from "./AccApp";
import Support from './Pages/Support';
import Settings from './Pages/Settings';
import { FiMenu } from 'react-icons/fi';
import StepOne from './ForgotPassword/StepOne';
import StepTwo from './ForgotPassword/StepTwo';
import StepThree from './ForgotPassword/StepThree';
import Invoice from './Pages/Invoices/Invoice';
import AddInvoice from './Pages/Invoices/AddInvoice';
import UploadInvoice from './Pages/Invoices/UploadInvoice';
import Preview from './Pages/Invoices/Preview';
import OfflineQueue from './Pages/OfflineQueue';
import Sandbox from './Pages/Sandbox';
import OfflineBanner from './Components/OfflineBanner';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { getOfflineQueueSummary, processOfflineQueue } from './services/fbrOfflineQueueApi';
import './AppShell.css';
import OnboardingWorkspace from './Pages/OnboardingWorkspace';
import InvitationAcceptance from './Pages/InvitationAcceptance';
import { CompanyProvider } from './contexts/CompanyContext';

const SIDEBAR_OVERLAY_BREAKPOINT = 900;

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/" replace />;
  return children;
}

function PublicOnlyRoute({ children }) {
  const token = localStorage.getItem('token');
  if (token) return <Navigate to="/dashboard" replace />;
  return children;
}

function MainContent() {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth > SIDEBAR_OVERLAY_BREAKPOINT
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const { isOnline } = useOnlineStatus();
  const prevOnlineRef = useRef(null);
  const wasOverlayLayoutRef = useRef(
    typeof window === 'undefined' ? false : window.innerWidth <= SIDEBAR_OVERLAY_BREAKPOINT
  );

  const refreshQueueCount = useCallback(async () => {
    try {
      const summary = await getOfflineQueueSummary();
      setQueueCount((summary.offline ?? 0) + (summary.upload_failed ?? 0));
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    refreshQueueCount();
  }, [refreshQueueCount]);

  useEffect(() => {
    const handleResize = () => {
      const isOverlayLayout = window.innerWidth <= SIDEBAR_OVERLAY_BREAKPOINT;

      if (isOverlayLayout !== wasOverlayLayoutRef.current) {
        setIsSidebarOpen(!isOverlayLayout);
        wasOverlayLayoutRef.current = isOverlayLayout;
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (prevOnlineRef.current === false && isOnline) {
      setIsProcessing(true);
      refreshQueueCount().then(() =>
        processOfflineQueue()
          .catch(() => {})
          .finally(async () => {
            await refreshQueueCount();
            setIsProcessing(false);
          })
      );
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline, refreshQueueCount]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const toggleCollapse = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const showSidebarToggle = !['/', '/signup', '/forgot-password', '/forgot-password/reset-password', '/forgot-password/reset-password/new-password'].includes(location.pathname);
  const showSystemBanner = !isOnline || isProcessing;

  const PageWithSidebar = ({ component: Component }) => (
    <div className={`app-shell ${isSidebarCollapsed ? 'is-sidebar-collapsed' : ''} ${showSystemBanner ? 'has-system-banner' : ''}`}>
      {isSidebarOpen && <button type="button" className="sidebar-backdrop" aria-label="Close menu" onClick={toggleSidebar} />}
      <Sidebar
        isOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
        isCollapsed={isSidebarCollapsed}
        toggleCollapse={toggleCollapse}
      />
      <main className="main-content">
        <Component />
      </main>
    </div>
  );

  const ProtectedPage = ({ component }) => (
    <ProtectedRoute>
      <PageWithSidebar component={component} />
    </ProtectedRoute>
  );

  return (
    <>
      <OfflineBanner isOnline={isOnline} queueCount={queueCount} isProcessing={isProcessing} />

      {showSidebarToggle && (
        <div className={`mobile-menu-button ${showSystemBanner ? 'has-system-banner' : ''}`}>
          <button type="button" onClick={toggleSidebar} aria-label="Open menu">
            <FiMenu size={24} />
          </button>
        </div>
      )}

      <Routes>
        {/* Public — redirect to dashboard if already logged in */}
        <Route path="/" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
        <Route path="/signup" element={<PublicOnlyRoute><Signup /></PublicOnlyRoute>} />
        <Route path="/forgot-password" element={<PublicOnlyRoute><StepOne /></PublicOnlyRoute>} />
        <Route path="/forgot-password/reset-password" element={<PublicOnlyRoute><StepTwo /></PublicOnlyRoute>} />
        <Route path="/forgot-password/reset-password/new-password" element={<PublicOnlyRoute><StepThree /></PublicOnlyRoute>} />

        {/* Protected — redirect to login if no token */}
        <Route path="/dashboard" element={<ProtectedPage component={Dashboard} />} />
        <Route path="/invoice" element={<ProtectedPage component={Invoice} />} />
        <Route path="/invoice/add" element={<ProtectedPage component={AddInvoice} />} />
        <Route path="/invoice/upload" element={<ProtectedPage component={UploadInvoice} />} />
        <Route path="/invoice/upload/preview" element={<ProtectedPage component={Preview} />} />
        <Route path="/invoice/offline-queue" element={<ProtectedPage component={OfflineQueue} />} />
        <Route path="/company-profile" element={<ProtectedPage component={Company} />} />
        <Route path="/customers" element={<ProtectedPage component={Customers} />} />
        <Route path="/services" element={<ProtectedPage component={Services} />} />
        <Route path="/products" element={<ProtectedPage component={Products} />} />
        <Route path="/staff" element={<ProtectedPage component={Staff} />} />
        <Route path="/sandbox" element={<ProtectedPage component={Sandbox} />} />
        <Route path="/onboarding" element={<ProtectedPage component={OnboardingWorkspace} />} />
        <Route path="/company-invitation/:token" element={<ProtectedPage component={InvitationAcceptance} />} />
        <Route path="/support" element={<ProtectedPage component={Support} />} />
        <Route path="/settings" element={<ProtectedPage component={Settings} />} />
        <Route path="/account/*" element={<ProtectedRoute><AccApp /></ProtectedRoute>} />
      </Routes>
    </>
  );
}

function App() {
  const [language, setLanguage] = useState(localStorage.getItem('preferredLanguage') || 'en');
  const [loading, setLoading] = useState(true);

  const changeLanguage = useCallback((lang) => {
    localStorage.setItem('preferredLanguage', lang);
    setLanguage(lang);

    const select = document.querySelector('.goog-te-combo');
    if (select) {
      select.value = lang;
      select.dispatchEvent(new Event('change'));
      setTimeout(() => setLoading(false), 1000);
    } else {
      const frame = document.querySelector('.goog-te-menu-frame');
      if (frame) {
        const innerSelect = frame.contentDocument.querySelector('.goog-te-combo');
        if (innerSelect) {
          innerSelect.value = lang;
          innerSelect.dispatchEvent(new Event('change'));
          setTimeout(() => setLoading(false), 1000);
        }
      } else {
        document.cookie = `googtrans=/en/${lang}; path=/`;
        window.location.reload();
      }
    }
  }, []);

  // Inject Google Translate script
  useEffect(() => {
    const scriptId = 'google-translate-script';

    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      document.body.appendChild(script);
    }

    window.googleTranslateElementInit = () => {
      if (window.google && window.google.translate) {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'en',
            includedLanguages: 'en,ur,es,fr,ar',
            layout: window.google.translate.TranslateElement.InlineLayout.HORIZONTAL,
            autoDisplay: false,
          },
          'google_translate_element'
        );

        // Wait a bit and apply stored language
        setTimeout(() => {
          changeLanguage(language);
        }, 1000);
      }
    };

    // Hide default Google Translate UI
    const style = document.createElement('style');
    style.innerHTML = `
      .goog-te-combo,
      .goog-te-banner *,
      .goog-te-ftab *,
      .skiptranslate {
        display: none !important;
      }
      body {
        top: 0 !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      if (window.googleTranslateElementInit) {
        delete window.googleTranslateElementInit;
      }
    };
  }, [changeLanguage, language]);

  return (
    <Router>
      <div id="google_translate_element" style={{ display: 'none' }}></div>

      {loading ? (
        <div className="custom-loader-wrapper">
          <div className="custom-spinner"></div>
          <span className="visually-hidden">Loading...</span>
        </div>
      ) : (
        <CompanyProvider><MainContent /></CompanyProvider>
      )}
    </Router>
  );
}

export default App;
