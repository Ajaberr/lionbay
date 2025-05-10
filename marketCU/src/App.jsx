import { useState, useContext, createContext, useEffect, useRef, Fragment as Fragment2 } from 'react';
import { BrowserRouter as Router, Route, Routes, Link, Navigate, useParams, useNavigate, useLocation } from 'react-router-dom';
import './styles/App.css';
import './App.css';
import './styles/ProductDetail.css';
import './styles/MultiImageUpload.css';
import logo from './assets/lion-logo.svg';
import axios from 'axios';
import { io } from 'socket.io-client';
import LoginPage from './components/LoginPage';
import HomePage from './components/HomePage';
import ToastNotification from './components/ToastNotification';
import HelpChatWidget from './components/HelpChatWidget';
import AdminDashboard from './components/AdminDashboard';
import PageTitle from './components/PageTitle';
import SwipeDiscovery from './components/SwipeDiscovery';
import DiscoverFeature from './components/DiscoverFeature';
import { API_BASE_URL, SOCKET_URL } from './config';
import Todo from './components/Todo';

// Define product categories for consistency
const PRODUCT_CATEGORIES = [
  "Laptops & Accessories",
  "Textbooks & Study Guides",
  "Dorm & Apartment Essentials",
  "Bicycles & Scooters",
  "Electronics & Gadgets",
  "Furniture & Storage",
  "Clothing & Fashion",
  "School Supplies"
];

// Helper function to get the first image from a pipe-separated string
const getFirstImage = (imagePath) => {
  if (!imagePath) return "/api/placeholder/300/300";
  
  // Split by pipe symbol and get the first image URL
  const images = imagePath.split('|').filter(img => img.trim());
  return images.length > 0 ? images[0] : imagePath || "/api/placeholder/300/300";
};

// Helper function to parse image paths with pipe symbols as delimiters
const parseImagePath = (imagePath) => {
  if (!imagePath) return "/api/placeholder/300/300";
  // Split by pipe symbol and get the first image URL
  const images = imagePath.split('|').filter(img => img.trim());
  return images.length > 0 ? images[0] : imagePath || "/api/placeholder/300/300";
};

// Create Auth Context
const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    // Check if we have a token in localStorage
    const storedToken = localStorage.getItem('token');
    
    // Support both old and new user data formats
    let storedUser;
    try {
      storedUser = JSON.parse(localStorage.getItem('user'));
      console.log("Loading stored user data:", storedUser);
      
      // Make sure userId is defined
      if (storedUser && !storedUser.userId && storedUser.id) {
        console.log("Converting id to userId for consistency");
        storedUser.userId = storedUser.id; // Fixed typo: Assign to userId
      }
      
      // Check for required fields
      if (storedUser && !storedUser.userId) { // Fixed typo: Check userId
        console.warn("Stored user data missing userId:", storedUser);
      }
    } catch (e) {
      console.error("Error parsing stored user data:", e);
      // Ignore parsing errors
    }
    
    if (storedToken && storedUser) {
      // Check if token is expired
      if (isTokenExpired(storedToken)) {
        console.log("Stored token is expired, logging out");
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } else {
        console.log("Using stored authentication data, token exists and user:", storedUser?.userId); // Fixed typo: Log userId
        setToken(storedToken);
        setCurrentUser(storedUser);
      }
    } else {
      console.log("No stored authentication data or missing user/token");
    }
    
    setLoading(false);
  }, []);

  // Keeping the old login methods for backward compatibility
  const login = async (usernameOrEmail, password) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/login`, {
        usernameOrEmail,
        password
      });
      
      const { token, user } = response.data;
      
      // Ensure userId is set (use id if userId is not available)
      if (user && !user.userId && user.id) { // Fixed typo: Check userId
        user.userId = user.id; // Fixed typo: Assign to userId
      }
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      console.log("User logged in successfully:", user);
      setToken(token);
      setCurrentUser(user);
      
      return user;
    } catch (error) {
      console.error('Login error:', error.response?.data || error.message);
      throw error;
    }
  };

  const register = async (username, email, password) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/register`, {
        username,
        email,
        password
      });
      
      const { token, user } = response.data;
      
      // Ensure userId is set (use id if userId is not available)
      if (user && !user.userId && user.id) { // Fixed typo: Check userId
        user.userId = user.id; // Fixed typo: Assign to userId
      }
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      console.log("User registered successfully:", user);
      setToken(token);
      setCurrentUser(user);
      
      return user;
    } catch (error) {
      console.error('Registration error:', error.response?.data || error.message);
      throw error;
    }
  };

  // Method for email verification login
  const verifyEmailLogin = (token, userData) => {
    // Make sure we store the isAdmin flag in the user data
    const userWithAdminFlag = {
      ...userData,
      // Check backend value OR if email is in the specific admin list
      isAdmin: userData.isAdmin || ['amj2234@columbia.edu', 'aaa2485@columbia.edu'].includes(userData.email)
    };
    
    // Ensure userId is set (use id if userId is not available)
    if (userWithAdminFlag && !userWithAdminFlag.userId && userWithAdminFlag.id) { // Fixed typo: Check userId
      userWithAdminFlag.userId = userWithAdminFlag.id; // Fixed typo: Assign to userId
    }
    
    console.log("User verified and logged in:", userWithAdminFlag);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userWithAdminFlag));
    
    setToken(token);
    setCurrentUser(userWithAdminFlag);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setCurrentUser(null);
    
    // Navigate to the home page after logout
    window.location.href = '/';
  };

  // Function to update user profile data
  const updateUserProfile = (updatedUserData) => {
    if (!updatedUserData) return;
    
    const updatedUser = {
      ...currentUser,
      ...updatedUserData
    };
    
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);
  };

  // Check if user is verified (has completed their profile)
  const isUserVerified = () => {
    // Always return true to bypass verification checks
    return true;
  };

  // Create axios instance with auth headers
  const authAxios = axios.create({
    baseURL: API_BASE_URL
  });
  
  // Function to check if token is expired
  const isTokenExpired = (token) => {
    if (!token) return true;
    
    try {
      // Extract the payload from the JWT token
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(window.atob(base64));
      
      // Check if the token has expired
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp < currentTime;
    } catch (error) {
      console.error('Error checking token expiration:', error);
      return true; // Assume token is expired if there's an error
    }
  };
  
  authAxios.interceptors.request.use(
    (config) => {
      if (token) {
        // Check if token is expired
        if (isTokenExpired(token)) {
          console.log('Token expired, logging out user');
          // Logout user when token is expired
          logout();
          throw new axios.Cancel('Token expired, user logged out');
        }
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );
  
  // Add response interceptor to handle 401 errors (token expired)
  authAxios.interceptors.response.use(
    (response) => response, 
    (error) => {
      if (error.response && error.response.status === 401) {
        // Token expired or invalid
        console.log('Received 401 error, logging out user');
        logout();
      }
      return Promise.reject(error);
    }
  );

  const value = {
    currentUser,
    login,
    register,
    verifyEmailLogin,
    logout,
    authAxios,
    isAuthenticated: !!currentUser,
    isVerified: true, // Always set to true to bypass verification checks
    updateUserProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

const CartContext = createContext();

export function useCart() {
  return useContext(CartContext);
}

export function CartProvider({ children }) {
  const [cartCount, setCartCount] = useState(0);
  const { authAxios, isAuthenticated } = useAuth();
  
  const updateCartCount = async () => {
    if (!isAuthenticated) return;
    
    try {
      const response = await authAxios.get('/cart/count');
      
      if (response.data && response.data.count !== undefined) {
        setCartCount(response.data.count);
      }
    } catch (error) {
      console.error('Error fetching cart count:', error);
    }
  };
  
  useEffect(() => {
    if (isAuthenticated) {
      updateCartCount();
      
      // Set up polling to update cart count periodically
      const interval = setInterval(updateCartCount, 30000); // Every 30 seconds
      
      return () => clearInterval(interval);
    } else {
      setCartCount(0); // Reset count when logged out
    }
  }, [isAuthenticated]);
  
  return (
    <CartContext.Provider value={{ cartCount, updateCartCount }}>
      {children}
    </CartContext.Provider>
  );
}

// Create a context for message notifications
const MessageContext = createContext();

export function useMessages() {
  return useContext(MessageContext);
}

export function MessageProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadChats, setUnreadChats] = useState(new Set());
  const { authAxios, isAuthenticated, currentUser } = useAuth();
  const [socket, setSocket] = useState(null);
  
  // Update unread message count
  const updateUnreadCount = async () => {
    if (!isAuthenticated || !currentUser?.userId) return;
    
    try {
      // Fetch all chats to check for unread messages
      const response = await authAxios.get('/chats');
      
      if (response.data) {
        // Track both count and which chats have unread messages
        let count = 0;
        const unreadChatIds = new Set();
        const chats = response.data;
        
        // Consider a chat unread if the last message is not from the current user
        chats.forEach(chat => {
          if (chat.last_message && 
              chat.last_message_sender_id !== currentUser.userId && 
              (!chat.last_read_time || new Date(chat.last_message_at) > new Date(chat.last_read_time))) {
            count++;
            unreadChatIds.add(chat.id);
          }
        });
        
        setUnreadCount(count);
        setUnreadChats(unreadChatIds);
        
        // Store the unread state in localStorage to persist across page refreshes
        localStorage.setItem('unreadCount', count.toString());
        localStorage.setItem('unreadChats', JSON.stringify(Array.from(unreadChatIds)));
      }
    } catch (error) {
      console.error('Error updating unread message count:', error);
    }
  };
  
  // Load initial unread state from localStorage on mount
  useEffect(() => {
    if (isAuthenticated) {
      const savedCount = localStorage.getItem('unreadCount');
      const savedChats = localStorage.getItem('unreadChats');
      
      if (savedCount) {
        setUnreadCount(parseInt(savedCount, 10));
      }
      
      if (savedChats) {
        try {
          const chatIds = JSON.parse(savedChats);
          setUnreadChats(new Set(chatIds));
        } catch (e) {
          console.error('Error parsing saved unread chats:', e);
        }
      }
    }
  }, [isAuthenticated]);
  
  // Set up socket to listen for new messages
  useEffect(() => {
    if (!isAuthenticated || !currentUser?.userId) return;
    
    const token = localStorage.getItem('token');
    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    });
    
    newSocket.on('connect', () => {
      console.log('Message notification socket connected');
      // Join personal room to get direct notifications
      newSocket.emit('join_personal_room', currentUser.userId);
    });
    
    // Listen for new messages
    newSocket.on('new_message', (message) => {
      if (message.sender_id !== currentUser.userId) {
        // If message is not from current user and not currently viewing that chat
        const currentPath = window.location.pathname;
        const isViewingChat = currentPath === `/chats/${message.chat_id}`;
        
        if (!isViewingChat) {
          // If not viewing the specific chat, mark as unread
          setUnreadCount(prev => prev + 1);
          setUnreadChats(prev => {
            const updated = new Set(prev);
            updated.add(message.chat_id);
            
            // Update localStorage
            localStorage.setItem('unreadCount', (prev.size + 1).toString());
            localStorage.setItem('unreadChats', JSON.stringify(Array.from(updated)));
            
            return updated;
          });
        }
      }
    });
    
    setSocket(newSocket);
    
    // Initial fetch
    updateUnreadCount();
    
    return () => {
      if (newSocket) newSocket.disconnect();
    };
  }, [isAuthenticated, currentUser]);
  
  // Set up polling as a fallback
  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      setUnreadChats(new Set());
      localStorage.removeItem('unreadCount');
      localStorage.removeItem('unreadChats');
      return;
    }
    
    // Polling interval (less frequent since we have sockets)
    const interval = setInterval(updateUnreadCount, 60000); // Every minute
    
    return () => clearInterval(interval);
  }, [isAuthenticated]);
  
  // Reset all unread counts
  const resetAllUnreadCounts = () => {
    setUnreadCount(0);
    setUnreadChats(new Set());
    localStorage.removeItem('unreadCount');
    localStorage.removeItem('unreadChats');
  };
  
  // Reset unread count for a specific chat
  const resetUnreadCount = (chatId) => {
    if (!chatId) {
      // If no specific chatId provided, reset all
      resetAllUnreadCounts();
      return;
    }
    
    setUnreadChats(prev => {
      const updated = new Set(prev);
      if (updated.has(chatId)) {
        updated.delete(chatId);
        setUnreadCount(prev => Math.max(0, prev - 1));
        
        // Update localStorage
        localStorage.setItem('unreadCount', Math.max(0, unreadCount - 1).toString());
        localStorage.setItem('unreadChats', JSON.stringify(Array.from(updated)));
      }
      return updated;
    });
  };
  
  // Check if a specific chat has unread messages
  const isChatUnread = (chatId) => {
    return unreadChats.has(chatId);
  };
  
  // Method to manually increment count (primarily for testing)
  const incrementUnreadCount = (chatId) => {
    setUnreadCount(prev => prev + 1);
    if (chatId) {
      setUnreadChats(prev => {
        const updated = new Set(prev);
        updated.add(chatId);
        
        // Update localStorage
        localStorage.setItem('unreadCount', (unreadCount + 1).toString());
        localStorage.setItem('unreadChats', JSON.stringify(Array.from(updated)));
        
        return updated;
      });
    }
  };
  
  return (
    <MessageContext.Provider value={{ 
      unreadCount, 
      resetUnreadCount, 
      incrementUnreadCount, 
      isChatUnread,
      updateUnreadCount,
      socket // Expose socket instance
    }}>
      {children}
    </MessageContext.Provider>
  );
}

function MessageCount() {
  const { unreadCount } = useMessages();
  
  // Only show count if there are unread messages
  if (unreadCount > 0) {
    return unreadCount;
  }
  
  // Return empty if no unread messages
  return '';
}

function CartCount() {
  const { cartCount } = useCart();
  
  return cartCount || 0;
}

export function HeadBar({ openSidebar }) {
  const { isAuthenticated, currentUser, logout, authAxios } = useAuth();
  const [profileData, setProfileData] = useState({ fullName: '', profileImage: '' });
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  const handleResize = () => {
    setWindowWidth(window.innerWidth);
  };
  
  // Fetch profile data when authenticated
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      const fetchProfileData = async () => {
        if (!isAuthenticated || !currentUser || !currentUser.userId) {
          console.log("Skipping profile fetch: Not authenticated or incomplete user data");
          return;
        }
        
        try {
          console.log("Fetching profile data for user:", currentUser.userId);
          const response = await authAxios.get('/users/profile');
          
          if (response.data) {
            console.log("Profile data received:", response.data);
            setProfileData(response.data);
          }
        } catch (error) {
          console.error('Error fetching profile data:', error);
          console.error('Error details:', error.response?.data || error.message);
          // Initialize with default values if we can't fetch profile
          setProfileData({ 
            fullName: currentUser.email || 'User',
            profileImage: '' 
          });
        }
      };
      
      fetchProfileData();
    }
  }, [isAuthenticated, currentUser, authAxios]);
  
  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  return (
    <div className="header">
      <div className="leftside">
        <Link to="/" className="logo-container">
          <img src={logo} alt="Lion Bay" />
          <span className="logo-text">LionBay</span>
        </Link>
        <Link to="/home" className="nav-link">Home</Link>
        <Link to="/market" className="nav-link">Buy Stuff</Link>
        <Link to="/create-product" className="nav-link">Sell Stuff</Link>
        <Link to="/discover" className="nav-link">Swipe and Shop</Link>
        <Link to="/my-products" className="nav-link">My Products</Link>
      </div>
      
      <div className="rightside">
        {isAuthenticated ? (
          <>
            <span className="nav-link coming-soon">
              <span className="username">
                {profileData.fullName || currentUser.email}
                <span className="coming-soon-badge">Profile Coming Soon</span>
              </span>
            </span>
            <Link to="/cart" className="nav-link">Cart <span className="cart-badge"><CartCount /></span></Link>
            <Link to="/chats" className="nav-link">DMs <span className="message-badge"><MessageCount /></span></Link>
            {windowWidth > 1160 && (
            <button className="sign-in-btn" onClick={() => {
              logout();
              // Force navigation to home page
              window.location.href = '/';
            }}>logout</button>
            )}
            
            {/* Mobile menu toggle button */}
            {windowWidth <= 1160 && (
              <button className="mobile-menu-toggle" onClick={openSidebar} aria-label="Open menu">
                <i className="fas fa-bars menu-icon"></i>
              </button>
            )}
          </>
        ) : (
          <>
            <Link to="/cart" className="nav-link">Cart</Link>
            {windowWidth > 1160 && (
            <Link to="/login" className="login-btn">login</Link>
            )}
            
            {/* Mobile menu toggle button */}
            {windowWidth <= 1160 && (
              <button className="mobile-menu-toggle" onClick={openSidebar} aria-label="Open menu">
                <i className="fas fa-bars menu-icon"></i>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SignInPage() {
  const { verifyEmailLogin, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [codeSent, setCodeSent] = useState(false);
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/home');
    }
  }, [isAuthenticated, navigate]);
  
  // Hide login explainer initially
  useEffect(() => {
    const explainer = document.querySelector('.login-explainer');
    if (explainer) {
      explainer.classList.remove('show');
    }
  }, []);

  const handleSendCode = async (e) => {
    e.preventDefault();
    
    if (!termsAccepted) {
      setError('You must agree to the Terms of Service to continue');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/send-verification`, { email });
      setCodeSent(true);
      
      // For development, auto-fill the code if returned in response
      if (response.data.code) {
        setVerificationCode(response.data.code);
      }
      
      // Display success message to user
      setToastMessage('Verification code sent to your email');
      setToastType('success');
      setShowToast(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send verification code');
      console.error('Email verification error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/verify-email`, {
        email,
        verificationCode
      });
      
      // Check if this is an admin email
      const isAdmin = ['admin@lionbay.com', 'support@lionbay.com'].includes(email);
      
      const userData = {
        userId: response.data.user.id,
        email: email,
        isAdmin: isAdmin || response.data.user.isAdmin,
        termsAccepted: true
      };
      
      console.log('User authenticated:', userData);
      
      verifyEmailLogin(response.data.token, userData);
      navigate('/home');
    } catch (error) {
      console.error('Verification error:', error.response?.data || error.message);
      setError(error.response?.data?.error || 'Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='body'>
      <div className="sign-in-container">
        <h1 className="sign-in-title">
          Lion Bay
        </h1>

        <div className="form-container">
          {!codeSent ? (
            <form onSubmit={handleSendCode}>
              <p className="required-field-note">* indicates required field</p>
              
              <div className="login-explainer">
                <p>Enter your Columbia email to receive a login code. No password needed.</p>
              </div>
              
              {error && <div className="auth-error">{error}</div>}

              <div className="form-field">
                <label htmlFor="email" className="sr-only">Email Address</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="* Your Columbia Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="form-input"
                />
              </div>

              <div className="checkbox-field">
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    id="termsAccepted"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="checkbox-input"
                    style={{
                      width: "24px",
                      height: "24px",
                      border: "2px solid #1c4587",
                      borderRadius: "4px",
                      appearance: "none",
                      WebkitAppearance: "none",
                      MozAppearance: "none",
                      backgroundColor: "white",
                      position: "relative",
                      cursor: "pointer",
                      marginRight: "12px",
                      display: "inline-block",
                      verticalAlign: "middle"
                    }}
                  />
                  {termsAccepted && (
                    <div style={{
                      position: "absolute",
                      left: "1px",
                      top: "2px",
                      color: "#1c4587",
                      fontSize: "26px",
                      fontWeight: "bold",
                      pointerEvents: "none",
                      lineHeight: "22px",
                      textAlign: "center",
                      fontFamily: "Arial, sans-serif",
                      width: "24px"
                    }}>✓</div>
                  )}
                  <label htmlFor="termsAccepted" className="checkbox-label" style={{ cursor: "pointer" }}>
                    I agree to the LionBay <span 
                      className="details-link" 
                      onClick={(e) => {
                        e.preventDefault();
                        setShowTermsModal(true);
                      }}
                    >
                      Terms of Service
                    </span>
                  </label>
                </div>
              </div>

              <div className="captcha-container">
                <div className="captcha-box">
                  <div className="captcha-info">
                    <i className="fas fa-shield-alt"></i>
                    <span>Human verification - Friendly CAPTCHA</span>
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button 
                  type="submit" 
                  className="sign-in-button" 
                  disabled={loading || !termsAccepted}
                >
                  {loading ? 'Sending...' : 'Send Verification Code'}
                </button>
              </div>
              
              <div className="no-account-link">
                <button 
                  type="button" 
                  className="no-account-btn"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => document.querySelector('.login-explainer').classList.toggle('show')}
                >
                  How does login work?
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode}>
              <p className="required-field-note">A verification code has been sent to your email</p>
              
              {error && <div className="auth-error">{error}</div>}

              <div className="form-field">
                <label htmlFor="verificationCode" className="sr-only">Verification Code</label>
                <input
                  type="text"
                  id="verificationCode"
                  name="verificationCode"
                  placeholder="* Verification Code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  required
                  className="form-input"
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="sign-in-button" disabled={loading}>
                  {loading ? 'Verifying...' : 'login'}
                </button>
              </div>
              
              <div className="auth-toggle">
                <button 
                  type="button" 
                  className="toggle-auth-btn"
                  onClick={() => setCodeSent(false)}
                >
                  Try a different email
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      
      {showToast && (
        <ToastNotification
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}
      
      {showTermsModal && (
        <div className="modal-overlay" onClick={() => setShowTermsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '80vh', overflow: 'auto' }}>
            <h3>LionBay Terms of Service</h3>
            <div style={{ marginBottom: '20px', fontSize: '0.9rem', lineHeight: '1.5' }}>
              <p><strong>Last Updated: May 7, 2025</strong></p>
              
              <p>Welcome to LionBay, a marketplace exclusively for Columbia University students, faculty, and staff. By using our platform, you agree to these Terms of Service.</p>
              
              <h4 style={{ marginTop: '15px' }}>1. Eligibility</h4>
              <p>Use of LionBay is limited to Columbia University students, faculty, and staff with valid Columbia email addresses.</p>
              
              <h4 style={{ marginTop: '15px' }}>2. Account Registration</h4>
              <p>To use LionBay, you must register using your Columbia University email address. You are responsible for maintaining the confidentiality of your account information and for all activities under your account.</p>
              
              <h4 style={{ marginTop: '15px' }}>3. User Conduct</h4>
              <p>When using LionBay, you agree to:</p>
              <ul>
                <li>Provide accurate information about yourself and the items you list</li>
                <li>Only list items that you legally own and have the right to sell</li>
                <li>Not list prohibited items (see Prohibited Items section below)</li>
                <li>Not engage in fraudulent activities or misrepresent items being sold</li>
                <li>Communicate respectfully with other users</li>
                <li>Complete transactions as agreed upon with other users</li>
                <li>Comply with all applicable laws and regulations</li>
              </ul>
              
              <h4 style={{ marginTop: '15px' }}>4. Prohibited Items</h4>
              <p>The following items may not be listed on LionBay:</p>
              <ul>
                <li>Illegal items or services</li>
                <li>Weapons, explosives, and related items</li>
                <li>Drugs, controlled substances, and drug paraphernalia</li>
                <li>Alcohol and tobacco products</li>
                <li>Counterfeit or stolen items</li>
                <li>Items that infringe upon intellectual property rights</li>
                <li>Hazardous or dangerous materials</li>
                <li>Human remains or body parts</li>
                <li>Live animals</li>
                <li>Adult content or services</li>
                <li>Items or services that promote hate speech or discrimination</li>
              </ul>
              
              <h4 style={{ marginTop: '15px' }}>5. Transaction Safety</h4>
              <p>LionBay recommends the following safety practices:</p>
              <ul>
                <li>Meet in public, well-lit places on or near campus for exchanges</li>
                <li>Bring a friend when meeting someone for the first time</li>
                <li>Inspect items before completing the purchase</li>
                <li>Use caution when sharing personal information</li>
              </ul>
              
              <h4 style={{ marginTop: '15px' }}>6. Fees</h4>
              <p>LionBay is currently a free service with no listing or transaction fees. We reserve the right to introduce fees in the future with appropriate notice to users.</p>
              
              <h4 style={{ marginTop: '15px' }}>7. Privacy</h4>
              <p>Your privacy is important to us. Please review our Privacy Policy to understand how we collect, use, and protect your information.</p>
              
              <h4 style={{ marginTop: '15px' }}>8. Content Ownership</h4>
              <p>You retain ownership of content you post on LionBay, but grant us a license to use, modify, and display that content for the purpose of operating the platform.</p>
              
              <h4 style={{ marginTop: '15px' }}>9. Termination</h4>
              <p>We reserve the right to suspend or terminate your access to LionBay if you violate these Terms of Service or engage in behavior that poses a risk to the community.</p>
              
              <h4 style={{ marginTop: '15px' }}>10. Disclaimer of Warranties</h4>
              <p>LionBay is provided "as is" without warranties of any kind, either express or implied. We do not guarantee the accuracy, quality, or reliability of any items, users, or content on the platform.</p>
              
              <h4 style={{ marginTop: '15px' }}>11. Limitation of Liability</h4>
              <p>LionBay is not liable for any direct, indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the platform.</p>
              
              <h4 style={{ marginTop: '15px' }}>12. Dispute Resolution</h4>
              <p>Any disputes arising from the use of LionBay should first be addressed between the involved users. For unresolved issues, contact our support team.</p>
              
              <h4 style={{ marginTop: '15px' }}>13. Changes to Terms</h4>
              <p>We may modify these Terms of Service at any time. Continued use of LionBay after changes constitutes acceptance of the updated terms.</p>
              
              <h4 style={{ marginTop: '15px' }}>14. Contact Information</h4>
              <p>For questions or concerns regarding these Terms of Service, please contact support from toggle at the bottom of the screen.</p>
            </div>
            <div className="modal-actions">
              <button 
                className="modal-btn cancel" 
                onClick={() => setShowTermsModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MarketPage() {
  const { authAxios } = useAuth();
  const [priceRange, setPriceRange] = useState([10, 100000]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [sortBy, setSortBy] = useState('featured');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [maxPrice, setMaxPrice] = useState(1000); // Default max price
  const [searchQuery, setSearchQuery] = useState(''); // Add search query state

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await authAxios.get('/products');
        // Sort products by creation date, newest first
        const sortedProducts = response.data.sort((a, b) => 
          new Date(b.created_at) - new Date(a.created_at)
        );
        setProducts(sortedProducts);

        // Find the highest price among products
        const highestPrice = Math.max(...sortedProducts.map(p => p.price));
        setMaxPrice(Math.ceil(highestPrice)); // Round up to nearest integer
        setPriceRange([0, Math.ceil(highestPrice)]); // Update price range
      } catch (err) {
        console.error('Error fetching products:', err);
        setError('Failed to load products. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
    const interval = setInterval(fetchProducts, 30000);
    return () => clearInterval(interval);
  }, [authAxios]);

  // Filter functions
  const handleCategoryChange = (category) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter(c => c !== category));
    } else {
      setSelectedCategories([...selectedCategories, category]);
    }
  };

  const handlePriceChange = (event) => {
    setPriceRange([Number(event.target.value), priceRange[1]]);
  };

  const handleMaxPriceChange = (event) => {
    setPriceRange([priceRange[0], Number(event.target.value)]);
  };

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
  };

  // Filter products based on selected filters and search
  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(product.category);
    const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1];
    const matchesSearch = searchQuery === '' || 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesPrice && matchesSearch;
  });

  // Sort products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'price-asc') return a.price - b.price;
    if (sortBy === 'price-desc') return b.price - a.price;
    return 0; // Default: featured
  });

  if (loading) return (
    <div className="market-page">
      <div className="loading">Loading products...</div>
    </div>
  );

  if (error) return (
    <div className="market-page">
      <div className="error">{error}</div>
    </div>
  );

  // Render the market page with products
  return (
    <div className="market-page">
      <div className="market-container">
        <div className="market-header">
          <div className="market-title">
            <h1>Lion Bay</h1>
            <p>The ultimate marketplace with the cheapest and best student utilities.</p>
          </div>
          
          <div className="search-container">
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="search-input"
            />
          </div>
        </div>

        <div className="market-content">
          <div className="filters-sidebar">
            <div className="product-count">
              <span>{filteredProducts.length} products</span>
            </div>
            
            <div className="filter-section">
              <div className="filter-header">
                <h3>Price</h3>
              </div>
              <div className="price-range">
                <div className="range-slider">
                  <input
                    type="range"
                    min="0"
                    max={maxPrice}
                    value={priceRange[0]}
                    onChange={handlePriceChange}
                    className="slider"
                  />
                </div>
                <div className="price-inputs">
                  <div>From ${priceRange[0]}</div>
                  <div>to ${priceRange[1]}</div>
                </div>
              </div>
            </div>
            
            <div className="filter-section">
              <div className="filter-header">
                <h3>Categories</h3>
              </div>
              <div className="gender-options">
                <div className="filter-option">
                  <input
                    type="checkbox"
                    id="laptops"
                    checked={selectedCategories.includes("Laptops & Accessories")}
                    onChange={() => handleCategoryChange("Laptops & Accessories")}
                  />
                  <label htmlFor="laptops">Laptops & Accessories</label>
                </div>
                <div className="filter-option">
                  <input
                    type="checkbox"
                    id="textbooks"
                    checked={selectedCategories.includes("Textbooks & Study Guides")}
                    onChange={() => handleCategoryChange("Textbooks & Study Guides")}
                  />
                  <label htmlFor="textbooks">Textbooks & Study Guides</label>
                </div>
                <div className="filter-option">
                  <input
                    type="checkbox"
                    id="dorm"
                    checked={selectedCategories.includes("Dorm & Apartment Essentials")}
                    onChange={() => handleCategoryChange("Dorm & Apartment Essentials")}
                  />
                  <label htmlFor="dorm">Dorm & Apartment Essentials</label>
                </div>
                <div className="filter-option">
                  <input
                    type="checkbox"
                    id="bicycles"
                    checked={selectedCategories.includes("Bicycles & Scooters")}
                    onChange={() => handleCategoryChange("Bicycles & Scooters")}
                  />
                  <label htmlFor="bicycles">Bicycles & Scooters</label>
                </div>
                <div className="filter-option">
                  <input
                    type="checkbox"
                    id="electronics"
                    checked={selectedCategories.includes("Electronics & Gadgets")}
                    onChange={() => handleCategoryChange("Electronics & Gadgets")}
                  />
                  <label htmlFor="electronics">Electronics & Gadgets</label>
                </div>
                <div className="filter-option">
                  <input
                    type="checkbox"
                    id="furniture"
                    checked={selectedCategories.includes("Furniture & Storage")}
                    onChange={() => handleCategoryChange("Furniture & Storage")}
                  />
                  <label htmlFor="furniture">Furniture & Storage</label>
                </div>
                <div className="filter-option">
                  <input
                    type="checkbox"
                    id="clothing"
                    checked={selectedCategories.includes("Clothing & Fashion")}
                    onChange={() => handleCategoryChange("Clothing & Fashion")}
                  />
                  <label htmlFor="clothing">Clothing & Fashion</label>
                </div>
                <div className="filter-option">
                  <input
                    type="checkbox"
                    id="supplies"
                    checked={selectedCategories.includes("School Supplies")}
                    onChange={() => handleCategoryChange("School Supplies")}
                  />
                  <label htmlFor="supplies">School Supplies</label>
                </div>
              </div>
            </div>
          </div>
          
          <div className="products-grid">
            <div className="sort-options">
              <label>Sort by</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="featured">Featured</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
            </div>
            
            <div className="products-list">
              {sortedProducts.length > 0 ? (
                sortedProducts.map((product) => (
                  <Link key={product.id} to={`/market/${product.id}`} className="product-card-link">
                    <div className="product-card">
                      <div className="product-image">
                        <img src={getFirstImage(product.image_path) || "/api/placeholder/300/300"} alt={product.name} />
                      </div>
                      <div className="product-details">
                        <div className="product-title">{product.name}</div>
                        <div className="product-specs">
                          <div>{product.category}</div>
                          <div>{product.condition}</div>
                        </div>
                        <div className="product-price">${product.price.toLocaleString()}</div>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="no-products">
                  <p>No products found matching your criteria.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { authAxios, currentUser, isAuthenticated } = useAuth();
  const { updateCartCount } = useCart();
  const { protectedAction, renderToast } = useProtectedInteraction();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cartItems, setCartItems] = useState([]); // <-- Add state for cart items
  const [cartLoading, setCartLoading] = useState(true); // <-- Add loading state for cart
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [productImages, setProductImages] = useState([]);

  // Fetch product details
  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      try {
        const response = await authAxios.get(`/products/${id}`);
        setProduct(response.data);
        
        // Parse images from pipe-separated string
        const images = response.data.image_path ? 
          response.data.image_path.split('|').filter(img => img.trim()) : 
          [];
        
        setProductImages(images.length > 0 ? images : [response.data.image_path]);
        setCurrentImageIndex(0);
        
        // Set document title
        document.title = `${response.data.name} | Lion Bay`;

        // Scroll to top when product data is loaded
        window.scrollTo(0, 0);

      } catch (error) {
        console.error('Error fetching product details:', error);
        setError('Failed to load product details');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id, authAxios]);

  // Function to fetch/refetch cart items
  const fetchCartItems = async () => {
    if (!isAuthenticated) {
        setCartItems([]);
        setCartLoading(false);
        return;
    }
    setCartLoading(true);
    try {
      const response = await authAxios.get('/cart');
      setCartItems(response.data || []);
    } catch (err) {
      console.error('Error fetching/refetching cart items:', err);
      setCartItems([]); // Reset on error
    } finally {
      setCartLoading(false);
    }
  };

  // Effect to fetch initial cart items
  useEffect(() => {
    fetchCartItems();
  }, [isAuthenticated, authAxios]); // Run when auth status changes

  const handleContactSeller = async () => {
    if (!isAuthenticated) {
      return; // This will be handled by protectedAction
    }

    try {
      // Check if user is trying to contact themselves
      if (currentUser.userId === product.seller_id) {
        console.log("User tried to contact themselves");
        setToastMessage("Cannot contact yourself as the seller.");
        setToastType("error");
        setShowToast(true);
        return;
      }

      console.log(`Creating chat for product: ${product.id} with seller: ${product.seller_id}`);
      
      // Create or get chat for this product
      const response = await authAxios.post('/chats', {
        product_id: product.id,
        seller_id: product.seller_id
      });
      
      console.log("Chat created/retrieved:", response.data);
      
      // Add to cart with CONTACTED type
      await authAxios.post('/cart', {
        product_id: product.id,
        cart_type: 'CONTACTED',
        chat_id: response.data.id
      });
      
      // Update cart count
      if (updateCartCount) {
        updateCartCount();
      }
      fetchCartItems(); // <-- Refetch cart items
      
      // Show success toast
      setToastMessage("Seller contacted successfully.");
      setToastType("success");
      setShowToast(true);
      
      // Wait a moment before navigating to allow toast to be seen
      setTimeout(() => {
      // Navigate to the chat
      navigate(`/chats/${response.data.id}`);
      }, 1500);
      
    } catch (err) {
      console.error('Error creating chat:', err.response?.data || err.message);
      
      // Check if this is the "cannot chat with yourself" error
      if (err.response?.data?.error === 'Cannot create chat with yourself') {
        setToastMessage("Cannot contact yourself as the seller.");
      } else {
        setToastMessage(err.response?.data?.error || 'Failed to contact seller. Please try again.');
      }
      
      setToastType("error");
      setShowToast(true);
    }
  };
  
  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      return; // This will be handled by protectedAction
    }

    try {
      // Check if user is trying to add their own product
      if (currentUser.userId === product.seller_id) {
        setToastMessage("Cannot add your own product to cart.");
        setToastType("error");
        setShowToast(true);
        return;
      }

      // Add to cart with CART_ONLY type
      await authAxios.post('/cart', {
        product_id: product.id,
        cart_type: 'CART_ONLY'
      });
      
      // Update cart count
      if (updateCartCount) {
        updateCartCount();
      }
      fetchCartItems(); // <-- Refetch cart items
      
      // Show success toast
      setToastMessage("Product added to cart.");
      setToastType("success");
      setShowToast(true);
    } catch (err) {
      console.error('Error adding to cart:', err.response?.data || err.message);
      setToastMessage(err.response?.data?.error || 'Failed to add product to cart.');
      setToastType("error");
      setShowToast(true);
    }
  };

  const goToNextImage = () => {
    if (productImages.length <= 1) return;
    setCurrentImageIndex((prevIndex) => 
      prevIndex < productImages.length - 1 ? prevIndex + 1 : 0
    );
  };

  const goToPreviousImage = () => {
    if (productImages.length <= 1) return;
    setCurrentImageIndex((prevIndex) => 
      prevIndex > 0 ? prevIndex - 1 : productImages.length - 1
    );
  };

  // Update loading check
  if (loading || cartLoading) return ( 
    <div className="product-detail-page">
      <div className="loading">Loading product details...</div>
    </div>
  );

  if (error || !product) return (
    <div className="product-detail-page">
      <div className="error">{error || 'Product not found'}</div>
    </div>
  );

  // Check if current user is the owner of this product
  const isOwner = isAuthenticated && currentUser && currentUser.userId === product.seller_id;
  const currentImage = productImages[currentImageIndex] || "/api/placeholder/600/400";
  const hasMultipleImages = productImages.length > 1;

  // Check if current product is in the cart
  const isProductInCart = product && cartItems.some(item => item.product_id === product.id);

  return (
    <div className="product-detail-page">
      <div className="product-detail-container">
        <div className="product-detail-left">
          {isOwner && (
            <div className="owner-badge">
              <span>Your Listing</span>
            </div>
          )}
          <div className="product-image-container">
          <img 
              src={currentImage} 
            alt={product.name} 
            className="product-detail-image"
          />
            
            {hasMultipleImages && (
              <div className="product-image-controls">
                <button 
                  onClick={goToPreviousImage} 
                  className="image-nav-button prev"
                  aria-label="Previous image"
                >
                  ‹
                </button>
                <div className="image-indicators">
                  {productImages.map((_, index) => (
                    <span 
                      key={index} 
                      className={`image-indicator ${index === currentImageIndex ? 'active' : ''}`}
                      onClick={() => setCurrentImageIndex(index)}
                    />
                  ))}
                </div>
                <button 
                  onClick={goToNextImage} 
                  className="image-nav-button next"
                  aria-label="Next image"
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="product-detail-right">
          <h1 className="product-detail-title">{product.name}</h1>
          <div className="product-detail-price">${product.price.toLocaleString()}</div>
          
          <div className="product-detail-seller">
            <p>Seller: {product.seller_email || 'Unknown'}</p>
          </div>
          
          <div className="product-detail-info">
            <p><strong>Category:</strong> {product.category}</p>
            <p><strong>Condition:</strong> {product.condition}</p>
            {product.material && <p><strong>Material:</strong> {product.material}</p>}
          </div>
          
          <div className="product-detail-description">
            <h3>Description</h3>
            <p>{product.details}</p>
          </div>
          
          <div className="product-warning">
            If you think this product violates terms of service, please contact support using the help button in the bottom right of the page.
          </div>
          
          {isOwner ? (
            <div className="owner-message">
              <p>This is your listing. You can manage it from the "My Products" page.</p>
              <button 
                onClick={() => navigate('/my-products')} 
                className="manage-listing-button"
              >
                Manage Your Listing
              </button>
            </div>
          ) : (
            <div className="product-actions">
              <button 
                onClick={() => protectedAction(handleContactSeller)} 
                className="contact-seller-button"
              >
              Contact Seller
            </button>
              {isProductInCart ? (
                <button className="add-to-cart-button disabled" disabled>
                  Already in Cart
                </button>
              ) : (
                <button 
                  onClick={() => protectedAction(handleAddToCart)} 
                  className="add-to-cart-button"
                >
                  Add to Cart
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      
      {showToast && (
        <ToastNotification
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}
      
      {/* Render the protected interaction toast if needed */}
      {renderToast()}
    </div>
  );
}

function CreateProductPage() {
  const { authAxios } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    details: '',
    condition: 'New',
    price: '',
    category: '',
    image_path: '',
    other_category: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageError, setImageError] = useState('');
  const [previewImages, setPreviewImages] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [termsAgreed, setTermsAgreed] = useState(false);
  
  // Toast notification state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');

  const validateImageUrl = async (url) => {
    try {
      // Check if URL is valid
      if (!url.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i) && 
          !url.startsWith('data:image/')) {
        return { valid: false, error: 'Invalid image format. Please provide a valid image URL or upload an image.' };
      }

      // For URLs, check if the image exists and is accessible
      if (url.startsWith('http')) {
        const response = await fetch(url, { method: 'HEAD' });
        if (!response.ok) {
          return { valid: false, error: 'Image URL is not accessible. Please check the URL and try again.' };
        }
        
        // Check content type
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.startsWith('image/')) {
          return { valid: false, error: 'URL does not point to a valid image file.' };
        }
        
        // Check file size (5MB limit)
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) {
          return { valid: false, error: 'Image size exceeds 5MB limit.' };
        }
      }

      // For base64 data URLs, check size
      if (url.startsWith('data:image/')) {
        const base64Data = url.split(',')[1];
        const sizeInBytes = Math.ceil((base64Data.length * 3) / 4);
        if (sizeInBytes > 5 * 1024 * 1024) {
          return { valid: false, error: 'Image size exceeds 5MB limit.' };
        }
      }

      return { valid: true };
    } catch (error) {
      console.error('Error validating image:', error);
      return { valid: false, error: 'Error validating image. Please try again.' };
    }
  };

  const validateMultipleImageUrls = async (urls) => {
    // Return valid if no URLs provided
    if (!urls || urls.length === 0) return { valid: true, errors: [] };
    
    const errors = [];
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      if (!url) continue; // Skip empty URLs
      
      const result = await validateImageUrl(url);
      if (!result.valid) {
        errors.push(`Image ${i+1}: ${result.error}`);
      }
    }
    
    return { valid: errors.length === 0, errors };
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'price' ? (value === '' ? '' : parseFloat(value)) : value
    });
  };

  const handleImageUrlChange = (value) => {
    // Split multiple URLs by newline or space only (not commas)
    const urls = value.split(/[\n\s]+/).filter(url => url.trim());
    
    // Limit to max 4 images
    const limitedUrls = urls.slice(0, 4);
    
    // Update preview images
    setPreviewImages(limitedUrls);
    
    // Store joined with bar as delimiter
    setFormData({
      ...formData,
      image_path: limitedUrls.join('|')
    });
    
    setImageError('');
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    console.log('Files selected:', files.length, files);
    if (files.length === 0) return;
    
    // Check how many more images we can add (max 4 total)
    const remainingSlots = 4 - previewImages.length;
    if (remainingSlots <= 0) {
      setImageError('Maximum 4 images allowed. Please remove some images before adding more.');
      return;
    }
    
    // Limit to max remaining slots
    const limitedFiles = files.slice(0, remainingSlots);
    console.log(`Processing ${limitedFiles.length} new files (${previewImages.length} existing, max 4 total)`);
    
    // Don't replace existing files, add to them
    setSelectedFiles(prev => [...prev, ...limitedFiles]);
    
    // Don't clear previous previews, we'll append to them
    setImageError('');
    
    // Track file reading completions
    let fileReadCount = 0;
    const tempImagePreviews = new Array(limitedFiles.length);
    
    // Process each file
    limitedFiles.forEach((file, index) => {
      console.log(`Processing file ${index + 1}/${limitedFiles.length}:`, file.name);
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        setImageError('Please upload valid image files (JPEG, PNG, or GIF)');
        return;
      }

      // Check file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB in bytes
      if (file.size > maxSize) {
        setImageError('Image size must be less than 5MB');
        return;
      }

      // Read and add to preview
      const reader = new FileReader();
      reader.onload = (event) => {
        console.log(`File ${index + 1} (${file.name}) loaded successfully`);
        const base64Image = event.target.result;
        
        // Add to temporary array at the correct index
        tempImagePreviews[index] = base64Image;
        fileReadCount++;
        
        console.log(`File read progress: ${fileReadCount}/${limitedFiles.length}`);
        
        // When all files are read, update state once
        if (fileReadCount === limitedFiles.length) {
          // Filter out any undefined entries (in case of reading errors)
          const validNewPreviews = tempImagePreviews.filter(img => img);
          console.log('New files processed. Valid new previews:', validNewPreviews.length);
          
          // Combine existing previews with new ones
          const updatedPreviews = [...previewImages, ...validNewPreviews];
          console.log('Updated total previews:', updatedPreviews.length);
          
          // Update preview images state
          setPreviewImages(updatedPreviews);
          
          // Update image_path with pipe delimiter
          setFormData(prevForm => ({
            ...prevForm,
            image_path: updatedPreviews.join('|')
          }));
          
          console.log('Preview images updated. Total:', updatedPreviews.length);
          console.log('Image path string:', updatedPreviews.join('|'));
        }
      };
      
      reader.onerror = (error) => {
        fileReadCount++;
        console.error(`Error reading file ${file.name}:`, error);
        setImageError('Failed to read image file. Please try again.');
      };
      
      reader.readAsDataURL(file);
    });
  };

  const uploadImages = async () => {
    // File method: Use the base64 encoded images
    return previewImages;
  };

  const removeImage = (index) => {
    const updatedPreviews = [...previewImages];
    updatedPreviews.splice(index, 1);
    setPreviewImages(updatedPreviews);
    
    const updatedFiles = [...selectedFiles];
    updatedFiles.splice(index, 1);
    setSelectedFiles(updatedFiles);
    
    // Update formData.image_path with pipe delimiter
    setFormData({
      ...formData,
      image_path: updatedPreviews.join('|')
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Form submission started');
    setIsSubmitting(true);
    setImageError('');

    try {
      // Check if terms agreement is checked
      if (!termsAgreed) {
        setToastMessage('You must agree to the terms of use to list an item');
        setToastType('error');
        setShowToast(true);
        setIsSubmitting(false);
        return;
      }
      
      // Required field checks
      if (!formData.category) {
        setToastMessage('Category is required');
        setToastType('error');
        setShowToast(true);
        setIsSubmitting(false);
        return;
      }
      
      if (!formData.condition) {
        setToastMessage('Condition is required');
        setToastType('error');
        setShowToast(true);
        setIsSubmitting(false);
        return;
      }

      // Validate images
      const hasImages = previewImages.length > 0;
      if (!hasImages) {
        setImageError('Please provide at least one image for your product');
        setToastMessage('Product image is required');
        setToastType('error');
        setShowToast(true);
        setIsSubmitting(false);
        return;
      }

      // Validate number of images (max 4)
      if (previewImages.length > 4) {
        setImageError('Maximum 4 images allowed');
        setToastMessage('You can upload up to 4 images');
        setToastType('error');
        setShowToast(true);
        setIsSubmitting(false);
        return;
      }

      // Validate multiple images
      const imageValidation = await validateMultipleImageUrls(previewImages);
      if (!imageValidation.valid) {
        setImageError(imageValidation.errors.join('. '));
        setToastMessage('One or more images are invalid');
        setToastType('error');
        setShowToast(true);
        setIsSubmitting(false);
        return;
      }

      // Validate fields with character limits
      if (!formData.name.trim()) {
        setToastMessage('Product name is required');
        setToastType('error');
        setShowToast(true);
        setIsSubmitting(false);
        return;
      } else if (formData.name.length < 3) {
        setToastMessage('Product name must be at least 3 characters long');
        setToastType('error');
        setShowToast(true);
        setIsSubmitting(false);
        return;
      } else if (formData.name.length > 30) {
        setToastMessage('Product name must be 30 characters or less');
        setToastType('error');
        setShowToast(true);
        setIsSubmitting(false);
        return;
      }

      // Price validation
      if (!formData.price) {
        setToastMessage('Price is required');
        setToastType('error');
        setShowToast(true);
        setIsSubmitting(false);
        return;
      } 
      
      // Convert to a number for comparison
      const priceValue = Number(formData.price);
      
      if (isNaN(priceValue) || priceValue <= 0) {
        setToastMessage('Price must be a positive number');
        setToastType('error');
        setShowToast(true);
        setIsSubmitting(false);
        return;
      } else if (priceValue > 1000000) { // Stricter price limit
        setToastMessage('Price must not exceed $1,000,000');
        setToastType('error');
        setShowToast(true);
        setIsSubmitting(false);
        return;
      }

      if (!formData.details.trim()) {
        setToastMessage('Product details are required');
        setToastType('error');
        setShowToast(true);
        setIsSubmitting(false);
        return;
      } else if (formData.details.length < 10) {
        setToastMessage('Product details must be at least 10 characters long');
        setToastType('error');
        setShowToast(true);
        setIsSubmitting(false);
        return;
      } else if (formData.details.length > 1000) {
        setToastMessage('Product details must be less than 1000 characters');
        setToastType('error');
        setShowToast(true);
        setIsSubmitting(false);
        return;
      }

      console.log('All validations passed, processing images...');
      
      // Process and upload images
      setUploadProgress(10);
      const uploadedImages = await uploadImages();
      setUploadProgress(90);
      
      // Join multiple images with pipe symbol as delimiter
      const imagePathString = uploadedImages.join('|');

      console.log('All validations passed, submitting to API');
      
      // Create product with validated data
      const productData = {
        name: formData.name.trim(),
        details: formData.details.trim(),
        condition: formData.condition,
        price: priceValue,
        category: formData.category,
        image_path: imagePathString
      };
      
      console.log('Product data to submit:', productData);
      
      const response = await authAxios.post('/products', productData);
      console.log('Product created successfully:', response.data);
      setUploadProgress(100);
      
      // Show success toast instead of alert
      setToastMessage('Product created successfully!');
      setToastType('success');
      setShowToast(true);
      
      // Navigate to the product detail page immediately
      navigate(`/market/${response.data.id}`);
      
    } catch (error) {
      console.error('Error creating product:', error);
      
      // Show error toast instead of alert
      setToastMessage(error.response?.data?.error || 'Failed to create product. Please try again.');
      setToastType('error');
      setShowToast(true);
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="create-product-page">
      <div className="create-product-container">
        <div className="lionbay-header">
          <div className="lionbay-logo">
            <img src={logo} alt="Lion Bay" />
          </div>
          <h1>Lion Bay Marketplace</h1>
        </div>
        
        <form onSubmit={handleSubmit} className="create-product-form">
          <div className="form-group">
            <label htmlFor="name">Product Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="e.g., MacBook Pro 2023"
              maxLength={30}
            />
            <small className={`character-count ${formData.name.length > 20 ? formData.name.length > 27 ? 'limit-reached' : 'limit-warning' : ''}`}>
              {formData.name.length}/30 characters
            </small>
          </div>
          
          <div className="form-group">
            <label htmlFor="price">Price ($)</label>
            <input
              type="number"
              id="price"
              name="price"
              value={formData.price}
              onChange={handleChange}
              required
              min="0.01"
              step="0.01"
              placeholder="e.g., 999.99"
              max="1000000"
            />
            <small className="price-limit-note">Maximum price: $1,000,000</small>
          </div>
          
          <div className="form-group">
            <label htmlFor="condition">Condition</label>
            <select
              id="condition"
              name="condition"
              value={formData.condition}
              onChange={handleChange}
              required
            >
              <option value="">Select</option>
              <option value="New">New</option>
              <option value="Like new">Like new</option>
              <option value="Good condition">Good condition</option>
              <option value="Fair condition">Fair condition</option>
              <option value="Poor condition">Poor condition</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
            >
              <option value="">Select</option>
              <option value="Laptops & Accessories">Laptops & Accessories</option>
              <option value="Textbooks & Study Guides">Textbooks & Study Guides</option>
              <option value="Dorm & Apartment Essentials">Dorm & Apartment Essentials</option>
              <option value="Bicycles & Scooters">Bicycles & Scooters</option>
              <option value="Electronics & Gadgets">Electronics & Gadgets</option>
              <option value="Furniture & Storage">Furniture & Storage</option>
              <option value="Clothing & Fashion">Clothing & Fashion</option>
              <option value="School Supplies">School Supplies</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="details">Details</label>
            <textarea
              id="details"
              name="details"
              value={formData.details}
              onChange={handleChange}
              required
              placeholder="Describe your item, including features and any defects"
              maxLength={1000}
              rows="5"
            ></textarea>
            <small className={`character-count ${formData.details.length > 800 ? formData.details.length > 950 ? 'limit-reached' : 'limit-warning' : ''}`}>
              {formData.details.length}/1000 characters
            </small>
          </div>
          
          <div className="form-group">
            <label>Product Images (Up to 4)</label>
            
            <div className="file-upload-container">
              <input
                type="file"
                id="image_file"
                accept="image/*"
                onChange={handleFileUpload}
                className="file-upload-input"
                multiple
              />
              <label htmlFor="image_file" className="file-upload-label">
                Choose files (max 4)
              </label>
              <small>Select up to 4 image files (JPEG, PNG, GIF, etc.)</small>
            </div>
            
            {previewImages.length > 0 && (
              <div className="image-previews">
                {previewImages.map((image, index) => (
                  <div key={index} className="image-preview-item">
                    <img src={image} alt={`Product preview ${index + 1}`} />
                    <button 
                      type="button" 
                      className="remove-image"
                      onClick={() => removeImage(index)}
                      aria-label={`Remove image ${index + 1}`}
                    >
                      ×
                    </button>
                    <div className="image-preview-count">
                      {index + 1}/{previewImages.length}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {previewImages.length > 0 && (
              <div className="image-upload-status">
                <span>{previewImages.length} of 4 images added</span>
                {previewImages.length === 4 && (
                  <span className="max-reached">Maximum reached</span>
                )}
              </div>
            )}
            
            {previewImages.length === 0 && (
              <div className="image-preview empty">
                <span>No preview</span>
              </div>
            )}
            
            {imageError && <div className="error-message">{imageError}</div>}
            
            {isSubmitting && uploadProgress > 0 && (
              <div className="upload-progress">
                <div 
                  className="upload-progress-bar" 
                  style={{width: `${uploadProgress}%`}}
                >
                  {uploadProgress}%
                </div>
              </div>
            )}
          </div>
          
          <div className="terms-of-use-box">
            <h4>Terms of Use Agreement</h4>
            <p>By listing an item for sale, you agree to comply with the LionBay marketplace rules. Listing inappropriate products, illegal items, or violating university policies may result in:</p>
            <ul>
              <li>Immediate removal of your listing</li>
              <li>Suspension or termination of your account</li>
              <li>Reporting to your university administration based on your institutional email</li>
              <li>Potential legal action for illegal activities</li>
            </ul>
            <p>LionBay reserves the right to review all listings and take appropriate action against policy violations.</p>
            <div className="terms-checkbox-container">
              <input
                type="checkbox"
                id="terms-agreement"
                required
                checked={termsAgreed}
                onChange={(e) => {
                  setTermsAgreed(e.target.checked);
                  if (!e.target.checked) {
                    setToastMessage("You must agree to the terms to list an item");
                    setToastType("error");
                    setShowToast(true);
                  }
                }}
              />
              <label htmlFor="terms-agreement">I agree to the LionBay marketplace terms and policies</label>
            </div>
          </div>
          
          <button 
            type="submit" 
            className="create-product-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'List Item for Sale'}
          </button>
        </form>
        
        {/* Toast notification */}
        {showToast && (
          <ToastNotification
            message={toastMessage}
            type={toastType}
            onClose={() => setShowToast(false)}
          />
        )}
      </div>
    </div>
  );
}

function ChatsListPage() {
  const { authAxios, currentUser, isAuthenticated } = useAuth();
  const { setMessages } = useMessages();  
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [chatToDelete, setChatToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [chatToComplete, setChatToComplete] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");

  // Initialize socket connection
  useEffect(() => {
      if (!isAuthenticated) {
        return;
      }

    const token = localStorage.getItem('token');
    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('Socket connected for chats list');
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error in chats list:', error.message);
    });

    newSocket.on('error', (error) => {
      console.error('Socket error in chats list:', error);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [isAuthenticated]);

  // Listen for new messages to update chat list, and chat_deleted, chat_updated events
  useEffect(() => {
    if (!socketRef.current || !currentUser?.userId) return;

    const updateChatWithNewMessage = async (message) => { // Made async
      if (!message || !message.chat_id) return;
      if (currentUser?.userId && message.sender_id === currentUser.userId && !message.is_system_message) {
        return; // Ignore self-sent non-system messages
      }
      
      setChats(prevChats => {
        const existingChatIndex = prevChats.findIndex(c => c.id === message.chat_id);
        
        if (existingChatIndex !== -1) {
          // Chat exists, update it and move to top
          const updatedChat = {
            ...prevChats[existingChatIndex],
            last_message: message.content,
            last_message_at: message.created_at,
            // Optionally update unread status based on message sender
            unread_count: (message.sender_id !== currentUser.userId) ? (prevChats[existingChatIndex].unread_count || 0) + 1 : prevChats[existingChatIndex].unread_count
          };
          // Remove from current position and add to the beginning
          const filteredChats = prevChats.filter(c => c.id !== message.chat_id);
          return [updatedChat, ...filteredChats];
        } else {
          // Chat doesn't exist, need to fetch it (handle fetch outside setState)
          // We return the previous state here and trigger fetch below
          return prevChats; 
        }
      });

      // If chat didn't exist, fetch it and add it
      const chatExists = chats.some(c => c.id === message.chat_id);
      if (!chatExists) {
        console.log(`New message for unknown chat ${message.chat_id}. Fetching chat details...`);
        try {
          const response = await authAxios.get(`/chats/${message.chat_id}`);
          const newChatData = response.data;
          if (newChatData) {
            // Add the newly fetched chat to the beginning of the list
            setChats(prevChats => [
              { // Ensure the new chat data includes the latest message details
                ...newChatData,
                last_message: message.content,
                last_message_at: message.created_at,
                unread_count: (message.sender_id !== currentUser.userId) ? 1 : 0
              },
              ...prevChats
            ]);
          }
        } catch (err) {
          console.error(`Error fetching new chat details for chat ${message.chat_id}:`, err);
        }
      }
    };

    const handleChatDeleted = ({ chatId }) => {
      console.log('ChatsListPage: Received chat_deleted event for chat ID:', chatId);
      setChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
    };

    const handleChatPaymentUpdated = (data) => { // Existing handler from previous step (seller marking complete)
      console.log('ChatsListPage: Received chat_payment_updated event (likely seller completion):', data);
      setChats(prevChats => prevChats.map(c =>
        c.id === data.chatId
          ? { ...c, payment_completed: data.payment_completed }
          : c
      ));
    };

    const handleChatUpdated = (updatedChatData) => {
      console.log('ChatsListPage: Received chat_updated event (e.g., buyer requested completion):', updatedChatData);
      setChats(prevChats => prevChats.map(c =>
        c.id === updatedChatData.id
          ? { ...c, ...updatedChatData } // Update the chat with all new data
          : c
      ));
    };

    socketRef.current.on('new_message', updateChatWithNewMessage);
    socketRef.current.on('chat_deleted', handleChatDeleted);
    socketRef.current.on('chat_payment_updated', handleChatPaymentUpdated); // Keep for seller's direct completion
    socketRef.current.on('chat_updated', handleChatUpdated); // For buyer_requested_completion updates

    return () => {
      if (socketRef.current) {
        socketRef.current.off('new_message', updateChatWithNewMessage);
        socketRef.current.off('chat_deleted', handleChatDeleted);
        socketRef.current.off('chat_payment_updated', handleChatPaymentUpdated);
        socketRef.current.off('chat_updated', handleChatUpdated);
      }
    };
  }, [socketRef.current, currentUser?.userId, setChats]);

  // Fetch chats data
  useEffect(() => {
    fetchChats();
  }, [authAxios, isAuthenticated, navigate]);

  const fetchChats = async (showLoading = true) => {
    if (!isAuthenticated || !authAxios) {
      return;
    }

    if (showLoading) {
      setLoading(true);
    }

    try {
      const response = await authAxios.get('/chats');
      console.log('Fetched chats:', response.data);
      setChats(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching chats:', err);
      setError('Failed to load chats. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteChat = async (e, chatId) => {
    e.preventDefault();
    e.stopPropagation();
    setChatToDelete(chatId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteChat = async () => {
    if (!chatToDelete || deleting) return;
    
    setDeleting(true);
    console.log(`[ChatsListPage] confirmDeleteChat: Attempting to delete chat ID: ${chatToDelete} via API.`); // Added log
    try {
      await authAxios.delete(`/chats/${chatToDelete}`);
      setChats(prevChats => prevChats.filter(chat => chat.id !== chatToDelete));
      setToastMessage('Chat deleted successfully. The item has been removed from your cart.');
      setToastType('success');
      setShowToast(true);
    } catch (err) {
      console.error('Error deleting chat:', err);
      setToastMessage('Failed to delete chat. Please try again.');
      setToastType('error');
      setShowToast(true);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCompletePayment = (e, chatId) => {
    e.preventDefault();
    e.stopPropagation();
    setChatToComplete(chatId);
    setShowCompleteConfirm(true);
  };

  const confirmCompletePayment = async () => {
    if (!chatToComplete || completing) return;
    
    setCompleting(true);
    try {
      // This would connect to your API endpoint for completing payments
      await authAxios.post(`/chats/${chatToComplete}/complete-payment`);
      
      // Update local chat state to reflect completion immediately
      setChats(prevChats => prevChats.map(chat => 
        chat.id === chatToComplete 
          ? {...chat, payment_completed: true} 
          : chat
      ));
      setToastMessage('Payment marked as completed successfully.');
      setToastType('success');
      setShowToast(true);
    } catch (err) {
      console.error('Error completing payment:', err);
      setToastMessage('Failed to complete payment. Please try again.');
      setToastType('error');
      setShowToast(true);
    } finally {
      setCompleting(false);
      setShowCompleteConfirm(false);
    }
  };

  const navigateToChat = (chatId) => {
    navigate(`/chats/${chatId}`);
  };

  const formatLastMessageTime = (timestamp) => {
    if (!timestamp) return '';
    
    const messageDate = new Date(timestamp);
    const now = new Date();
    const diffInMilliseconds = now - messageDate;
    const diffInHours = diffInMilliseconds / (1000 * 60 * 60);
    const diffInDays = diffInHours / 24;
    
    // If the message is from today, show time
    if (diffInHours < 24 && messageDate.getDate() === now.getDate()) {
      return messageDate.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    }
    
    // If the message is from yesterday
    if (diffInDays < 2) {
      return 'Yesterday';
    }
    
    // If the message is from this week
    if (diffInDays < 7) {
      const options = { weekday: 'short' };
      return messageDate.toLocaleDateString(undefined, options);
    }
    
    // Otherwise, show the date
    return messageDate.toLocaleDateString([], {
      month: 'short',
      day: 'numeric'
    });
  };

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div className="chats-page">
        <div className="container">
          <div className="loading">Loading chats...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chats-page">
        <div className="container">
          <div className="error">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="chats-page">
      <div className="chats-container">
        <div className="chats-header">
          <h1>Messages</h1>
        </div>
        
        <div className="role-legend">
          <div className="legend-item">
            <span className="role-dot seller"></span>
            <span>You're selling</span>
          </div>
          <div className="legend-item">
            <span className="role-dot buyer"></span>
            <span>You're buying</span>
          </div>
        </div>
        
        {chats.length === 0 ? (
          <div className="no-chats">
            <p>You don't have any conversations yet</p>
            <Link to="/market" className="browse-button">Browse Products</Link>
          </div>
        ) : (
          <div className="chats-list">
            {chats.map(chat => {
              const isSeller = currentUser?.userId === chat.seller_id;
              const isCurrentUserBuyer = currentUser?.userId === chat.buyer_id;
              const chatPartnerEmail = isSeller ? chat.buyer_email : chat.seller_email;
              const chatClass = isSeller ? 'seller-chat' : 'buyer-chat';
              
              const showCompleteButtonForThisUser = 
                !chat.payment_completed && // Deal not fully completed by seller yet
                (
                  isSeller || // Seller can always attempt to complete if not already completed
                  (isCurrentUserBuyer && !chat.buyer_requested_completion) // Buyer can complete if they haven't requested yet
                );

              return (
                <div 
                  key={chat.id} 
                  className="chat-item-container"
                >
                  <div
                    className={`chat-item ${chatClass} ${chat.unread_count > 0 ? 'unread' : ''}`}
                    onClick={() => navigateToChat(chat.id)}
                  >
                    <div className="chat-item-image">
                      <img 
                        src={parseImagePath(chat.product_image) || '/placeholder-image.jpg'} 
                        alt={chat.product_name} 
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = '/placeholder-image.jpg';
                        }}
                      />
                    </div>
                    
                    <div className="chat-item-details">
                      <h3>{chat.product_name}</h3>
                      <p className="chat-item-price">${parseFloat(chat.product_price).toLocaleString()}</p>
                      <p className="chat-last-message">
                        {chat.last_message || 'No messages yet'}
                      </p>
                      <div className="chat-partner">
                        <span className={`role-dot ${isSeller ? 'seller' : 'buyer'}`}></span>
                        <span>{isSeller ? 'Selling to' : 'Buying from'}: {chatPartnerEmail}</span>
                        <span className="chat-time">{formatLastMessageTime(chat.last_message_at)}</span>
                      </div>
                    </div>
                    
                    {chat.unread_count > 0 && (
                      <div className="unread-badge">
                        {chat.unread_count > 9 ? '9+' : chat.unread_count}
                      </div>
                    )}
                    
                    <Todo 
                      onDelete={() => {
                        setChatToDelete(chat.id);
                        setShowDeleteConfirm(true);
                      }}
                      onComplete={() => {
                        setChatToComplete(chat.id);
                        setShowCompleteConfirm(true);
                      }}
                      showCompleteButton={showCompleteButtonForThisUser} // Pass the new prop
                      paymentCompleted={chat.payment_completed}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {showDeleteConfirm && (() => {
        // Find the chat being considered for cancellation to determine user's role
        const chatBeingCancelled = chats.find(c => c.id === chatToDelete);
        let modalText = "This will cancel the deal and delete the chat. This cannot be undone."; // Default

        if (chatBeingCancelled && currentUser) {
          const isCurrentUserTheSeller = currentUser.userId === chatBeingCancelled.seller_id;
          const isCurrentUserTheBuyer = currentUser.userId === chatBeingCancelled.buyer_id;

          if (isCurrentUserTheSeller) {
            modalText = "This will cancel the deal, delete the chat, and may affect the buyer\'s cart if the item was added from this chat. This cannot be undone.";
          } else if (isCurrentUserTheBuyer) {
            modalText = "This will cancel the deal, delete the chat, and remove the item from your cart (if added via this chat). This cannot be undone.";
          }
        }

        return (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>Cancel Deal</h3>
              <p>This will delete the chat and end the deal for both sides. The product will remain listed. This can't be undone.</p>
              <div className="modal-actions">
                <button 
                  className="modal-btn cancel" 
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                >
                  Keep Chat
                </button>
                <button 
                  className="modal-btn delete" // Class can remain 'delete' for styling, or change if needed
                  onClick={confirmDeleteChat} // This function handles the "cancel deal" logic now
                  disabled={deleting}
                >
                  {deleting ? 'Cancelling...' : 'Yes, Cancel Deal'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      
      {showCompleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Complete Payment</h3>
            <p>{currentUser?.userId === chats.find(c => c.id === chatToComplete)?.seller_id 
              ? "Confirm that you've received payment from the buyer in person. This will mark the deal as complete and remove the item from the marketplace." 
              : "Please confirm that you have paid the seller the full agreed amount (e.g., via Zelle, Venmo, cash, etc.). Clicking 'Complete Payment' testifies that you have completed your payment."}</p>
            <div className="modal-actions">
              <button 
                className="modal-btn cancel" 
                onClick={() => setShowCompleteConfirm(false)}
                disabled={completing}
              >
                Cancel
              </button>
              <button 
                className="modal-btn complete" 
                onClick={confirmCompletePayment}
                disabled={completing}
              >
                {completing ? 'Processing...' : 'Complete Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showToast && (
        <ToastNotification
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
}

function ChatPage() {
  const { id } = useParams();
  const { authAxios, currentUser, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');
  const [userScrolled, setUserScrolled] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [completing, setCompleting] = useState(false);

  // For debugging
  useEffect(() => {
    console.log("Current user:", currentUser);
  }, [currentUser]);

  // Initialize socket connection and fetch chat data
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    console.log('Initializing socket connection...');
    // Initialize socket.io client with auth token
    const token = localStorage.getItem('token');
    console.log('Using token for socket auth:', token ? 'Token exists' : 'No token');

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'], // Try both websocket and polling
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    newSocket.on('connect', () => {
      console.log('Socket connected successfully!', newSocket.id);
      setSocketConnected(true);
      
      // Join the chat room once connected
      console.log(`Joining chat room: ${id}`);
      newSocket.emit('join_chat', id);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      // Try to reconnect automatically
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setSocketConnected(false);
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    setSocket(newSocket);

    // Cleanup function
    return () => {
      console.log('Cleaning up socket connection');
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [isAuthenticated, navigate, id]);

  // Listen for new messages and other events
  useEffect(() => {
    if (!socket || !currentUser?.userId) return; // Ensure socket and user ID are ready

    console.log(`Setting up message listener for chat ${id} and user ${currentUser.userId}`);

    // Listen for new messages from other users
    const handleNewMessage = (message) => {
      if (currentUser?.userId === message.sender_id && !message.is_system_message) {
        // If it IS a system message, even if sender_id is current user (like buyer requested completion), we want to show it.
        return; 
      }
      setMessages(prevMessages => {
        if (prevMessages.some(m => m.id === message.id)) return prevMessages;
        return [...prevMessages, message];
      });
      if (!userScrolled) scrollToBottom();
    };

    const handleChatPaymentUpdated = (data) => { // This is for when seller completes the deal fully
      if (data.chatId === id) {
        console.log('ChatPage: Received chat_payment_updated (seller completed deal):', data);
        setChat(prevChat => ({ ...prevChat, payment_completed: data.payment_completed, buyer_requested_completion: true })); // Also assume buyer request is fulfilled
      }
    };

    const handleChatUpdated = (updatedChatData) => { // For buyer_requested_completion flag updates
      if (updatedChatData.id === id) {
        console.log('ChatPage: Received chat_updated (e.g. buyer requested completion):', updatedChatData);
        setChat(prevChat => ({ ...prevChat, ...updatedChatData }));
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('chat_payment_updated', handleChatPaymentUpdated); // From seller's full completion
    socket.on('chat_updated', handleChatUpdated); // From buyer's request completion

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('chat_payment_updated', handleChatPaymentUpdated);
      socket.off('chat_updated', handleChatUpdated);
    };
  }, [socket, currentUser?.userId, id, userScrolled, setChat, setMessages]); // Added setMessages

  // Fetch chat and message data
  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates on unmounted component

    const fetchChatAndMessages = async () => {
      // Ensure we don't proceed if the component isn't mounted or auth isn't ready
      if (!isMounted || !isAuthenticated || !id || !authAxios) return;

      console.log(`Fetching chat/message data for ID: ${id}`);
      setLoading(true); // Set loading true when fetching starts
      try {
        const [chatResponse, messagesResponse] = await Promise.all([
          authAxios.get(`/chats/${id}`),
          authAxios.get(`/chats/${id}/messages`)
        ]);

        if (isMounted) {
          setChat(chatResponse.data);
          setMessages(messagesResponse.data);
          console.log('Chat data received:', chatResponse.data);
          console.log('Messages received:', messagesResponse.data.length);

          // Initial scroll to bottom after loading messages
          // Using a short timeout to ensure DOM is updated
          setTimeout(() => {
            scrollToBottom('auto');
          }, 100);
        }
      } catch (err) {
        console.error('Error fetching chat data:', err.response?.data || err.message);
        if (isMounted) {
          setToastMessage(err.response?.data?.error || 'Failed to load chat');
          setToastType('error');
          setShowToast(true);
          // Consider navigating away only if the error is critical (e.g., 404 Not Found, 403 Forbidden)
          if (err.response?.status === 404 || err.response?.status === 403) {
              setTimeout(() => navigate('/chats'), 2000);
          } else {
              // For other errors, maybe allow retry or show persistent error?
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false); // Set loading false when fetching finishes
        }
      }
    };

    fetchChatAndMessages();

    // Cleanup function to set isMounted false when component unmounts
    return () => {
      isMounted = false;
    };
  }, [authAxios, id, isAuthenticated, navigate]); // Dependencies: only fetch when these change

  // Function to scroll to bottom of messages
  const scrollToBottom = (behavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: behavior });
    }
  };

  // Scroll to bottom when messages change (new message sent or received)
  useEffect(() => {
    if (messages.length > 0 && !userScrolled) {
      scrollToBottom();
    }
  }, [messages, userScrolled]);

  // Reset userScrolled when chat changes
  useEffect(() => {
    setUserScrolled(false);
  }, [id]);

  // Track user scroll to determine if auto-scroll should be disabled
  const handleScroll = (e) => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const bottomThreshold = 100; // pixels from bottom
      const isAtBottom = scrollHeight - scrollTop - clientHeight < bottomThreshold;
      
      // Only update if state needs to change
      if (userScrolled && isAtBottom) {
        setUserScrolled(false);
      } else if (!userScrolled && !isAtBottom) {
        setUserScrolled(true);
      }
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    // Safety check: Ensure currentUser.userId is available
    if (!currentUser?.userId) {
      console.error("Cannot send message: currentUser ID is not available.");
      setToastMessage("Error: User information not fully loaded. Please try again shortly.");
      setToastType("error");
      setShowToast(true);
      return;
    }
    
    const messageText = newMessage.trim();
    if (!messageText || sending) return;
    
    setSending(true);
    console.log(`Sending message in chat ${id}: ${messageText}`);
    
    // Clear input immediately for better UX
    setNewMessage('');
    
    // Add optimistic message (temporary)
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      chat_id: id,
      sender_id: currentUser.userId, // Use currentUser.userId here
      content: messageText,
      created_at: new Date().toISOString(),
      sender_email: currentUser.email,
      temporary: true,
      is_read: false
    };
    
    // Add to state with immutable update pattern
    setMessages(prev => [...prev, optimisticMessage]);
    
    // Reset userScrolled when sending a message
    setUserScrolled(false);
    
    // Ensure scroll to bottom occurs after message is added
    setTimeout(() => {
      scrollToBottom();
    }, 10);
    
    try {
      let finalMessageId = tempId;
      
      // Make sure we're using the correct API URL
      console.log('Sending via REST API');
      const response = await authAxios.post(`/chats/${id}/messages`, {
        content: messageText
      });
      
      console.log('Message sent successfully via REST API:', response.data);
      finalMessageId = response.data.id;
      
      // Replace optimistic message with real one
      setMessages(prev => prev.map(msg => 
        msg.id === tempId ? {...response.data, id: response.data.id} : msg
      ));
    } catch (err) {
      console.error('Error sending message:', err);
      
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      
      // Put the text back in the input field
      setNewMessage(messageText);
      
      // Show toast notification instead of alert
      setToastMessage(err.response?.data?.error || 'Failed to send message');
      setToastType('error');
      setShowToast(true);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteChat = async () => {
    if (deleting) return;
    
    setDeleting(true);
    try {
      await authAxios.delete(`/chats/${id}`);
      setToastMessage("Chat deleted successfully. The item has been removed from your cart.");
      setToastType("success");
      setShowToast(true);
      
      // Navigate back to chats list after a short delay
      setTimeout(() => {
        navigate('/chats');
      }, 1500);
    } catch (err) {
      console.error('Error deleting chat:', err);
      setToastMessage(err.response?.data?.error || 'Failed to delete chat');
      setToastType('error');
      setShowToast(true);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCompletePayment = async () => {
    if (completing) return;
    
    setCompleting(true);
    try {
      // This would connect to your API endpoint for completing payments
      console.log(`ChatPage: Attempting to complete payment for chat ID: ${id}`); // Added log
      await authAxios.post(`/chats/${id}/complete-payment`);
      
      // Update local chat state to reflect completion immediately
      setChat(prevChat => ({ ...prevChat, payment_completed: true }));

      setToastMessage("Payment marked as completed successfully.");
      setToastType("success");
      setShowToast(true);
      
      // Close the modal after completion
      setShowCompleteConfirm(false);
      setCompleting(false);
    } catch (err) {
      console.error('Error completing payment:', err);
      setToastMessage(err.response?.data?.error || 'Failed to complete payment');
      setToastType('error');
      setShowToast(true);
      setCompleting(false);
      setShowCompleteConfirm(false);
    }
  };

  const formatMessageTime = (timestamp) => {
    const messageDate = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Check if message is from today
    if (messageDate.toDateString() === today.toDateString()) {
      return messageDate.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    }
    
    // Check if message is from yesterday
    if (messageDate.toDateString() === yesterday.toDateString()) {
      return `Yesterday ${messageDate.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      })}`;
    }
    
    // Otherwise show date and time
    return messageDate.toLocaleDateString([], {
      month: 'short',
      day: 'numeric'
    }) + ' ' + messageDate.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  // Check if a message was sent by the current user
  const isMessageFromCurrentUser = (message) => {
    if (!currentUser?.userId) {
      console.warn(`[isMessageFromCurrentUser] Warning: currentUser.userId still unavailable for Msg ID: ${message?.id}`);
      return false;
    }
    const isMatch = message?.sender_id === currentUser.userId;
    console.log(`[isMessageFromCurrentUser] Msg ID: ${message?.id} - Comparing sender ${message?.sender_id} vs current ${currentUser.userId} -> Match: ${isMatch}`);
    return isMatch;
  };

  // Add this function to determine message styling
  const getMessageClassName = (message) => {
    if (!currentUser?.userId) {
       console.error(`[getMessageClassName] Error: currentUser.userId unavailable when getting class for Msg ID: ${message?.id}`);
       return "message error"; // Return an error state class
    }
    const isSent = isMessageFromCurrentUser(message);
    const baseClass = isSent ? "message sent" : "message received";
    
    const isUnread = message?.is_read === false && !isSent;
    // Log the unread status determination
    console.log(`[getMessageClassName] Msg ID: ${message?.id} -> isSent: ${isSent}, isUnread: ${isUnread}, Final Class: "${baseClass}${isUnread ? ' unread' : ''}"`);
    return `${baseClass}${isUnread ? ' unread' : ''}`;
  };

  // --- Multi-stage Loading Checks ---
  // 1. Check authentication status from context
  if (!isAuthenticated) {
    console.log("ChatPage: Not authenticated, redirecting.");
    // This should ideally be handled by a ProtectedRoute component wrapping this page
    return <Navigate to="/login" replace />;
  }

  // 2. Check if chat/message data is still loading
  if (loading || !chat) {
    console.log(`ChatPage: Loading chat data (loading: ${loading}, chat: ${!!chat})`);
    return (
      <div className="chat-page">
        <div className="loading">Loading chat data...</div>
      </div>
    );
  }

  // 3. *After* chat data is loaded, explicitly check for currentUser.userId
  if (!currentUser?.userId) {
    console.warn("ChatPage: Chat data loaded, but currentUser.userId is still missing. Waiting for user context...");
    return (
      <div className="chat-page">
        <div className="loading">Finalizing user information...</div>
      </div>
    );
  }

  // --- If all checks pass, render the chat ---
  console.log(`>>> ChatPage Render: All checks passed. User ID: ${currentUser.userId}`);

  const isCurrentUserBuyer = currentUser?.userId === chat?.buyer_id;
  const isCurrentUserSeller = currentUser?.userId === chat?.seller_id;

  // Determine if Complete Deal button should be disabled
  const completeDealButtonDisabled = 
    completing || 
    chat?.payment_completed || // Already completed by seller
    (isCurrentUserBuyer && chat?.buyer_requested_completion); // Buyer already requested

  return (
    <div className="chat-page">
      <div className="chat-container">
        <div className="chat-header">
          <div className="chat-header-left">
            <Link to="/chats" className="back-button">
              <i className="fas fa-arrow-left"></i>
            </Link>
            <div className="chat-header-info">
              <h2>{chat?.product_name || "Unknown Product"}</h2>
              <p className="chat-header-price">${parseFloat(chat?.product_price || 0).toLocaleString()}</p>
            </div>
          </div>
          <div className="chat-header-right">
            <div className="role-indicator">
              <span className={`role-badge ${isCurrentUserSeller ? 'seller' : 'buyer'}`}>
                {isCurrentUserSeller ? 'SELLING' : 'BUYING'}
              </span>
            </div>
            <button 
              className="todo-button complete-button" // Updated class
              onClick={() => setShowCompleteConfirm(true)}
              disabled={completeDealButtonDisabled} 
            >
              Complete {/* Updated label */}
            </button>
            <button 
              className="todo-button delete-button" // Updated class
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
            >
              Cancel {/* Updated label and changed from icon */}
            </button>
          </div>
        </div>
        
        <div 
          className="messages-container" 
          ref={messagesContainerRef}
          onScroll={handleScroll}
        >
          {messages.length === 0 ? (
            <div className="no-messages">
              <div className="no-messages-icon">💬</div>
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id || `temp-${message.tempId}`}
                  className={`${getMessageClassName(message)} ${message.is_system_message ? 'system-message' : ''}`}
                >
                  <div className="message-content">
                    <p>{message.content}</p>
                    <span className="message-time">
                      {formatMessageTime(message.created_at)}
                      {message.temporary && <span className="message-status">Sending...</span>}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} className="messages-end-ref"></div>
            </>
          )}
        </div>
        
        <form onSubmit={handleSendMessage} className="message-form">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="message-input"
            autoComplete="off"
            disabled={sending}
            onKeyDown={(e) => {
              // Submit on Enter (without Shift)
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
          />
          <button 
            type="submit" 
            className="send-button" 
            disabled={sending || !newMessage.trim()}
            aria-label="Send message"
          >
            {sending ? '...' : ''}
          </button>
        </form>
      </div>
      
      {showToast && (
        <ToastNotification
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}
      
      {showDeleteConfirm && (() => {
        let modalText = "This will cancel the deal and delete the chat. This cannot be undone."; // Default
        // Determine current user's role in the specific chat (chat object should be in ChatPage's scope)
        if (chat && currentUser) { 
            if (isCurrentUserSeller) { // isCurrentUserSeller should be available in ChatPage
                modalText = "This will cancel the deal, delete the chat, and may affect the buyer\'s cart if the item was added from this chat. This cannot be undone.";
            } else if (isCurrentUserBuyer) { // isCurrentUserBuyer should be available in ChatPage
                modalText = "This will cancel the deal, delete the chat, and remove the item from your cart (if added via this chat). This cannot be undone.";
            }
        }
        return (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>Cancel Deal</h3> {/* Ensure title is Cancel Deal */}
              <p>{modalText}</p> {/* Use the dynamic modalText */}
              <div className="modal-actions">
                <button 
                  className="modal-btn cancel" 
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                >
                  Keep Chat
                </button>
                <button 
                  className="modal-btn delete" 
                  onClick={handleDeleteChat} // This should be the existing delete handler for ChatPage
                  disabled={deleting}
                >
                  {deleting ? 'Cancelling...' : 'Yes, Cancel Deal'} {/* Button text from ChatsListPage */}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      
      {showCompleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Complete Payment</h3>
            {/* Updated dynamic text based on isCurrentUserSeller from ChatPage scope */}
            <p>{isCurrentUserSeller 
              ? "Confirm that you\'ve received payment from the buyer in person. This will mark the deal as complete and remove the item from the marketplace." 
              : "Please confirm that you have paid the seller the full agreed amount (e.g., via Zelle, Venmo, cash, etc.). Clicking 'Complete Payment' testifies that you have completed your payment."
            }</p>
            <div className="modal-actions">
              <button 
                className="modal-btn cancel" 
                onClick={() => setShowCompleteConfirm(false)}
                disabled={completing}
              >
                Cancel
              </button>
              <button 
                className="modal-btn complete" 
                onClick={handleCompletePayment} // This is the existing complete handler for ChatPage
                disabled={completing}
              >
                {completing ? 'Processing...' : 'Complete Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/" />;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <CartProvider>
          <MessageProvider>
            <AppContent />
          </MessageProvider>
        </CartProvider>
      </AuthProvider>
    </Router>
  );
}

function AppContent() {
  const { 
    isAuthenticated, 
    currentUser, 
    logout: authContextLogout, // Renamed from AuthContext
    isVerified // Get from AuthContext (currently hardcoded to true if authenticated)
  } = useAuth();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [globalSocket, setGlobalSocket] = useState(null);
  const location = useLocation();

  // Logout handler for the mobile sidebar
  const handleMobileSidebarLogout = () => {
    if (authContextLogout) {
      authContextLogout(); // This calls AuthContext's logout (which includes page reload)
    }
    setIsMobileSidebarOpen(false); // Close sidebar UI
  };
  
  // Existing useEffect for globalSocket (should remain as is)
  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      console.log('Skipping socket connection: not authenticated or no user data');
      if (globalSocket) { // Disconnect if socket exists and auth changes
        globalSocket.disconnect();
        setGlobalSocket(null);
      }
      return;
    }
    
    if (!currentUser.userId) {
      console.log('Skipping socket connection: missing userId in currentUser');
      return;
    }
    
    console.log('Setting up global socket connection for general notifications for user:', currentUser.userId);
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('Skipping socket connection: no token available');
      return;
    }
    
    // Ensure to disconnect previous socket if it exists to prevent multiple connections
    if (globalSocket) {
        globalSocket.disconnect();
    }

    const newSocket = io(SOCKET_URL, {
      auth: { token }
    });
    
    newSocket.on('connect', () => {
      console.log('Global socket connected successfully for user:', currentUser.userId);
    });
    
    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
    
    setGlobalSocket(newSocket);
    
    return () => {
      if (newSocket) {
        console.log('Disconnecting socket for user:', currentUser.userId);
        newSocket.disconnect();
      }
    };
  }, [isAuthenticated, currentUser]); // Dependencies are correct

  const isOnChatPage = location.pathname.match(/^\/chats\/[^/]+$/);
  
  return (
    <>
      <HeadBar openSidebar={() => setIsMobileSidebarOpen(true)} />
      <MobileSidebar 
        isOpen={isMobileSidebarOpen} 
        onClose={() => setIsMobileSidebarOpen(false)}
        isAuthenticated={isAuthenticated} // From useAuth()
        isVerified={isVerified}          // From useAuth()
        onLogout={handleMobileSidebarLogout}
      />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/login" element={!isAuthenticated ? <SignInPage /> : <Navigate to="/home" />} />
        <Route path="/market" element={<MarketPage />} />
        <Route path="/market/:id" element={
          <GrayscalePreview isAuthenticated={isAuthenticated}>
            <ProductDetailPage />
          </GrayscalePreview>
        } />
        <Route path="/create-product" element={
          <GrayscalePreview isAuthenticated={isAuthenticated}>
            <CreateProductPage />
          </GrayscalePreview>
        } />
        <Route path="/my-products" element={
          <GrayscalePreview isAuthenticated={isAuthenticated}>
            <ProductManagementPage />
          </GrayscalePreview>
        } />
        <Route path="/cart" element={
          <GrayscalePreview isAuthenticated={isAuthenticated}>
            <CartPage />
          </GrayscalePreview>
        } />
        <Route path="/chats" element={
          <GrayscalePreview isAuthenticated={isAuthenticated}>
            <ChatsListPage />
          </GrayscalePreview>
        } />
        <Route path="/chats/:id" element={
          <GrayscalePreview isAuthenticated={isAuthenticated}>
            <ChatPage />
          </GrayscalePreview>
        } />
        <Route path="/admin" element={
          <GrayscalePreview isAuthenticated={isAuthenticated && currentUser?.isAdmin}>
            <AdminDashboard />
          </GrayscalePreview>
        } />
        <Route path="/discover" element={
          <GrayscalePreview isAuthenticated={isAuthenticated}>
            <SwipeDiscovery />
          </GrayscalePreview>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!isOnChatPage && <SiteFooter />}
      {!isOnChatPage && <HelpChatWidget />}
      {toast && <ToastNotification {...toast} onClose={() => setToast(null)} />}
    </>
  );
}

// Add a footer component
function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-container">
        <div className="footer-section">
          <h3>Lion Bay</h3>
          <p>The marketplace where you can actually get stuff before the semester ends. You heard!</p>
        </div>
        
        <div className="footer-section">
          <h3>Quick Links</h3>
          <ul>
            <li><Link to="/home">Home</Link></li>
            <li><Link to="/market">Explore Stuff</Link></li>
            <li><Link to="/create-product">Sell Your Stuff</Link></li>
          </ul>
        </div>
        
        <div className="footer-section">
          <h3>Find Your Way</h3>
          <div className="site-map">
            <div className="site-map-item">
              <span className="site-map-icon"><i className="fas fa-home"></i></span>
              <Link to="/home">Home</Link>
            </div>
            <div className="site-map-item">
              <span className="site-map-icon"><i className="fas fa-shopping-cart"></i></span>
              <Link to="/market">Find Things</Link>
            </div>
            <div className="site-map-item">
              <span className="site-map-icon"><i className="fas fa-plus"></i></span>
              <Link to="/create-product">Sell Things</Link>
            </div>
            <div className="site-map-item">
              <span className="site-map-icon"><i className="fas fa-comment"></i></span>
              <Link to="/chats">Slide in DMs</Link>
            </div>
            <div className="site-map-item">
              <span className="site-map-icon"><i className="fas fa-user"></i></span>
              <span className="coming-soon">Profile <span className="coming-soon-badge">Coming Soon</span></span>
            </div>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} Lion Bay. Better, faster, where campus connections happen.</p>
      </div>
    </footer>
  );
}


function CartPage() {
  const { authAxios, isAuthenticated, currentUser } = useAuth();
  const { updateCartCount } = useCart();
  const { protectedAction, renderToast } = useProtectedInteraction();
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');

  useEffect(() => {
    const fetchCartItems = async () => {
      try {
        setLoading(true);
        if (isAuthenticated) {
          console.log('Fetching cart items for user');
        const response = await authAxios.get('/cart');
          console.log('Cart items received:', response.data);
          setCartItems(response.data);
        } else {
          // For non-authenticated users, just set an empty array
          setCartItems([]);
        }
      } catch (err) {
        console.error('Error fetching cart items:', err.response?.data || err.message);
        setToastMessage(err.response?.data?.error || 'Failed to load cart items. Please try again.');
        setToastType('error');
        setShowToast(true);
        setCartItems([]); // Reset on error
      } finally {
        setLoading(false);
      }
    };

    fetchCartItems();
  }, [authAxios, isAuthenticated, navigate]);

  const handleRemoveFromCart = async (cartItemId) => {
    if (!isAuthenticated) return; // Will be handled by protectedAction

    try {
      await authAxios.delete(`/cart/${cartItemId}`);
      
      // Update state to remove the item
      setCartItems(prevItems => prevItems.filter(item => item.id !== cartItemId));
      
      // Update cart count
      if (updateCartCount) {
        updateCartCount();
      }
      
      setToastMessage('Item removed from cart.');
      setToastType('success');
      setShowToast(true);
    } catch (err) {
      console.error('Error removing from cart:', err.response?.data || err.message);
      setToastMessage(err.response?.data?.error || 'Failed to remove item from cart.');
      setToastType('error');
      setShowToast(true);
    }
  };

  const handleContactSeller = async (productId, sellerId) => {
    if (!isAuthenticated) return; // Will be handled by protectedAction

    try {
      // Create or get chat for this product
      const response = await authAxios.post('/chats', {
        product_id: productId,
        seller_id: sellerId
      });
      
      console.log("Chat created/retrieved:", response.data);
      
      // Update the cart item to CONTACTED type
      const cartItem = cartItems.find(item => item.product_id === productId);
      if (cartItem) {
        await authAxios.put(`/cart/${cartItem.id}`, {
          cart_type: 'CONTACTED',
          chat_id: response.data.id
        });
        
        // Update the local state
        setCartItems(prevItems => 
          prevItems.map(item => 
            item.id === cartItem.id
              ? { ...item, cart_type: 'CONTACTED', chat_id: response.data.id }
              : item
          )
        );
        
        // Update cart count (not needed for this operation, but added for consistency)
        if (updateCartCount) {
          updateCartCount();
        }
      }
      
      // Show success toast
      setToastMessage("Seller contacted successfully.");
      setToastType("success");
      setShowToast(true);
      
      // Wait a moment before navigating to allow toast to be seen
      setTimeout(() => {
        // Navigate to the chat
        navigate(`/chats/${response.data.id}`);
      }, 1500);
      
    } catch (err) {
      console.error('Error contacting seller:', err.response?.data || err.message);
      setToastMessage(err.response?.data?.error || 'Failed to contact seller. Please try again.');
      setToastType('error');
      setShowToast(true);
    }
  };

  if (loading) return (
    <div className="cart-page">
      <div className="loading">Loading cart items...</div>
    </div>
  );

  // Separate items into contacted and cart-only
  const contactedItems = cartItems.filter(item => item.cart_type === 'CONTACTED');
  const cartOnlyItems = cartItems.filter(item => item.cart_type === 'CART_ONLY');

  return (
    <div className="cart-page">
      <div className="cart-container">
        <h1>Your Cart</h1>
        
        {cartItems.length === 0 ? (
          <div className="empty-cart">
            <p>Your cart is empty.</p>
            <Link to="/market" className="browse-button">Browse Products</Link>
          </div>
        ) : (
          <>
            {contactedItems.length > 0 && (
              <div className="cart-section">
                <h2 className="cart-section-title">Items You've Contacted Sellers About</h2>
                <div className="cart-items-list">
                  {contactedItems.map(item => (
                    <div key={item.id} className="cart-item">
                      <div className="cart-item-image">
                        <img 
                          src={parseImagePath(item.product_image) || "/api/placeholder/150/150"} 
                          alt={item.product_name || "Product"} 
                        />
                      </div>
                      <div className="cart-item-details">
                        <h3 className="cart-item-title">{item.product_name || "Unknown Product"}</h3>
                        <p className="cart-item-price">${parseFloat(item.product_price || 0).toLocaleString()}</p>
                        <p className="cart-item-condition">Condition: {item.product_condition}</p>
                        <p className="cart-seller">Seller: {item.seller_email}</p>
                        <div className="cart-item-actions">
                          <button 
                            onClick={() => protectedAction(() => navigate(`/chats/${item.chat_id}`))} 
                            className="go-to-chat-button"
                          >
                            Go to Chat
                          </button>
                          <button 
                            onClick={() => protectedAction(() => handleRemoveFromCart(item.id))}
                            className="remove-from-cart-button"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {cartOnlyItems.length > 0 && (
              <div className="cart-section">
                <h2 className="cart-section-title">Items in Your Cart</h2>
                <div className="cart-items-list">
                  {cartOnlyItems.map(item => (
                    <div key={item.id} className="cart-item">
                      <div className="cart-item-image">
                        <img 
                          src={parseImagePath(item.product_image) || "/api/placeholder/150/150"} 
                          alt={item.product_name || "Product"} 
                        />
                      </div>
                      <div className="cart-item-details">
                        <h3 className="cart-item-title">{item.product_name || "Unknown Product"}</h3>
                        <p className="cart-item-price">${parseFloat(item.product_price || 0).toLocaleString()}</p>
                        <p className="cart-item-condition">Condition: {item.product_condition}</p>
                        <p className="cart-seller">Seller: {item.seller_email}</p>
                        <div className="cart-item-actions">
                          <button 
                            onClick={() => protectedAction(() => handleContactSeller(item.product_id, item.seller_id))}
                            className="contact-seller-button"
                          >
                            Start Chat
                          </button>
                          <button 
                            onClick={() => protectedAction(() => handleRemoveFromCart(item.id))}
                            className="remove-from-cart-button"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="cart-footer">
              <Link to="/market" className="continue-shopping-button">
                Continue Shopping
              </Link>
            </div>
          </>
        )}
      </div>
      
      {showToast && (
        <ToastNotification
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}
      
      {/* Render the protected interaction toast if needed */}
      {renderToast()}
    </div>
  );
}

function ProductManagementPage() {
  const { authAxios, isAuthenticated, currentUser } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [formData, setFormData] = useState({
    name: '',
    details: '',
    condition: 'New',
    price: '',
    category: '',
    image_path: '',
    other_category: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [imageFile, setImageFile] = useState(null);
  const [previewImages, setPreviewImages] = useState([]);

  const categories = [
    'Laptops & Accessories',
    'Textbooks & Study Guides',
    'Dorm & Apartment Essentials',
    'Bicycles & Scooters',
    'Electronics & Gadgets',
    'Furniture & Storage',
    'Clothing & Fashion',
    'School Supplies',
    'Clothes Swap',
    'Courses',
    'Roommate Posting',
    'Meal Swipes',
    'Other'
  ];

  useEffect(() => {
    // Remove the authentication check since GrayscalePreview component handles it
    // Only fetch products if the user is authenticated
    if (isAuthenticated && currentUser) {
      fetchUserProducts();
    }
  }, [authAxios, isAuthenticated, currentUser]); // Keep dependencies

  const fetchUserProducts = async () => {
    // Only attempt to fetch if the user is authenticated and authAxios is available
    if (!isAuthenticated || !authAxios || !currentUser) {
      console.log("Cannot fetch products: User not authenticated or currentUser not available");
      setLoading(false);
      setProducts([]);
      return;
    }
    
    if (!currentUser.userId) { // Fixed: Check for userId
      console.log("Cannot fetch products: User ID is undefined");
      setLoading(false);
      setProducts([]);
      return;
    }
    
    try {
      setLoading(true);
      console.log("Fetching products for user ID:", currentUser.userId); // Fixed: Log userId
      // Use the existing products endpoint with the seller_id filter
      const response = await authAxios.get(`/products?seller_id=${currentUser.userId}`); // Fixed: Use userId
      console.log("Fetched user products response:", response);
      console.log("Fetched user products data:", response.data);
      
      // Ensure we have an array of products and debug product IDs
      if (Array.isArray(response.data)) {
        // Check ID fields in the data
        response.data.forEach((product, index) => {
          console.log(`Product ${index} ID fields:`, {
            id: product.id,
            _id: product._id,
            productId: product.productId
          });
          
          // Ensure all products have a standard 'id' field
          if (!product.id && product._id) {
            console.log(`Converting _id to id for product index ${index}`);
            product.id = product._id;
          }
        });
        
        setProducts(response.data);
        console.log("Products state updated with:", response.data.length, "products");
      } else {
        console.error("Expected array of products, got:", response.data);
        setProducts([]);
      }
    } catch (error) {
      console.error("Error fetching user's products:", error);
      console.error("Error details:", error.response?.data || error.message);
      setToastMessage("Error loading your products. Please try again.");
      setToastType('error');
      setShowToast(true);
      setProducts([]); // Reset products on error
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const errors = {};
    let hasError = false;

    // Check required fields
    if (!formData.name.trim()) {
      errors.name = "Product name is required";
      hasError = true;
    } else if (formData.name.length < 3) {
      errors.name = "Product name must be at least 3 characters long";
      hasError = true;
    } else if (formData.name.length > 30) {
      errors.name = "Product name must be 30 characters or less";
      hasError = true;
    }

    // Price validation
    if (!formData.price) {
      errors.price = "Price is required";
      hasError = true;
    } else if (isNaN(formData.price) || formData.price <= 0) {
      errors.price = "Price must be a positive number";
      hasError = true;
    } else if (formData.price > 1000000) {
      errors.price = "Price must not exceed $1,000,000";
      hasError = true;
    }

    // Condition validation
    if (!formData.condition) {
      errors.condition = "Condition is required";
      hasError = true;
    }

    // Category validation
    if (!formData.category) {
      errors.category = "Category is required";
      hasError = true;
    } else if (formData.category === 'Other' && !formData.other_category?.trim()) {
      errors.other_category = "Please specify a custom category";
      hasError = true;
    }

    // Details validation
    if (!formData.details.trim()) {
      errors.details = "Product details are required";
      hasError = true;
    } else if (formData.details.length < 10) {
      errors.details = "Product details must be at least 10 characters long";
      hasError = true;
    } else if (formData.details.length > 1000) {
      errors.details = "Product details must be less than 1000 characters";
      hasError = true;
    }

    // Image validation
    if (previewImages.length === 0) {
      errors.images = "At least one product image is required";
      hasError = true;
    } else if (previewImages.length > 4) {
      errors.images = "Maximum 4 images allowed";
      hasError = true;
    }

    // Set form errors
    setFormErrors(errors);
    return !hasError;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'price') {
      // Only allow numeric input with up to 2 decimal places for price
      if (value === '' || /^\d+(\.\d{0,2})?$/.test(value)) {
        setFormData({
          ...formData,
          [name]: value
        });
      }
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
    
    // Clear error when field is updated
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: null
      });
    }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    console.log('Files selected:', files.length, files);
    if (files.length === 0) return;
    
    // Check how many more images we can add (max 4 total)
    const remainingSlots = 4 - previewImages.length;
    if (remainingSlots <= 0) {
      setFormErrors({
        ...formErrors,
        images: 'Maximum 4 images allowed. Please remove some images before adding more.'
      });
      return;
    }
    
    // Limit to max remaining slots
    const limitedFiles = files.slice(0, remainingSlots);
    console.log(`Processing ${limitedFiles.length} new files (${previewImages.length} existing, max 4 total)`);
    
    // Set currently selected file for UI display
    if (limitedFiles.length === 1) {
      setImageFile(limitedFiles[0]);
    } else if (limitedFiles.length > 1) {
      setImageFile({ name: `${limitedFiles.length} files selected` });
    }
    
    // Process each file
    let processedImages = 0;
    const newImages = [];
    
    limitedFiles.forEach(file => {
      // Check file type
      if (!file.type.startsWith('image/')) {
        setFormErrors({
          ...formErrors,
          images: 'Please upload valid image files (JPEG, PNG, or GIF)'
        });
        return;
      }

      // Check file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB in bytes
      if (file.size > maxSize) {
        setFormErrors({
          ...formErrors,
          images: 'Image size must be less than 5MB'
        });
        return;
      }

      // Read file as data URL
      const reader = new FileReader();
      reader.onload = (event) => {
        newImages.push(event.target.result);
        processedImages++;
        
        // When all files are processed, update state
        if (processedImages === limitedFiles.length) {
          const updatedImages = [...previewImages, ...newImages];
          setPreviewImages(updatedImages);
          
          // Update image_path with pipe delimiter
          setFormData({
            ...formData,
            image_path: updatedImages.join('|')
          });
        }
      };
      
      reader.onerror = () => {
        processedImages++;
        setFormErrors({
          ...formErrors,
          images: 'Failed to read image file. Please try again.'
        });
      };
      
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index) => {
    const updatedPreviews = [...previewImages];
    updatedPreviews.splice(index, 1);
    setPreviewImages(updatedPreviews);
    
    // Update formData.image_path with pipe delimiter
    setFormData({
      ...formData,
      image_path: updatedPreviews.join('|')
    });
  };

  const handleEditProduct = (product) => {
    setSelectedProduct(product);
    
    // Initialize form data
    setFormData({
      name: product.name,
      details: product.details,
      condition: product.condition,
      price: product.price.toString(), // Convert price to string for input field
      category: product.category,
      image_path: product.image_path,
      other_category: product.category === 'Other' ? product.custom_category || '' : ''
    });
    
    // Parse multiple images if they exist
    if (product.image_path && product.image_path.includes('|')) {
      const images = product.image_path.split('|').filter(img => img.trim());
      setPreviewImages(images);
    } else {
      // Single image case
      setPreviewImages(product.image_path ? [product.image_path] : []);
    }
    
    setImageFile(null);
    setFormErrors({});
    setShowEditForm(true);
    setShowAddForm(false);
  };

  const handleAddNewProduct = () => {
    setSelectedProduct(null);
    setFormData({
      name: '',
      details: '',
      condition: 'New',
      price: '',
      category: '',
      image_path: '',
      other_category: ''
    });
    setPreviewImages([]);
    setImageFile(null);
    setFormErrors({});
    setShowAddForm(true);
    setShowEditForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('ProductManagementPage form submission started');
    
    if (!validateForm()) {
      setToastMessage("Please fix form errors before submitting");
      setToastType('error');
      setShowToast(true);
      return;
    }
    
    try {
      let finalCategory = formData.category;
      if (formData.category === 'Other' && formData.other_category) {
        finalCategory = formData.other_category;
      }
      
      // Convert price to a number and enforce limit
      const priceValue = Number(formData.price);
      if (isNaN(priceValue) || priceValue <= 0) {
        setToastMessage('Price must be a positive number');
        setToastType('error');
        setShowToast(true);
        return;
      } else if (priceValue > 1000000) {
        setToastMessage('Price must not exceed $1,000,000');
        setToastType('error');
        setShowToast(true);
        return;
      }

      // Create image path string from preview images
      const imagePathString = previewImages.join('|');
      
      const productData = {
        name: formData.name.trim(),
        details: formData.details.trim(),
        condition: formData.condition,
        price: priceValue,
        category: finalCategory,
        image_path: imagePathString
      };
      
      console.log('Sending product data:', productData);
      
      if (selectedProduct) {
        // Update existing product
        const response = await authAxios.put(`/products/${selectedProduct.id}`, productData);
        console.log('Product updated successfully:', response.data);
        setToastMessage("Product updated successfully!");
      } else {
        // Create new product
        const response = await authAxios.post('/products', productData);
        console.log('Product created successfully:', response.data);
        setToastMessage("Product created successfully!");
      }
      
      setToastType('success');
      setShowToast(true);
      
      // Reset form and fetch updated products
      setShowEditForm(false);
      setShowAddForm(false);
      fetchUserProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      setToastMessage(error.response?.data?.error || "Failed to save product. Please try again.");
      setToastType('error');
      setShowToast(true);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!productId) {
      console.error("Cannot delete product: productId is undefined");
      setToastMessage("Error: Product ID is missing");
      setToastType('error');
      setShowToast(true);
      return;
    }
    
    if (window.confirm("Are you sure you want to delete this product? This action cannot be undone.")) {
      try {
        console.log("Attempting to delete product with ID:", productId);
        const response = await authAxios.delete(`/products/${productId}`);
        console.log("Delete product response:", response);
        
        setToastMessage("Product deleted successfully!");
        setToastType('success');
        setShowToast(true);
        
        // Refresh product list
        await fetchUserProducts();
      } catch (error) {
        console.error("Error deleting product:", error);
        console.error("Error details:", error.response?.data || error.message);
        
        // Handle specific error cases
        if (error.response && error.response.status === 403) {
          setToastMessage("You don't have permission to delete this product.");
        } else if (error.response && error.response.status === 404) {
          setToastMessage("Product not found. It may have been already deleted.");
        } else {
          setToastMessage(error.response?.data?.error || "Failed to delete product. Please try again.");
        }
        
        setToastType('error');
        setShowToast(true);
      }
    }
  };

  const handleCancel = () => {
    setShowEditForm(false);
    setShowAddForm(false);
  };

  if (loading) {
    return (
      <div className="product-management-page">
        <div className="loading">Loading your products...</div>
      </div>
    );
  }

  return (
    <div className="product-management-page">
      <div className="product-management-container">
        <div className="page-header">
          <h1>Manage Your Products</h1>
        </div>
        <div className="page-actions">
          <button 
            className="add-product-button" 
            onClick={handleAddNewProduct}
          >
            Add New Product
          </button>
        </div>
        
        {(showEditForm || showAddForm) ? (
          // Product Form (Add or Edit)
          <div className="product-form-container">
            <h2>{showEditForm ? 'Edit Product' : 'Add New Product'}</h2>
            <form onSubmit={handleSubmit} className="product-form">
              <div className={`form-group ${formErrors.name ? 'error' : ''}`}>
                <label htmlFor="name">Product Name*</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., MacBook Pro 2023"
                  className={formErrors.name ? 'error-border' : ''}
                  maxLength={30}
                />
                <small className={`character-count ${formData.name.length > 20 ? formData.name.length > 27 ? 'limit-reached' : 'limit-warning' : ''}`}>
                  {formData.name.length}/30 characters
                </small>
                {formErrors.name && <div className="form-error">{formErrors.name}</div>}
              </div>
              
              <div className={`form-group ${formErrors.price ? 'error' : ''}`}>
                <label htmlFor="price">Price ($)*</label>
                <input
                  type="number"
                  id="price"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  min="0.01"
                  step="0.01"
                  placeholder="e.g., 999.99"
                  className={formErrors.price ? 'error-border' : ''}
                  max="1000000"
                />
                <small className="price-limit-note">Maximum price: $1,000,000</small>
                {formErrors.price && <div className="form-error">{formErrors.price}</div>}
              </div>
              
              <div className={`form-group ${formErrors.condition ? 'error' : ''}`}>
                <label htmlFor="condition">Condition*</label>
                <select
                  id="condition"
                  name="condition"
                  value={formData.condition}
                  onChange={handleChange}
                  className={formErrors.condition ? 'error-border' : ''}
                >
                  <option value="">Select</option>
                  <option value="New">New</option>
                  <option value="Like new">Like new</option>
                  <option value="Good condition">Good condition</option>
                  <option value="Fair condition">Fair condition</option>
                  <option value="Poor condition">Poor condition</option>
                </select>
                {formErrors.condition && <div className="form-error">{formErrors.condition}</div>}
              </div>
              
              <div className={`form-group ${formErrors.category ? 'error' : ''}`}>
                <label htmlFor="category">Category*</label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className={formErrors.category ? 'error-border' : ''}
                >
                  <option value="">Select</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                {formErrors.category && <div className="form-error">{formErrors.category}</div>}
              </div>
              
              {formData.category === 'Other' && (
                <div className={`form-group ${formErrors.other_category ? 'error' : ''}`}>
                  <label htmlFor="other_category">Specify Category*</label>
                  <input
                    type="text"
                    id="other_category"
                    name="other_category"
                    value={formData.other_category}
                    onChange={handleChange}
                    placeholder="Enter custom category"
                    className={formErrors.other_category ? 'error-border' : ''}
                  />
                  {formErrors.other_category && <div className="form-error">{formErrors.other_category}</div>}
                </div>
              )}
              
              <div className={`form-group ${formErrors.details ? 'error' : ''}`}>
                <label htmlFor="details">Details*</label>
                <textarea
                  id="details"
                  name="details"
                  value={formData.details}
                  onChange={handleChange}
                  placeholder="Describe your item, including features and any defects"
                  className={formErrors.details ? 'error-border' : ''}
                  maxLength={1000}
                  rows="5"
                ></textarea>
                <small className={`character-count ${formData.details.length > 800 ? formData.details.length > 950 ? 'limit-reached' : 'limit-warning' : ''}`}>
                  {formData.details.length}/1000 characters
                </small>
                {formErrors.details && <div className="form-error">{formErrors.details}</div>}
              </div>
              
              <div className="form-group">
                <label>Product Image*</label>
                
                <div className="file-upload-container">
                  <input
                    type="file"
                    id="image_file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="file-upload-input"
                    multiple
                  />
                  <label htmlFor="image_file" className={`file-upload-label ${formErrors.images ? 'error-border' : ''}`}>
                    {imageFile ? imageFile.name : 'Choose images (max 4)'}
                  </label>
                </div>
                
                {previewImages.length > 0 && (
                  <div className="image-previews">
                    {previewImages.map((image, index) => (
                      <div key={index} className="image-preview-item">
                        <img src={image} alt={`Product preview ${index + 1}`} />
                        <button 
                          type="button" 
                          className="remove-image"
                          onClick={() => removeImage(index)}
                          aria-label={`Remove image ${index + 1}`}
                        >
                          ×
                        </button>
                        <div className="image-preview-count">
                          {index + 1}/{previewImages.length}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {previewImages.length > 0 && (
                  <div className="image-upload-status">
                    <span>{previewImages.length} of 4 images added</span>
                    {previewImages.length === 4 && (
                      <span className="max-reached">Maximum reached</span>
                    )}
                  </div>
                )}
                
                {previewImages.length === 0 && (
                  <div className="image-preview empty">
                    <span>No preview</span>
                  </div>
                )}
                
                {formErrors.images && <div className="form-error">{formErrors.images}</div>}
              </div>
              
              <div className="form-actions">
                <button 
                  type="button" 
                  className="cancel-button"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="save-product-button"
                >
                  {showEditForm ? 'Update Product' : 'List Item for Sale'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          // Product List
          <div className="products-management-list">
            {products.length === 0 ? (
              <div className="no-products-message">
                <p>You haven't listed any products yet.</p>
                <p>Click 'Add New Product' to get started!</p>
              </div>
            ) : (
              products.map(product => (
                <div key={product.id} className="product-management-item">
                  <div className="product-management-image">
                    <img 
                      src={parseImagePath(product.image_path) || "/api/placeholder/150/150"} 
                      alt={product.name} 
                    />
                  </div>
                  <div className="product-management-details">
                    <h3>{product.name}</h3>
                    <p className="product-management-price">${parseFloat(product.price).toFixed(2)}</p>
                    <p className="product-management-category">{product.category}</p>
                    <p className="product-management-condition">{product.condition}</p>
                    <p className="product-management-status">
                      <span className={`status-indicator ${product.is_sold ? 'sold' : 'available'}`}>
                        {product.is_sold ? 'Sold' : 'Available'}
                      </span>
                    </p>
                  </div>
                  <div className="product-management-actions">
                    <button 
                      className="edit-product-button" 
                      onClick={() => handleEditProduct(product)}
                    >
                      Edit
                    </button>
                    <button 
                      className="delete-product-button"
                      onClick={() => {
                        // Debug product ID fields
                        console.log("Delete clicked for product:", product);
                        console.log("Product ID fields:", {
                          id: product.id,
                          _id: product._id,
                          productId: product.productId
                        });
                        
                        // Use id, _id, or productId (in that order of preference)
                        const idToUse = product.id || product._id || product.productId;
                        console.log("Using ID for deletion:", idToUse);
                        
                        handleDeleteProduct(idToUse);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
                )}
              </div>
        )}
      </div>
      
      {showToast && (
        <ToastNotification
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
}

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
        
        {isAuthenticated && (
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
                Cart {<span className="cart-badge">{<CartCount />}</span>}
              </Link>
              
              <Link to="/chats" className="sidebar-link" onClick={onClose}>
                <i className="fas fa-comments sidebar-icon"></i>
                DMs {<MessageCount /> && <span className="mobile-badge">{<MessageCount />}</span>}
              </Link>
              
              <button className="mobile-logout-button" onClick={() => {
                onLogout(); 
                onClose();
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

// GrayscalePreview component - Wraps protected content with grayscale filter for non-authenticated users
function GrayscalePreview({ children, isAuthenticated }) {
  const navigate = useNavigate();
  
  if (isAuthenticated) {
    // If user is authenticated, show the normal content
    return children;
  }
  
  // If user is not authenticated, show grayscale preview with login prompt
  const handleSignIn = () => {
    navigate('/login');
  };
  
  return (
    <>
      {/* Render the grayscale content */}
      <div className="grayscale-preview-container">
        <div className="grayscale-content">
          {children}
        </div>
      </div>
      
      {/* Overlay with login prompt */}
      <div className="login-overlay">
        <div className="login-prompt">
          <h2>Login required</h2>
          <p>Please login to use this feature</p>
          <button className="sign-in-btn" onClick={handleSignIn}>
            login
          </button>
        </div>
      </div>
    </>
  );
}

// Utility function for protected interactions
export function useProtectedInteraction() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [showToast, setShowToast] = useState(false);

  const protectedAction = (callback) => {
    if (isAuthenticated) {
      // If user is authenticated, perform the action
      if (typeof callback === 'function') {
        callback();
      }
    } else {
      // If not authenticated, show a toast and redirect to login
      setShowToast(true);
      
      // Redirect to login after a short delay
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    }
  };

  // Render toast message if needed
  const renderToast = () => {
    if (showToast) {
      return (
        <ToastNotification
          message="Please login to continue"
          type="error"
          onClose={() => setShowToast(false)}
        />
      );
    }
    return null;
  };

  return { protectedAction, renderToast };
}

function ProfilePage() {
  const { authAxios, isAuthenticated, currentUser, updateUserProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [profileData, setProfileData] = useState({
    fullName: '',
    email: '',
    classYear: '',
    major: '',
    phoneNumber: '',
    bio: '',
    profileImage: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [isVerified, setIsVerified] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const classYears = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i - 4);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const fetchUserProfile = async () => {
      try {
        setLoading(true);
        // Get user profile data
        const response = await authAxios.get(`/users/profile`);
        
        if (response.data) {
          const userData = response.data;
          setProfileData({
            fullName: userData.fullName || '',
            email: currentUser?.email || '',
            classYear: userData.classYear || '',
            major: userData.major || '',
            phoneNumber: userData.phoneNumber || '',
            bio: userData.bio || '',
            profileImage: userData.profileImage || ''
          });
          
          // Check if user is verified (has fullName and classYear)
          setIsVerified(Boolean(userData.fullName && userData.classYear));
        } else {
          // Initialize with current user's email
          setProfileData(prev => ({
            ...prev,
            email: currentUser?.email || ''
          }));
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        setToastMessage('Failed to load profile data');
        setToastType('error');
        setShowToast(true);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [authAxios, isAuthenticated, navigate, currentUser]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when field is updated
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: null
      });
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setFormErrors({
          ...formErrors,
          profileImage: 'Please upload a valid image file'
        });
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Image = event.target.result;
        setProfileData(prev => ({
          ...prev,
          profileImage: base64Image
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const validateForm = () => {
    const errors = {};
    let hasError = false;

    // Validate required fields
    if (!profileData.fullName.trim()) {
      errors.fullName = "Full name is required";
      hasError = true;
    }

    if (!profileData.classYear) {
      errors.classYear = "Class year is required";
      hasError = true;
    }

    // Email is already validated during login, but check just in case
    if (!profileData.email || !profileData.email.endsWith('@columbia.edu')) {
      errors.email = "Valid Columbia email is required";
      hasError = true;
    }

    setFormErrors(errors);
    return !hasError;
  };

  const handleVerification = async () => {
    setIsVerifying(true);
    try {
      // Extract UNI from email (abc1234@columbia.edu -> abc1234)
      const uni = profileData.email.split('@')[0];
      
      // Call backend for Columbia directory verification
      const response = await authAxios.post('/users/verify-columbia', { uni });
      
      if (response.data && response.data.fullName) {
        // Auto-fill name from directory
        setProfileData(prev => ({
          ...prev,
          fullName: response.data.fullName
        }));
        
        setToastMessage('Columbia student verified successfully!');
        setToastType('success');
      } else {
        setToastMessage('Could not verify automatically. Please enter your name manually.');
        setToastType('warning');
      }
    } catch (error) {
      console.error('Verification error:', error);
      setToastMessage('Verification failed. Please enter your details manually.');
      setToastType('error');
    } finally {
      setIsVerifying(false);
      setShowToast(true);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setToastMessage("Please fill in all required fields");
      setToastType('error');
      setShowToast(true);
      return;
    }
    
    try {
      setLoading(true);
      
      // Save profile data
      await authAxios.post('/users/profile', profileData);
      
      // Update verification status
      const isNowVerified = Boolean(profileData.fullName && profileData.classYear);
      setIsVerified(isNowVerified);
      
      // Update user context if we have an update function
      if (updateUserProfile) {
        updateUserProfile({
          ...currentUser,
          isVerified: isNowVerified
        });
      }
      
      setToastMessage("Profile updated successfully!");
      setToastType('success');
      setShowToast(true);
      setIsEditMode(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      setToastMessage("Failed to update profile. Please try again.");
      setToastType('error');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading profile data...</div>;
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <h1 className="profile-title">Your Profile</h1>

        {!isVerified && (
          <div className="verification-banner">
            <i className="fas fa-exclamation-triangle"></i>
            <div className="verification-message">
              <strong>Complete your profile to verify your Columbia student status.</strong>
              <p>Verification is required to contact sellers, access chats, and sell items.</p>
            </div>
        </div>
      )}
        
        <div className="profile-content">
          <div className="profile-sidebar">
            <div className="profile-image-container">
              {profileData.profileImage ? (
                <img 
                  src={profileData.profileImage} 
                  alt="Profile" 
                  className="profile-image"
                />
              ) : (
                <div className="profile-image-placeholder">
                  <i className="fas fa-user-circle"></i>
                </div>
              )}
              
              {isEditMode && (
                <button 
                  type="button" 
                  className="change-profile-image-button"
                  onClick={() => fileInputRef.current.click()}
                >
                  Change Photo
                </button>
              )}
              <input
                type="file"
                id="profile-image-upload"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden-file-input"
                style={{ display: 'none' }}
              />
            </div>
            
            {isVerified && (
              <div className="verification-badge">
                <i className="fas fa-check-circle"></i>
                Verified Columbia Student
              </div>
            )}
          </div>
          
          <div className="profile-main">
            {!isEditMode ? (
              <>
                <div className="profile-view">
                  <div className="profile-field">
                    <h3>Full Name</h3>
                    <p>{profileData.fullName || 'Not specified'}</p>
                  </div>
                  
                  <div className="profile-field">
                    <h3>Columbia Email</h3>
                    <p>{profileData.email}</p>
                  </div>
                  
                  <div className="profile-field">
                    <h3>Class Year</h3>
                    <p>{profileData.classYear || 'Not specified'}</p>
                  </div>
                  
                  <div className="profile-field">
                    <h3>Major</h3>
                    <p>{profileData.major || 'Not specified'}</p>
                  </div>
                  
                  <div className="profile-field">
                    <h3>Phone Number</h3>
                    <p>{profileData.phoneNumber || 'Not specified'}</p>
                  </div>
                  
                  {profileData.bio && (
                    <div className="profile-field">
                      <h3>Bio</h3>
                      <p className="profile-bio">{profileData.bio}</p>
                    </div>
                  )}
                </div>
                
                <button 
                  type="button"
                  className="edit-profile-button"
                  onClick={() => setIsEditMode(true)}
                >
                  Edit Profile
                </button>
              </>
            ) : (
              <form onSubmit={handleSubmit} className="profile-form">
                <div className={`form-group ${formErrors.fullName ? 'error' : ''}`}>
                  <label htmlFor="fullName">Full Name*</label>
                  <div className="input-group">
                    <input
                      type="text"
                      id="fullName"
                      name="fullName"
                      value={profileData.fullName}
                  onChange={handleChange}
                  placeholder="Your full name"
                  className={formErrors.fullName ? 'error-border' : ''}
                />
                    <button 
                      type="button" 
                      className="verify-button" 
                      onClick={handleVerification}
                      disabled={isVerifying || !profileData.email.endsWith('@columbia.edu')}
                    >
                      {isVerifying ? 'Verifying...' : 'Auto-Verify'}
                    </button>
                  </div>
                  {formErrors.fullName && <div className="form-error">{formErrors.fullName}</div>}
                </div>
                
                <div className="form-group">
                  <label htmlFor="email">Columbia Email*</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={profileData.email}
                    disabled
                    className="disabled-field"
                  />
                  <span className="field-note">Email address is set during login and cannot be changed</span>
                </div>
                
                <div className={`form-group ${formErrors.classYear ? 'error' : ''}`}>
                  <label htmlFor="classYear">Class Year*</label>
                  <select
                    id="classYear"
                    name="classYear"
                    value={profileData.classYear}
                    onChange={handleChange}
                    className={formErrors.classYear ? 'error-border' : ''}
                  >
                    <option value="">Select your class year</option>
                    {classYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  {formErrors.classYear && <div className="form-error">{formErrors.classYear}</div>}
                </div>
                
                <div className="form-group">
                  <label htmlFor="major">Major (Optional)</label>
                  <input
                    type="text"
                    id="major"
                    name="major"
                    value={profileData.major}
                    onChange={handleChange}
                    placeholder="Your major or program"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="phoneNumber">Phone Number (Optional)</label>
                  <input
                    type="tel"
                    id="phoneNumber"
                    name="phoneNumber"
                    value={profileData.phoneNumber}
                    onChange={handleChange}
                    placeholder="Your phone number"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="bio">Short Bio (Optional)</label>
                  <textarea
                    id="bio"
                    name="bio"
                    value={profileData.bio}
                    onChange={handleChange}
                    placeholder="Tell others about yourself"
                    rows="4"
                  />
                </div>
                
                <div className="form-actions">
                  <button 
                    type="button" 
                    className="cancel-button"
                    onClick={() => setIsEditMode(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="save-profile-button"
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
      
      {showToast && (
        <ToastNotification
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
}

export default App;
