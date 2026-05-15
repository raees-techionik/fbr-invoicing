import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { FiChevronDown, FiChevronRight, FiEdit3, FiLock, FiShield, FiX } from 'react-icons/fi';
import { MdManageAccounts } from 'react-icons/md';
import { BsArrowReturnRight } from 'react-icons/bs';
import img from '../../Images/TechionikIcon.png';
import useBlockBackButton from '../../Components/useBlockBackButton';
import './AccSidebar.css';

const menuItems = [
  {
    name: 'Edit Profile',
    path: '/account/edit-profile',
    icon: <FiEdit3 size={18} />,
  },
  {
    name: 'Change Password',
    path: '/account/change-password',
    icon: <FiLock size={18} />,
  },
  {
    name: 'Privacy & Settings',
    path: '/account/privacy-settings',
    icon: <FiShield size={18} />,
    subItems: [
      { name: 'Two Factor', path: '/account/privacy-settings/two-factor' },
      { name: 'Language', path: '/account/privacy-settings/language' },
    ],
  },
  {
    name: 'Account Manager',
    path: '/account/account-manager',
    icon: <MdManageAccounts size={20} />,
    subItems: [
      { name: 'Deactivate Account', path: '/account/account-manager/deactive-account' },
      { name: 'Terms & Conditions', path: '/account/account-manager/terms-conditions' },
      { name: 'Privacy Policy', path: '/account/account-manager/privacy-policy' },
    ],
  },
];

function AccSidebar({ isOpen, onClose }) {
  useBlockBackButton();
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState({});

  useEffect(() => {
    const nextExpanded = {};
    menuItems.forEach((item, index) => {
      if (item.subItems && location.pathname.startsWith(item.path)) {
        nextExpanded[index] = true;
      }
    });
    setExpandedItems((current) => ({ ...current, ...nextExpanded }));
  }, [location.pathname]);

  const toggleItem = (index) => {
    setExpandedItems((current) => ({
      ...current,
      [index]: !current[index],
    }));
  };

  const isItemActive = (item) => (
    item.subItems ? location.pathname.startsWith(item.path) : location.pathname === item.path
  );

  return (
    <aside className={`account-sidebar ${isOpen ? 'open' : ''}`} aria-label="Account navigation">
      <div className="account-sidebar-header">
        <div className="account-brand-lockup">
          <img src={img} alt="Techionik" />
          <div>
            <strong>Account</strong>
            <span>Techionik Digital Invoicing</span>
          </div>
        </div>
        <button className="account-sidebar-close" type="button" onClick={onClose} aria-label="Close account navigation">
          <FiX size={20} />
        </button>
      </div>

      <nav className="account-sidebar-nav">
        {menuItems.map((item, index) => {
          const active = isItemActive(item);
          const expanded = Boolean(expandedItems[index]);

          if (item.subItems) {
            return (
              <div className="account-nav-group" key={item.name}>
                <button
                  className={`account-nav-item ${active ? 'active' : ''}`}
                  type="button"
                  onClick={() => toggleItem(index)}
                  aria-expanded={expanded}
                >
                  <span>
                    {item.icon}
                    {item.name}
                  </span>
                  {expanded ? <FiChevronDown size={17} /> : <FiChevronRight size={17} />}
                </button>

                {expanded && (
                  <div className="account-subnav">
                    {item.subItems.map((subItem) => (
                      <NavLink
                        key={subItem.path}
                        to={subItem.path}
                        className={({ isActive }) => `account-subnav-item ${isActive ? 'active' : ''}`}
                        onClick={onClose}
                        end
                      >
                        {location.pathname === subItem.path && <BsArrowReturnRight size={14} aria-hidden="true" />}
                        <span>{subItem.name}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `account-nav-item ${isActive ? 'active' : ''}`}
              onClick={onClose}
              end
            >
              <span>
                {item.icon}
                {item.name}
              </span>
            </NavLink>
          );
        })}
      </nav>

      <div className="account-sidebar-footer">
        <img src={img} alt="" />
        <div>
          <span>Powered by</span>
          <strong>Techionik</strong>
        </div>
      </div>
    </aside>
  );
}

export default AccSidebar;
