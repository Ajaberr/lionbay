import { useState, useContext, createContext, useEffect, useRef, Fragment as Fragment2 } from 'react';
import { BrowserRouter as Router, Route, Routes, Link, Navigate, useParams, useNavigate } from 'react-router-dom';
import './App.css';
import './Chat.css';
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

// API Base URL Configuration
const API_BASE_URL = 'https://lionbay-api.onrender.com/api';
const SOCKET_URL = 'https://lionbay-api.onrender.com';

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
    } catch (e) {
      // Ignore parsing errors
    }
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setCurrentUser(storedUser);
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
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
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
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
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
      isAdmin: userData.isAdmin || ['admin@lionbay.com', 'support@lionbay.com'].includes(userData.email)
    };
    
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
    return currentUser?.is_verified || false;
  };

  // Create axios instance with auth headers
  const authAxios = axios.create({
    baseURL: API_BASE_URL
  });
  
  authAxios.interceptors.request.use(
    (config) => {
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
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
    isVerified: isUserVerified(),
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
      // Use the full API URL instead of relative path
      const response = await fetch(`${API_BASE_URL}/cart/count`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Cart count received:", data);
      
      if (data && data.count !== undefined) {
        setCartCount(data.count);
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

// Create a messages context for unread message count
const MessagesContext = createContext();

export function useMessages() {
  return useContext(MessagesContext);
}

export function MessagesProvider({ children }) {
  const [hasUnread, setHasUnread] = useState(false);
  const { authAxios, isAuthenticated } = useAuth();
  
  const checkUnreadMessages = async () => {
    if (!isAuthenticated) return;
    
    try {
      const response = await authAxios.get('/chats/has-unread');
      
      if (response.data && response.data.hasUnread !== undefined) {
        setHasUnread(response.data.hasUnread);
      }
    } catch (error) {
      console.error('Error checking unread messages:', error);
    }
  };

  const markAllAsRead = async (chatId) => {
    if (!isAuthenticated) return;
    
    try {
      await authAxios.post(`/chats/${chatId}/mark-read`);
      setHasUnread(false);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };
  
  // New function to indicate new unread messages
  const setHasUnreadMessages = (value = true) => {
    setHasUnread(value);
  };
  
  useEffect(() => {
    if (isAuthenticated) {
      checkUnreadMessages();
      
      // Set up polling to check for unread messages
      const interval = setInterval(checkUnreadMessages, 15000); // Every 15 seconds
      
      return () => clearInterval(interval);
    } else {
      setHasUnread(false); // Reset when logged out
    }
  }, [isAuthenticated]);
  
  return (
    <MessagesContext.Provider value={{ hasUnread, markAllAsRead, setHasUnreadMessages }}>
      {children}
    </MessagesContext.Provider>
  );
}

function MessageCount() {
  const { hasUnread } = useMessages();
  
  // Return a dot indicator when there are unread messages
  return hasUnread ? '•' : '';
}

function CartCount() {
  const { cartCount } = useCart();
  
  return cartCount || 0;
}

export function HeadBar() {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, logout, currentUser, isVerified } = useAuth();
  const [profileData, setProfileData] = useState({
    fullName: '',
    profileImage: ''
  });
  
  const handleResize = () => {
    setWindowWidth(window.innerWidth);
  };
  
  // Fetch profile data when authenticated
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      const fetchProfileData = async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/users/profile`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data) {
              setProfileData({
                fullName: data.full_name || '',
                profileImage: data.profile_image || ''
              });
            }
          }
        } catch (error) {
          console.error('Error fetching profile data:', error);
        }
      };
      
      fetchProfileData();
    }
  }, [isAuthenticated, currentUser]);
  
  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  const toggleSidebar = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };
  
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
            <button className="sign-in-btn" onClick={logout}>logout</button>
            
            {/* Mobile menu toggle button */}
            {windowWidth <= 1160 && (
              <button className="mobile-menu-toggle" onClick={toggleSidebar} aria-label="Open menu">
                <i className="fas fa-bars menu-icon"></i>
              </button>
            )}
          </>
        ) : (
          <>
            <Link to="/cart" className="nav-link">Cart</Link>
            <Link to="/login" className="login-btn">login</Link>
            
            {/* Mobile menu toggle button */}
            {windowWidth <= 1160 && (
              <button className="mobile-menu-toggle" onClick={toggleSidebar} aria-label="Open menu">
                <i className="fas fa-bars menu-icon"></i>
              </button>
            )}
          </>
        )}
      </div>
      
      {/* Mobile Sidebar */}
      <MobileSidebar 
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        isAuthenticated={isAuthenticated}
        isVerified={isVerified}
        onLogout={logout}
      />
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
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/verify-email`, { email });
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
      const response = await axios.post(`${API_BASE_URL}/auth/verify-code`, {
        email,
        code: verificationCode
      });
      
      // Check if this is an admin email
      const isAdmin = ['admin@lionbay.com', 'support@lionbay.com'].includes(email);
      
      const userData = {
        userId: response.data.userId,
        email: email,
        isAdmin: isAdmin || response.data.isAdmin
      };
      
      console.log('User authenticated:', userData);
      
      verifyEmailLogin(response.data.token, userData);
      navigate('/home');
    } catch (error) {
      console.error('Verification error:', error.response?.data || error.message);
      setError('Invalid verification code. Please try again.');
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

              <div className="captcha-container">
                <div className="captcha-box">
                  <div className="captcha-info">
                    <i className="fas fa-shield-alt"></i>
                    <span>Human verification - Friendly CAPTCHA</span>
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="sign-in-button" disabled={loading}>
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
    </div>
  );
}

function MarketPage() {
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
        const response = await axios.get(`${API_BASE_URL}/products`);
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
  }, []);

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
                        <img src={product.image_path || "/api/placeholder/300/300"} alt={product.name} />
                      </div>
                      <div className="product-details">
                        <div className="product-title">{product.name}</div>
                        <div className="product-specs">
                          <div>{product.details}</div>
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
  const { updateUnreadCount } = useMessages();
  const { protectedAction, renderToast } = useProtectedInteraction();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        console.log(`Fetching product details for ID: ${id}`);
        const response = await axios.get(`${API_BASE_URL}/products/${id}`);
        setProduct(response.data);
        console.log("Product data received:", response.data);
      } catch (err) {
        console.error('Error fetching product details:', err);
        setError('Failed to load product details. Product may not exist.');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

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
      
      // Update unread message count
      if (updateUnreadCount) {
        updateUnreadCount();
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

  if (loading) return (
    <div className="product-detail-page">
      <div className="loading">Loading product details...</div>
    </div>
  );

  if (error || !product) return (
    <div className="product-detail-page">
      <div className="error">{error || 'Product not found'}</div>
    </div>
  );

  const isOwner = isAuthenticated && currentUser.userId === product.seller_id;

  return (
    <div className="product-detail-page">
      <div className="product-detail-container">
        <div className="product-detail-left">
          <img 
            src={product.image_path || "/api/placeholder/600/400"} 
            alt={product.name} 
            className="product-detail-image"
          />
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
            <h3>Details</h3>
            <p>{product.details}</p>
          </div>
          
          {isOwner ? (
            <div className="owner-message">
              <p>This is your listing</p>
            </div>
          ) : (
            <div className="product-actions">
              <button 
                onClick={() => protectedAction(handleContactSeller)} 
                className="contact-seller-button"
              >
              Contact Seller
            </button>
              <button 
                onClick={() => protectedAction(handleAddToCart)} 
                className="add-to-cart-button"
              >
                Add to Cart
              </button>
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
  const [previewImage, setPreviewImage] = useState('');
  const [uploadMethod, setUploadMethod] = useState('url'); // 'url' or 'file'
  
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'price' ? (value === '' ? '' : parseFloat(value)) : value
    });

    // Clear image error when user starts typing new URL
    if (name === 'image_path') {
      setImageError('');
      if (value) {
        setPreviewImage(value);
      } else {
        setPreviewImage('');
      }
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file type
      if (!file.type.startsWith('image/')) {
        setImageError('Please upload a valid image file (JPEG, PNG, or GIF)');
        return;
      }

      // Check file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB in bytes
      if (file.size > maxSize) {
        setImageError('Image size must be less than 5MB');
        return;
      }

      // Create an image object to check dimensions
      const img = new Image();
      img.onload = () => {
        // Check image dimensions
        const maxWidth = 2000;
        const maxHeight = 2000;
        if (img.width > maxWidth || img.height > maxHeight) {
          setImageError(`Image dimensions must be less than ${maxWidth}x${maxHeight} pixels`);
          return;
        }

        // If all checks pass, proceed with the upload
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64Image = event.target.result;
          setPreviewImage(base64Image);
          setFormData({
            ...formData,
            image_path: base64Image
          });
          setImageError('');
        };
        reader.readAsDataURL(file);
      };
      img.onerror = () => {
        setImageError('Failed to load image. Please try another file.');
      };
      img.src = URL.createObjectURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setImageError('');

    try {
      // Validate image URL if provided and using URL method
      if (uploadMethod === 'url' && formData.image_path) {
        const isValidImage = await validateImageUrl(formData.image_path);
        if (!isValidImage.valid) {
          setImageError(isValidImage.error);
          setIsSubmitting(false);
          return;
        }
      }

      const response = await authAxios.post('/products', formData);
      console.log('Product created successfully:', response.data);
      
      // Show success toast instead of alert
      setToastMessage('Product created successfully!');
      setToastType('success');
      setShowToast(true);
      
      // Navigate to the product detail page immediately
      navigate(`/market/${response.data.id}`);
      
    } catch (error) {
      console.error('Error creating product:', error);
      
      // Show error toast instead of alert
      setToastMessage('Failed to create product. Please try again.');
      setToastType('error');
      setShowToast(true);
    } finally {
      setIsSubmitting(false);
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
            />
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
            />
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
            />
          </div>
          
          <div className="form-group">
            <label>Product Image</label>
            
            <div className="upload-options">
              <button 
                type="button" 
                className={`upload-option-btn ${uploadMethod === 'url' ? 'active' : ''}`}
                onClick={() => setUploadMethod('url')}
              >
                Use URL
              </button>
              <button 
                type="button" 
                className={`upload-option-btn ${uploadMethod === 'file' ? 'active' : ''}`}
                onClick={() => setUploadMethod('file')}
              >
                Upload File
              </button>
            </div>
            
            {uploadMethod === 'url' ? (
              <input
                type="text"
                id="image_path"
                name="image_path"
                value={formData.image_path}
                onChange={handleChange}
                placeholder="Enter an image URL"
              />
            ) : (
              <div className="file-upload-container">
                <input
                  type="file"
                  id="image_file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="file-upload-input"
                />
                <label htmlFor="image_file" className="file-upload-label">
                  Choose a file
                </label>
              </div>
            )}
            
            {imageError && <div className="error-message">{imageError}</div>}
            
            {previewImage ? (
              <div className="image-preview">
                <img src={previewImage} alt="Product preview" />
              </div>
            ) : (
              <div className="image-preview empty">
                <span>No Image preview available</span>
              </div>
            )}
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
  const { authAxios, isAuthenticated, currentUser } = useAuth();
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    const fetchChats = async () => {
      try {
        console.log('Fetching chats for user');
        const response = await authAxios.get('/chats');
        console.log('Chats received:', response.data);
        setChats(response.data);
      } catch (err) {
        console.error('Error fetching chats:', err.response?.data || err.message);
        setToastMessage(err.response?.data?.error || 'Failed to load chats. Please try again.');
        setToastType('error');
        setShowToast(true);
      } finally {
        setLoading(false);
      }
    };

    fetchChats();
  }, [authAxios, isAuthenticated, navigate]);

  if (loading) return (
    <div className="chats-list-page">
      <div className="loading">Loading chats...</div>
    </div>
  );

  return (
    <div className="chats-list-page">
      <div className="chats-header">
      <h1>Messages</h1>
        <div className="role-legend">
          <div className="legend-item"><span className="role-dot seller"></span> You are selling</div>
          <div className="legend-item"><span className="role-dot buyer"></span> You are buying</div>
        </div>
        <div className="expiration-notice">
          <i className="fas fa-info-circle"></i>
          <span>Chats automatically expire after 7 days of inactivity</span>
        </div>
      </div>
      
      {chats.length === 0 ? (
        <div className="no-chats">
          <p>You don't have any messages yet.</p>
          <Link to="/market" className="browse-button">Browse Products</Link>
        </div>
      ) : (
        <div className="chats-list">
          {chats.map(chat => {
            // Determine if the current user is the seller or buyer in this chat
            const isSeller = currentUser.userId === chat.seller_id;
            
            return (
              <Link to={`/chats/${chat.id}`} key={chat.id} className={`chat-item ${isSeller ? 'seller-chat' : 'buyer-chat'}`}>
              <div className="chat-item-image">
                <img 
                    src={chat.product_image || "/api/placeholder/150/150"} 
                    alt={chat.product_name || "Product"} 
                />
              </div>
              <div className="chat-item-details">
                  <div className="chat-role-indicator">
                    <span className={`role-badge ${isSeller ? 'seller' : 'buyer'}`}>
                      {isSeller ? 'SELLING' : 'BUYING'}
                    </span>
                  </div>
                  <h3 className="chat-item-title">{chat.product_name || "Unknown Product"}</h3>
                  <p className="chat-item-price">${parseFloat(chat.product_price || 0).toLocaleString()}</p>
                <p className="chat-contact">
                    {isSeller
                      ? `Buyer: ${chat.buyer_email}` 
                      : `Seller: ${chat.seller_email}`}
                </p>
                {chat.last_message && (
                  <p className="chat-last-message">
                    <span className="message-sender">
                      {chat.last_message_sender_id === currentUser.userId 
                        ? 'You: ' 
                        : chat.last_message_sender_id === chat.seller_id 
                          ? 'Seller: ' 
                          : 'Buyer: '}
                    </span>
                    {chat.last_message.length > 40 
                      ? chat.last_message.substring(0, 40) + '...' 
                      : chat.last_message}
                  </p>
                )}
              </div>
            </Link>
            );
          })}
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
  const { markAllAsRead } = useMessages();
  const navigate = useNavigate();
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');

  // For debugging
  useEffect(() => {
    console.log("Current user:", currentUser);
  }, [currentUser]);

  // Add a separate effect just for marking messages as read
  useEffect(() => {
    if (isAuthenticated && id) {
      // Mark messages as read when the chat is opened
      markAllAsRead(id);
    }
  }, [isAuthenticated, id, markAllAsRead]);

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
    if (!socket) return;

    console.log('Setting up message listeners');

    // Listen for new messages from other users
    socket.on('new_message', (message) => {
      console.log('Received new message via socket:', message);
      
      // Only add messages from others, not from ourselves (to prevent duplicates)
      if (message.sender_id !== currentUser.userId) {
        setMessages(prevMessages => {
          // Avoid duplicate messages
          if (prevMessages.some(m => m.id === message.id)) {
            return prevMessages;
          }
          // Use a safe immutable update
          return [...prevMessages, message];
        });
      }
    });
    
    // Cleanup on unmount
    return () => {
      console.log('Removing socket listeners');
      socket.off('new_message');
    };
  }, [socket, currentUser]);

  // Fetch chat and message data
  useEffect(() => {
    const fetchChatAndMessages = async () => {
      try {
        console.log(`Fetching chat data for ID: ${id}`);
        const chatResponse = await authAxios.get(`/chats/${id}`);
        setChat(chatResponse.data);
        console.log('Chat data received:', chatResponse.data);
        
        const messagesResponse = await authAxios.get(`/chats/${id}/messages`);
        console.log('Messages received:', messagesResponse.data.length);
        setMessages(messagesResponse.data);
        
        // Initial scroll to bottom after loading messages
        setTimeout(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
          }
        }, 100);
      } catch (err) {
        console.error('Error fetching chat data:', err.response?.data || err.message);
        setToastMessage(err.response?.data?.error || 'Failed to load chat');
        setToastType('error');
        setShowToast(true);
        setTimeout(() => {
        navigate('/chats');
        }, 2000);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated && id) {
      fetchChatAndMessages();
    }
  }, [authAxios, id, isAuthenticated, navigate]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
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
      sender_id: currentUser.userId,
      message: messageText,
      created_at: new Date().toISOString(),
      sender_email: currentUser.email,
      temporary: true,
      is_read: false
    };
    
    // Add to state with immutable update pattern
    setMessages(prev => [...prev, optimisticMessage]);
    
    try {
      let finalMessageId = tempId;
      
      // Make sure we're using the correct API URL
      console.log('Sending via REST API');
      const response = await authAxios.post(`/chats/${id}/messages`, {
        message: messageText
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
    return message.sender_id === currentUser.userId;
  };

  // Add this function to determine message styling
  const getMessageClassName = (message) => {
    const baseClass = isMessageFromCurrentUser(message) 
      ? "message sent" 
      : "message received";
    
    return message.is_read === false && !isMessageFromCurrentUser(message)
      ? `${baseClass} unread` 
      : baseClass;
  };

  if (loading) return (
    <div className="chat-page">
      <div className="loading">Loading chat...</div>
    </div>
  );

  return (
    <div className="chat-page">
      <div className="chat-container">
        <div className="chat-header">
          <Link to="/chats" className="back-button">← Back to Messages</Link>
          <div className="chat-header-info">
            <h2>{chat?.product_name || "Unknown Product"}</h2>
            <p className="chat-header-price">${parseFloat(chat?.product_price || 0).toLocaleString()}</p>
            <p className="chat-header-users">
              {currentUser.userId === chat?.seller_id 
                ? `Chatting with buyer: ${chat?.buyer_email}` 
                : `Chatting with seller: ${chat?.seller_email}`}
            </p>
          </div>
          <div className="role-indicator">
            <span className={`role-badge ${currentUser.userId === chat?.seller_id ? 'seller' : 'buyer'}`}>
              {currentUser.userId === chat?.seller_id ? 'SELLING' : 'BUYING'}
                    </span>
          </div>
        </div>
        
        <div className="messages-container" ref={messagesEndRef}>
          {messages.length === 0 ? (
            <div className="no-messages">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id || `temp-${message.tempId}`}
                  className={getMessageClassName(message)}
                >
                  <div className="message-content">
                    <p>{message.message}</p>
                    <span className="message-time">
                      {formatMessageTime(message.created_at)}
                      {message.temporary && <span className="message-status">Sending...</span>}
                    </span>
                  </div>
                </div>
              ))}
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
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/" />;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));

  return (
    <Router>
      <AuthProvider>
        <CartProvider>
          <MessagesProvider>
            <PageTitle />
        <AppContent />
          </MessagesProvider>
        </CartProvider>
      </AuthProvider>
    </Router>
  );
}

function AppContent() {
  const { isAuthenticated, currentUser } = useAuth();
  const { setHasUnreadMessages } = useMessages();
  const [toast, setToast] = useState(null);
  const [globalSocket, setGlobalSocket] = useState(null);
  
  // Set up global socket connection for unread messages
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;
    
    console.log('Setting up global socket connection for unread messages');
    const token = localStorage.getItem('token');
    const newSocket = io(SOCKET_URL, {
      auth: { token }
    });
    
    newSocket.on('connect', () => {
      console.log('Socket connected for unread message notifications');
    });
    
    // Listen for unread messages
    newSocket.on('unread_message', (message) => {
      console.log('Received unread message notification');
      setHasUnreadMessages(true);
    });
    
    setGlobalSocket(newSocket);
    
    return () => {
      if (newSocket) newSocket.disconnect();
    };
  }, [isAuthenticated, currentUser, setHasUnreadMessages]);
  
  return (
    <>
      <HeadBar />
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
        {/* Profile route is commented out as it's coming soon */}
        {/* <Route path="/profile" element={
          <GrayscalePreview isAuthenticated={isAuthenticated}>
            <ProfilePage />
          </GrayscalePreview>
        } /> */}
        {/* Catch-all route for non-existent paths */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <SiteFooter />
      <HelpChatWidget />
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
        <p>&copy; {new Date().getFullYear()} Lion Bay. Better, faster, closer than those other guys.</p>
      </div>
    </footer>
  );
}


function CartPage() {
  const { authAxios, isAuthenticated, currentUser } = useAuth();
  const { updateCartCount } = useCart();
  const { updateUnreadCount } = useMessages();
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
      
      // Update unread message count
      if (updateUnreadCount) {
        updateUnreadCount();
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
                          src={item.product_image || "/api/placeholder/150/150"} 
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
                          src={item.product_image || "/api/placeholder/150/150"} 
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
                            Contact Seller
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
  const [previewImage, setPreviewImage] = useState('');
  const [uploadMethod, setUploadMethod] = useState('file');

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
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      // Use the existing products endpoint with the seller_id filter
      const response = await authAxios.get(`/products?seller_id=${currentUser.userId}`);
      console.log("Fetched user products:", response.data);
      
      // Ensure we have an array of products
      if (Array.isArray(response.data)) {
        setProducts(response.data);
      } else {
        console.error("Expected array of products, got:", response.data);
        setProducts([]);
      }
    } catch (error) {
      console.error("Error fetching user's products:", error);
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
    } else if (formData.name.length > 100) {
      errors.name = "Product name must be less than 100 characters";
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
      errors.price = "Price must be less than $1,000,000";
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
    } else if (formData.details.length > 2000) {
      errors.details = "Product details must be less than 2000 characters";
      hasError = true;
    }

    // Image validation
    if (!formData.image_path) {
      errors.images = "At least one product image is required";
      hasError = true;
    } else {
      // Validate image URLs if using URL method
      if (uploadMethod === 'url') {
        const invalidUrls = [formData.image_path].filter(url => url && !url.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i));
        if (invalidUrls.length > 0) {
          errors.images = "Please provide valid image URLs (jpg, jpeg, png, gif, or webp)";
          hasError = true;
        }
      }
    }

    // Set form errors
    setFormErrors(errors);
    return !hasError;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'price') {
      setFormData({
        ...formData,
        [name]: value === '' ? '' : parseFloat(value)
      });
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

  const handleImageUrlChange = (value) => {
    setFormData({
      ...formData,
      image_path: value
    });
    
    // Update preview for URL method
    if (uploadMethod === 'url') {
      setPreviewImage(value);
    }
    
    // Clear error when image is updated
    if (formErrors.images) {
      setFormErrors({
        ...formErrors,
        images: null
      });
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setFormErrors({
          ...formErrors,
          images: 'Please upload a valid image file'
        });
        return;
      }
      
      // Update file state
      setImageFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Image = event.target.result;
        
        // Update preview image
        setPreviewImage(base64Image);
        
        // Also update image path for form data
        setFormData({
          ...formData,
          image_path: base64Image
        });
      };
      reader.readAsDataURL(file);
      
      // Clear error when image is updated
      if (formErrors.images) {
        setFormErrors({
          ...formErrors,
          images: null
        });
      }
    }
  };

  const handleEditProduct = (product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      details: product.details,
      condition: product.condition,
      price: product.price,
      category: product.category,
      image_path: product.image_path,
      other_category: product.category === 'Other' ? product.custom_category || '' : ''
    });
    
    // Reset preview
    setPreviewImage(product.image_path);
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
    setPreviewImage('');
    setImageFile(null);
    setFormErrors({});
    setShowAddForm(true);
    setShowEditForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
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
      
      const productData = {
        name: formData.name,
        details: formData.details,
        condition: formData.condition,
        price: formData.price,
        category: finalCategory,
        image_path: formData.image_path
      };
      
      let response;
      
      if (selectedProduct) {
        // Update existing product
        response = await authAxios.put(`/products/${selectedProduct.id}`, productData);
        setToastMessage("Product updated successfully!");
      } else {
        // Create new product
        response = await authAxios.post('/products', productData);
        setToastMessage("Product created successfully!");
      }
      
      setToastType('success');
      setShowToast(true);
      
      // Refresh product list
      await fetchUserProducts();
      
      // Close forms
      setShowEditForm(false);
      setShowAddForm(false);
      
    } catch (error) {
      console.error("Error saving product:", error);
      setToastMessage(error.response?.data?.error || "Failed to save product. Please try again.");
      setToastType('error');
      setShowToast(true);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (window.confirm("Are you sure you want to delete this product? This action cannot be undone.")) {
      try {
        await authAxios.delete(`/products/${productId}`);
        setToastMessage("Product deleted successfully!");
        setToastType('success');
        setShowToast(true);
        
        // Refresh product list
        await fetchUserProducts();
      } catch (error) {
        console.error("Error deleting product:", error);
        setToastMessage("Failed to delete product. Please try again.");
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
                />
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
                />
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
                />
                {formErrors.details && <div className="form-error">{formErrors.details}</div>}
              </div>
              
              <div className="form-group">
                <label>Product Image*</label>
                
                <div className="upload-options">
                  <button 
                    type="button" 
                    className={`upload-option-btn ${uploadMethod === 'url' ? 'active' : ''}`}
                    onClick={() => setUploadMethod('url')}
                  >
                    Use URL
                  </button>
                  <button 
                    type="button" 
                    className={`upload-option-btn ${uploadMethod === 'file' ? 'active' : ''}`}
                    onClick={() => setUploadMethod('file')}
                  >
                    Upload File
                  </button>
                </div>
                
                <div className="product-image-container">
                  {uploadMethod === 'url' ? (
                    <input
                      type="text"
                      placeholder="Image URL"
                      value={formData.image_path || ''}
                      onChange={(e) => handleImageUrlChange(e.target.value)}
                      className={formErrors.images ? 'error-border' : ''}
                    />
                  ) : (
                    <div className="file-upload-container">
                      <input
                        type="file"
                        id="image_file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="file-upload-input"
                      />
                      <label htmlFor="image_file" className={`file-upload-label ${formErrors.images ? 'error-border' : ''}`}>
                        {imageFile ? imageFile.name : 'Choose image'}
                      </label>
                    </div>
                  )}
                  
                  {previewImage ? (
                    <div className="image-preview">
                      <img src={previewImage} alt="Product preview" />
                    </div>
                  ) : (
                    <div className="image-preview empty">
                      <span>No preview</span>
                    </div>
                  )}
                </div>
                
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
                      src={product.image_path || "/api/placeholder/150/150"} 
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
                      onClick={() => handleDeleteProduct(product.id)}
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
  const { currentUser } = useAuth();
  const [profileData, setProfileData] = useState({
    fullName: '',
    profileImage: ''
  });
  
  // Fetch profile data when sidebar opens
  useEffect(() => {
    if (isOpen && isAuthenticated && currentUser) {
      const fetchProfileData = async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/users/profile`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data) {
              setProfileData({
                fullName: data.full_name || '',
                profileImage: data.profile_image || ''
              });
            }
          }
        } catch (error) {
          console.error('Error fetching profile data:', error);
        }
      };
      
      fetchProfileData();
    }
  }, [isOpen, isAuthenticated, currentUser]);
  
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
                DMs {<span className="message-badge">{<MessageCount />}</span>}
              </Link>
              
              <button className="logout-button" onClick={() => {
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
