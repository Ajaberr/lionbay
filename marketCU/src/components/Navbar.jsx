import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { CartCount, MessageCount, useMessages } from '../App';
import { useCart } from '../CartContext';

function Navbar() {
  const { isAuthenticated, currentUser, logout } = useAuth();
  const { cartCount } = useCart();
  const { unreadCount } = useMessages();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef(null);
  const isVerified = true; // For now, assume all users are verified

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  const toggleMobileMenu = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = () => {
    if (logout) {
      logout();
      setDropdownOpen(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const resendVerificationEmail = () => {
    // This is a placeholder. You would typically call an API endpoint here
    console.log('Resending verification email...');
    alert('Verification email sent!');
  };

  // Active link logic
  const isActiveLink = (path) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/home';
    }
    return location.pathname.startsWith(path);
  };

  // Create appropriate classes for navigation links
  const getLinkClass = (path) => {
    return `nav-link ${isActiveLink(path) ? 'active' : ''}`;
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <img src="/images/logo.png" alt="MarketCU Logo" className="navbar-logo-img" />
          MarketCU
        </Link>
        
        <div className="navbar-links">
          <Link to="/marketplace" className={getLinkClass('/marketplace')}>Marketplace</Link>
          {isAuthenticated && (
            <>
              <Link to="/sell" className={getLinkClass('/sell')}>Sell</Link>
              <Link to="/orders" className={getLinkClass('/orders')}>Orders</Link>
              <Link to="/chats" className={getLinkClass('/chats')}>
                Messages
                {unreadCount > 0 && (
                  <span className="nav-badge message-badge">{unreadCount}</span>
                )}
              </Link>
              <Link to="/cart" className={getLinkClass('/cart')}>
                <i className="fas fa-shopping-cart"></i>
                {cartCount > 0 && (
                  <span className="nav-badge">{cartCount}</span>
                )}
              </Link>
              <div className="navbar-user" onClick={toggleDropdown} ref={dropdownRef}>
                <i className="fas fa-user-circle"></i>
                {currentUser && currentUser.name && (
                  <span className="navbar-username">{currentUser.name}</span>
                )}
                {dropdownOpen && (
                  <div className="user-dropdown">
                    {isVerified ? (
                      <>
                        <Link to="/profile" className="dropdown-item">Profile</Link>
                        <Link to="/listings" className="dropdown-item">My Listings</Link>
                        <Link to="/favorites" className="dropdown-item">Favorites</Link>
                        <button onClick={handleLogout} className="dropdown-item">Logout</button>
                      </>
                    ) : (
                      <>
                        <div className="verification-warning">
                          <i className="fas fa-exclamation-triangle"></i>
                          <span>Please verify your email</span>
                        </div>
                        <button onClick={resendVerificationEmail} className="dropdown-item verification-action">
                          Resend Verification Email
                        </button>
                        <button onClick={handleLogout} className="dropdown-item">Logout</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
          {!isAuthenticated && (
            <>
              <Link to="/login" className="navbar-link">Login</Link>
              <Link to="/register" className="navbar-link highlight">Sign Up</Link>
            </>
          )}
        </div>
        
        <div className="menu-icon" onClick={toggleMobileMenu}>
          <i className={mobileOpen ? "fas fa-times" : "fas fa-bars"}></i>
        </div>
      </div>
    </nav>
  );
}

export default Navbar; 