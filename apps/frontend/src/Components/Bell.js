import React, { useState } from 'react';
import img from '../Images/TechionikIcon.png';
import { FiBell, FiSearch } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';
import { IoHelpCircleOutline } from 'react-icons/io5';
import { IoIosLogOut } from 'react-icons/io';
import { RiAccountCircleLine } from "react-icons/ri";

const Bell = () => {
 const emails = localStorage.getItem('email');
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const logout = () => {
    localStorage.removeItem('email');
    localStorage.removeItem('token');
    navigate('/');
  };

  return (
    <div className='d-flex align-items-center gap-3'>
      <div className="dropdown">
                  <div className="position-relative bell-icon" data-bs-toggle="dropdown" aria-expanded="false" role="button">
                    <FiBell size={22} />
                    <span className="notification-dot"></span>
                  </div>
                  <ul className="dropdown-menu dropdown-menu-end shadow-sm">
                    <li><span className="dropdown-item-text fw-bold">Notifications</span></li>
                    <li><hr className="dropdown-divider" /></li>
                    <li><a className="dropdown-item" href="#">New message received</a></li>
                    <li><a className="dropdown-item" href="#">Product updated</a></li>
                    <li><a className="dropdown-item" href="#">System maintenance</a></li>
                  </ul>
                </div>

                <div className="dropdown">
                  <img src={img} alt="Profile" className="profile-pic dropdown-toggle" role="button" data-bs-toggle="dropdown" aria-expanded="false" />
                  <ul className="dropdown-menu dropdown-menu-end profile-dropdown shadow-sm">
                    <li className='text-center fw-bold'><div className='heighlight-text'>Welcome</div> {emails}</li>
                    
                    <li><hr className="dropdown-divider" /></li>
                    <li><Link to={'/support'} className="dropdown-item  p-2 d-flex align-items-center"><IoHelpCircleOutline size={25}    /> Help</Link></li>
                    <li><hr className="dropdown-divider" /></li>
                   <li><button onClick={() => setShowLogoutConfirm(true)} className="dropdown-item p-2 d-flex align-items-center bg-transparent border-0 w-100"><IoIosLogOut size={25} /> Logout</button></li>
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
