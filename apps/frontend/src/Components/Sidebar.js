import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import './Sidebar.css';
import icon from '../Images/TechionikIcon.png';
import { BsBox } from 'react-icons/bs';
import { FaCircleQuestion } from 'react-icons/fa6';
import {
  FiChevronDown,
  FiChevronRight,
  FiFileText,
  FiHome,
  FiPlus,
  FiSettings,
  FiTool,
  FiUpload,
  FiUser,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import { MdBiotech, MdLogout, MdOutlineWifiOff, MdPeopleAlt } from 'react-icons/md';
import { TbLayoutSidebarLeftCollapseFilled, TbLayoutSidebarLeftExpandFilled } from 'react-icons/tb';
import { FiCheckSquare } from 'react-icons/fi';
import CompanySwitcher from './CompanySwitcher';
import { clearCompanySession } from '../services/companySession';

const SIDEBAR_OVERLAY_BREAKPOINT = 900;

const navSections = [
  {
    label: 'Main',
    items: [
      { name: 'Dashboard', path: '/dashboard', icon: <FiHome /> },
      {
        name: 'Invoices',
        path: '/invoice',
        icon: <FiFileText />,
        subItems: [
          { name: 'Add Invoice', path: '/invoice/add', icon: <FiPlus /> },
          { name: 'Upload Invoice', path: '/invoice/upload', icon: <FiUpload /> },
          { name: 'Offline Queue', path: '/invoice/offline-queue', icon: <MdOutlineWifiOff /> },
        ],
      },
      { name: 'Customers', path: '/customers', icon: <FiUsers /> },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { name: 'Services', path: '/services', icon: <FiTool /> },
      { name: 'Products', path: '/products', icon: <BsBox /> },
    ],
  },
  {
    label: 'Organization',
    items: [
      { name: 'Staff', path: '/staff', icon: <MdPeopleAlt /> },
      { name: 'Company Profile', path: '/company-profile', icon: <FiUser /> },
    ],
  },
  {
    label: 'FBR Integration',
    items: [
      { name: 'Sandbox', path: '/sandbox', icon: <MdBiotech /> },
      { name: 'Settings', path: '/settings', icon: <FiSettings /> },
      { name: 'Onboarding', path: '/onboarding', icon: <FiCheckSquare /> },
    ],
  },
  {
    label: 'Help',
    items: [
      { name: 'Support', path: '/support', icon: <FaCircleQuestion /> },
    ],
  },
];

function Sidebar({ isOpen, toggleSidebar, isCollapsed, toggleCollapse }) {
  const [expandedItems, setExpandedItems] = useState({});
  const location = useLocation();
  const navigate = useNavigate();

  const isItemActive = (item) => {
    if (!item.subItems) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  };

  const toggleItem = (key) => {
    setExpandedItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleNavigate = () => {
    if (window.innerWidth <= SIDEBAR_OVERLAY_BREAKPOINT && isOpen) {
      toggleSidebar();
    }
  };

  const logout = () => {
    localStorage.removeItem('email');
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    clearCompanySession();
    navigate('/');
  };

  return (
    <aside className={`sidebar app-sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="app-sidebar__topbar">
        <button className="app-sidebar__close" type="button" onClick={toggleSidebar} aria-label="Close menu">
          <FiX />
        </button>

        <button
          className="app-sidebar__collapse"
          type="button"
          onClick={toggleCollapse}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <TbLayoutSidebarLeftExpandFilled /> : <TbLayoutSidebarLeftCollapseFilled />}
        </button>
      </div>

      <NavLink className="app-sidebar__brand" to="/dashboard" onClick={handleNavigate} aria-label="Dashboard">
        {isCollapsed ? (
          <img src={icon} alt="Techionik" className="app-sidebar__brand-icon" />
        ) : (
          <>
            <img src={icon} alt="Techionik" className="app-sidebar__brand-logo" />
            <span className="app-sidebar__brand-title">Digital Invoicing</span>
          </>
        )}
      </NavLink>

      <CompanySwitcher isCollapsed={isCollapsed} />

      <nav className="app-sidebar__nav" aria-label="Main navigation">
        {navSections.map((section) => (
          <div className="app-sidebar__nav-section" key={section.label}>
            {!isCollapsed && <div className="app-sidebar__nav-label">{section.label}</div>}
            {section.items.map((item) => (
              <div className="app-sidebar__nav-group" key={item.name}>
                {item.subItems ? (
                  <>
                    <div className={`app-sidebar__nav-link ${isItemActive(item) ? 'active' : ''}`}>
                      <NavLink
                        to={item.path}
                        onClick={handleNavigate}
                        className="app-sidebar__nav-main"
                        title={isCollapsed ? item.name : undefined}
                      >
                        <span className="app-sidebar__nav-icon">{item.icon}</span>
                        <span className="app-sidebar__nav-label-text">{item.name}</span>
                      </NavLink>
                      {!isCollapsed && (
                        <button
                          className="app-sidebar__submenu-toggle"
                          type="button"
                          onClick={() => toggleItem(item.name)}
                          aria-label={`${expandedItems[item.name] ? 'Collapse' : 'Expand'} ${item.name}`}
                        >
                          {expandedItems[item.name] || location.pathname.startsWith(item.path) ? <FiChevronDown /> : <FiChevronRight />}
                        </button>
                      )}
                    </div>

                    {!isCollapsed && (expandedItems[item.name] || location.pathname.startsWith(item.path)) && (
                      <div className="app-sidebar__submenu">
                        {item.subItems.map((subItem) => (
                          <NavLink
                            key={subItem.path}
                            to={subItem.path}
                            onClick={handleNavigate}
                            className={({ isActive }) => `app-sidebar__submenu-link ${isActive ? 'active' : ''}`}
                          >
                            <span>{subItem.icon}</span>
                            {subItem.name}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <NavLink
                    to={item.path}
                    onClick={handleNavigate}
                    className={({ isActive }) => `app-sidebar__nav-link ${isActive ? 'active' : ''}`}
                    title={isCollapsed ? item.name : undefined}
                    end
                  >
                    <span className="app-sidebar__nav-icon">{item.icon}</span>
                    <span className="app-sidebar__nav-label-text">{item.name}</span>
                  </NavLink>
                )}
              </div>
            ))}
          </div>
        ))}
      </nav>

      <div className="app-sidebar__footer">
        <div className="app-sidebar__utility">
          <button className="app-sidebar__utility-link" type="button" onClick={logout} title={isCollapsed ? 'Log out' : undefined}>
            <MdLogout />
            <span>Log out</span>
          </button>
        </div>

        <div className="app-sidebar__powered">
          <img src={icon} alt="Techionik" />
          <span>
            Powered by <strong>Techionik</strong>
          </span>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
