import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { FiMenu } from 'react-icons/fi';
import AccSidebar from './Pages/Account/AccSidebar';
import EditProfile from './Pages/Account/EditProfile';
import ChangePassword from './Pages/Account/ChangePassword';
import TwoFactor from './Pages/Account/TwoFactor';
import Language from './Pages/Account/Language';
import Deactive from './Pages/Account/Deactive';
import Terms from './Pages/Account/Terms';
import Privacy from './Pages/Account/Privacy';
import './Pages/Account/Account.css';

function AccApp() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const toggleSidebar = () => setIsSidebarOpen((open) => !open);
  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="account-app-shell">
      <button
        className="account-mobile-toggle"
        type="button"
        onClick={toggleSidebar}
        aria-label="Open account navigation"
      >
        <FiMenu size={22} />
      </button>

      {isSidebarOpen && (
        <button
          className="account-sidebar-backdrop"
          type="button"
          onClick={closeSidebar}
          aria-label="Close account navigation"
        />
      )}

      <AccSidebar isOpen={isSidebarOpen} onClose={closeSidebar} />

      <main className="account-main">
        <Routes>
          <Route index element={<Navigate to="edit-profile" replace />} />
          <Route path="edit-profile" element={<EditProfile />} />
          <Route path="change-password" element={<ChangePassword />} />
          <Route path="privacy-settings/two-factor" element={<TwoFactor />} />
          <Route path="privacy-settings/language" element={<Language />} />
          <Route path="account-manager/deactive-account" element={<Deactive />} />
          <Route path="account-manager/terms-conditions" element={<Terms />} />
          <Route path="account-manager/privacy-policy" element={<Privacy />} />
        </Routes>
      </main>
    </div>
  );
}

export default AccApp;
