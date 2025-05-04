import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { CartCount, MessageCount } from './App';
import logo from './assets/lion-logo.svg';

function MobileSidebar({ isOpen, onClose, isAuthenticated, isVerified, onLogout }) {
  const { currentUser, authAxios } = useAuth();
  const [profileData, setProfileData] = useState({
    fullName: '',
    profileImage: ''
  });
  
  // Fetch profile data when sidebar opens
  useEffect(() => {
    if (isOpen && isAuthenticated && currentUser) {
      const fetchProfileData = async () => {
        if (!isAuthenticated || !currentUser || !currentUser.userId) {
          console.log("Skipping profile fetch in sidebar: Not authenticated or incomplete user data");
          return;
        }
        
        try {
          console.log("Fetching profile data in sidebar for user:", currentUser.userId);
          const response = await authAxios.get('/users/profile');
          
          if (response.data) {
            console.log("Sidebar profile data received:", response.data);
            setProfileData(response.data);
          }
        } catch (error) {
          console.error('Error fetching profile data in sidebar:', error);
          console.error('Error details:', error.response?.data || error.message);
          // Initialize with email if we can't fetch profile
              setProfileData({
            fullName: currentUser.email || 'User',
            profileImage: ''
              });
        }
      };
      
      fetchProfileData();
    }
  }, [isOpen, isAuthenticated, currentUser, authAxios]);
  
  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose}></div>}
      <div className={`mobile-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <Link to="/" className="logo-container" onClick={onClose}>
            <img src={logo} alt="Lion Bay" className="logo" />
            <span className="logo-text">LionBay</span>
            </Link>
          <button className="close-sidebar" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        {isAuthenticated && currentUser && (
          <div className="sidebar-profile">
            <div className="sidebar-profile-image">
              {profileData.profileImage ? (
                <img src={profileData.profileImage} alt="Profile" />
              ) : (
                <i className="fas fa-user-circle"></i>
              )}
            </div>
            <div className="sidebar-profile-info">
              <span className="sidebar-profile-name">{profileData.fullName || currentUser.email}</span>
              <span className="sidebar-profile-email">{currentUser.email}</span>
            </div>
          </div>
        )}
        
        <div className="sidebar-content">
          <Link to="/home" className="sidebar-link" onClick={onClose}>
            <i className="fas fa-home sidebar-icon"></i>
            Home
          </Link>
        
          <Link to="/market" className="sidebar-link" onClick={onClose}>
            <i className="fas fa-store sidebar-icon"></i>
            Buy Stuff
          </Link>
          
          <Link to="/create-product" className="sidebar-link" onClick={onClose}>
            <i className="fas fa-plus-circle sidebar-icon"></i>
            Sell Stuff
          </Link>
          
          <Link to="/discover" className="sidebar-link" onClick={onClose}>
            <i className="fas fa-fire sidebar-icon"></i>
            Swipe and Shop
          </Link>
          
          {isAuthenticated && (
            <>
              <span className="sidebar-link coming-soon">
                <i className="fas fa-user sidebar-icon"></i>
                Profile <span className="coming-soon-badge">Coming Soon</span>
              </span>
              
              <Link to="/my-products" className="sidebar-link" onClick={onClose}>
                <i className="fas fa-tag sidebar-icon"></i>
                My Products
              </Link>
              
              <Link to="/cart" className="sidebar-link" onClick={onClose}>
                <i className="fas fa-shopping-cart sidebar-icon"></i>
                Cart {<CartCount /> > 0 && <span className="mobile-badge">{<CartCount />}</span>}
              </Link>
              
              <Link to="/chats" className="sidebar-link" onClick={onClose}>
                <i className="fas fa-comments sidebar-icon"></i>
                DMs {<MessageCount /> && <span className="mobile-badge">{<MessageCount />}</span>}
              </Link>
              
              <button className="mobile-logout-button" onClick={() => {
                onLogout();
                onClose();
                // Force navigation to home page
                window.location.href = '/';
              }}>
                <i className="fas fa-sign-out-alt sidebar-icon" style={{ color: "white", marginRight: "10px" }}></i>
                logout
              </button>
            </>
          )}
          
          {!isAuthenticated && (
            <Link to="/login" className="sidebar-link login-sidebar-link" onClick={onClose}>
              <i className="fas fa-sign-in-alt sidebar-icon"></i>
              login
            </Link>
          )}
        </div>
      </div>
    </>
  );
}

export default MobileSidebar; 