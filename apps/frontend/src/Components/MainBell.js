import React, { useEffect, useRef, useState } from 'react';
import img from '../Images/TechionikIcon.png';
import { FiBell } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';
import { IoHelpCircleOutline } from 'react-icons/io5';
import { IoIosLogOut } from 'react-icons/io';
import { RiAccountCircleLine } from "react-icons/ri";

const MainBell = () => {
  const emails = localStorage.getItem('email');
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpenMenu(null);
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const logout = () => {
    localStorage.removeItem('email');
    localStorage.removeItem('token');
    navigate('/');
  };

  return (
    <div className=''>
      {/* Topbar */}
      <div className="topbar-container d-flex justify-content-end align-items-center gap-4 px-4 py-2 ">
      

        <div className="d-flex align-items-center gap-3" ref={menuRef}>
          <div className="dropdown">
            <button
              className="position-relative bell-icon topbar-menu-button"
              type="button"
              aria-label="Notifications"
              aria-haspopup="menu"
              aria-expanded={openMenu === 'notifications'}
              onClick={() => setOpenMenu(openMenu === 'notifications' ? null : 'notifications')}
            >
              <FiBell size={22} />
              <span className="notification-dot"></span>
            </button>
            <ul className={`dropdown-menu dropdown-menu-end shadow-sm ${openMenu === 'notifications' ? 'show' : ''}`}>
              <li><span className="dropdown-item-text fw-bold">Notifications</span></li>
              <li><hr className="dropdown-divider" /></li>
              <li><a className="dropdown-item" href="#">New message received</a></li>
              <li><a className="dropdown-item" href="#">Product updated</a></li>
              <li><a className="dropdown-item" href="#">System maintenance</a></li>
            </ul>
          </div>

          <div className="dropdown">
            <button
              className="topbar-menu-button"
              type="button"
              aria-label="Account menu"
              aria-haspopup="menu"
              aria-expanded={openMenu === 'profile'}
              onClick={() => setOpenMenu(openMenu === 'profile' ? null : 'profile')}
            >
              <img src={img} alt="Profile" className="profile-pic" />
            </button>
            <ul className={`dropdown-menu dropdown-menu-end profile-dropdown shadow-sm ${openMenu === 'profile' ? 'show' : ''}`}>
              <li className='text-center fw-bold'><div className='heighlight-text'>Welcome</div> <div className='wrap-text px-4'>{emails}</div></li>
              <li><hr className="dropdown-divider" /></li>
              <li><Link to={'/account/edit-profile'} className="dropdown-item p-2 d-flex align-items-center" onClick={() => setOpenMenu(null)}><RiAccountCircleLine size={25} /> Account</Link></li>
              <li><hr className="dropdown-divider" /></li>
              <li><Link to={'/support'} className="dropdown-item p-2 d-flex align-items-center" onClick={() => setOpenMenu(null)}><IoHelpCircleOutline size={25} /> Help</Link></li>
              <li><hr className="dropdown-divider" /></li>
              <li><button onClick={() => { setOpenMenu(null); setShowLogoutConfirm(true); }} className="dropdown-item p-2 d-flex align-items-center bg-transparent border-0 w-100"><IoIosLogOut size={25} /> Logout</button></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Custom Logout Confirmation Popup */}
      {showLogoutConfirm && (
        <div className="logout-overlay">
          <div className="logout-popup">
            <h5>Are you sure you want to logout?</h5>
            <div className="mt-3 d-flex justify-content-center gap-3">
              <button className="btn buttonsave p-2 px-4" onClick={logout}>Yes</button>
              <button className="btn btn-secondary px-4" onClick={() => setShowLogoutConfirm(false)}>No</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainBell;
