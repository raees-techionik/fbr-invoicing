import React, { useEffect, useRef, useState } from 'react';
import img from '../Images/TechionikIcon.png';
import { Link, useNavigate } from 'react-router-dom';
import { IoHelpCircleOutline } from 'react-icons/io5';
import { IoIosLogOut } from 'react-icons/io';
import { RiAccountCircleLine } from "react-icons/ri";
import NotificationMenu from './NotificationMenu';

const Bell = () => {
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
    <div className='d-flex align-items-center gap-3' ref={menuRef}>
      <NotificationMenu
        open={openMenu === 'notifications'}
        onToggle={(open) => setOpenMenu(open ? 'notifications' : null)}
        onClose={() => setOpenMenu(null)}
      />

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
                    <li className='text-center fw-bold'><div className='heighlight-text'>Welcome</div> {emails}</li>
                    
                    <li><hr className="dropdown-divider" /></li>
                    <li><Link to={'/support'} className="dropdown-item  p-2 d-flex align-items-center" onClick={() => setOpenMenu(null)}><IoHelpCircleOutline size={25}    /> Help</Link></li>
                    <li><hr className="dropdown-divider" /></li>
                   <li><button onClick={() => { setOpenMenu(null); setShowLogoutConfirm(true); }} className="dropdown-item p-2 d-flex align-items-center bg-transparent border-0 w-100"><IoIosLogOut size={25} /> Logout</button></li>
                  </ul>
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
  )
}

export default Bell
