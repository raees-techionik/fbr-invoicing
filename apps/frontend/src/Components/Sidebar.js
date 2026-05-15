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
  FiUpload,
  FiUser,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import { MdBiotech, MdLogout, MdOutlineWifiOff, MdPeopleAlt } from 'react-icons/md';
import { TbLayoutSidebarLeftCollapseFilled, TbLayoutSidebarLeftExpandFilled } from 'react-icons/tb';

const SIDEBAR_OVERLAY_BREAKPOINT = 900;

function Sidebar({ isOpen, toggleSidebar, isCollapsed, toggleCollapse }) {
  const [expandedItems, setExpandedItems] = useState({});
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
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
    { name: 'Company', path: '/company-profile', icon: <FiUser /> },
    { name: 'Customers', path: '/customers', icon: <FiUsers /> },
    { name: 'Services', path: '/services', icon: <FiSettings /> },
    { name: 'Products', path: '/products', icon: <BsBox /> },
    { name: 'Staff', path: '/staff', icon: <MdPeopleAlt /> },
    { name: 'Sandbox', path: '/sandbox', icon: <MdBiotech /> },
  ];

  const isItemActive = (item) => {
    if (!item.subItems) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  };

  const toggleItem = (index) => {
    setExpandedItems((prev) => ({
      ...prev,
      [index]: !prev[index],
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
            <span className="app-sidebar__brand-powered">
              Powered by <strong>TECHIONIK</strong>
            </span>
          </>
        )}
      </NavLink>

      <nav className="app-sidebar__nav" aria-label="Main navigation">
        {menuItems.map((item, index) => (
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
                    <span className="app-sidebar__nav-label">{item.name}</span>
                  </NavLink>
                  {!isCollapsed && (
                    <button
                      className="app-sidebar__submenu-toggle"
                      type="button"
                      onClick={() => toggleItem(index)}
                      aria-label={`${expandedItems[index] ? 'Collapse' : 'Expand'} ${item.name}`}
                    >
                      {expandedItems[index] || location.pathname.startsWith(item.path) ? <FiChevronDown /> : <FiChevronRight />}
                    </button>
                  )}
                </div>

                {!isCollapsed && (expandedItems[index] || location.pathname.startsWith(item.path)) && (
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
                <span className="app-sidebar__nav-label">{item.name}</span>
              </NavLink>
            )}
          </div>
        ))}
      </nav>

      <div className="app-sidebar__footer">
        <div className="app-sidebar__utility">
          <NavLink
            to="/settings"
            onClick={handleNavigate}
            className={({ isActive }) => `app-sidebar__utility-link ${isActive ? 'active' : ''}`}
            title={isCollapsed ? 'Settings' : undefined}
          >
            <FiSettings />
            <span>Settings</span>
          </NavLink>

          <NavLink
            to="/support"
            onClick={handleNavigate}
            className={({ isActive }) => `app-sidebar__utility-link ${isActive ? 'active' : ''}`}
            title={isCollapsed ? 'Support' : undefined}
          >
            <FaCircleQuestion />
            <span>Support</span>
          </NavLink>

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
