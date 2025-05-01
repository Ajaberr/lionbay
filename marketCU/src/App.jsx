import { useState, useContext, createContext, useEffect, useRef, Fragment as Fragment2 } from 'react';
import { BrowserRouter as Router, Route, Routes, Link, Navigate, useParams, useNavigate } from 'react-router-dom';
import './styles/App.css';
import './App.css';
import './styles/ProductDetail.css';
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
      console.log("Loading stored user data:", storedUser);
      
      // Make sure userId is defined
      if (storedUser && !storedUser.userId && storedUser.id) {
        console.log("Converting id to userId for consistency");
        storedUser.userId = storedUser.id;
      }
      
      // Check for required fields
      if (storedUser && !storedUser.userId) {
        console.warn("Stored user data missing userId:", storedUser);
      }
    } catch (e) {
      console.error("Error parsing stored user data:", e);
      // Ignore parsing errors
    }
    
    if (storedToken && storedUser) {
      console.log("Using stored authentication data, token exists and user:", storedUser?.userId);
      setToken(storedToken);
      setCurrentUser(storedUser);
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
      if (user && !user.userId && user.id) {
        user.userId = user.id;
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
      if (user && !user.userId && user.id) {
        user.userId = user.id;
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
      isAdmin: userData.isAdmin || ['admin@lionbay.com', 'support@lionbay.com'].includes(userData.email)
    };
    
    // Ensure userId is set (use id if userId is not available)
    if (userWithAdminFlag && !userWithAdminFlag.userId && userWithAdminFlag.id) {
      userWithAdminFlag.userId = userWithAdminFlag.id;
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

function MessageCount() {
  // The useMessages hook has been removed, so we'll use a static badge instead
  // Return a static dot indicator for notifications
  return '•';
}

function CartCount() {
  const { cartCount } = useCart();
  
  return cartCount || 0;
}

export function HeadBar() {
  const { isAuthenticated, currentUser, logout, authAxios } = useAuth();
  const [profileData, setProfileData] = useState({ fullName: '', profileImage: '' });
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
  
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
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
            <Link to="/chats" className="nav-link">DMs <span className="message-badge">•</span></Link>
            {windowWidth > 1160 && (
            <button className="sign-in-btn" onClick={logout}>logout</button>
            )}
            
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
            {windowWidth > 1160 && (
            <Link to="/login" className="login-btn">login</Link>
            )}
            
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
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isAuthenticated={isAuthenticated}
        isVerified={isAuthenticated}
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
        isAdmin: isAdmin || response.data.user.isAdmin
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
  const { protectedAction, renderToast } = useProtectedInteraction();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      try {
        const response = await authAxios.get(`/products/${id}`);
        setProduct(response.data);
        // Set document title
        document.title = `${response.data.name} | Lion Bay`;
      } catch (error) {
        console.error('Error fetching product details:', error);
        setError('Failed to load product details');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id, authAxios]);

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

  // Check if current user is the owner of this product
  const isOwner = isAuthenticated && currentUser && currentUser.userId === product.seller_id;

  return (
    <div className="product-detail-page">
      <div className="product-detail-container">
        {isOwner && (
          <div className="owner-badge">
            <span>Your Listing</span>
          </div>
        )}
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

      // Removed image dimension check to allow phone photos

      // If checks pass, proceed with the upload
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
      reader.onerror = () => { // Add error handling for reader
        setImageError('Failed to read image file. Please try again.');
      };
      reader.readAsDataURL(file);
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
      // 1. Ignore messages sent by the current user coming back via socket
      if (currentUser?.userId && message.sender_id === currentUser.userId) {
        console.log('Ignoring self-sent message received via socket:', message.id);
        return; // Don't add our own messages coming back from the socket
      }
      
      // 2. Handle messages from other users
      console.log('Received new message via socket from other user:', message);

      // Add message from other user to state
        setMessages(prevMessages => {
        // Avoid duplicate messages by ID
          if (prevMessages.some(m => m.id === message.id)) {
          console.log('Duplicate message ignored:', message.id);
          return prevMessages; // Don't add if ID already exists
          }
          // Use a safe immutable update
        // Add the new message from the other user
        console.log('Adding new message from other user to state:', message.id);
          return [...prevMessages, message];
        });
    };
    
    socket.on('new_message', handleNewMessage);

    // Cleanup on unmount or when dependencies change
    return () => {
      console.log(`Removing socket listener for chat ${id}`);
      socket.off('new_message', handleNewMessage);
    };
  }, [socket, currentUser?.userId, id]); // Dependencies: socket, user ID, chat ID

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
        setTimeout(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
          }
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

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }); // Use auto for instant scroll
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    // Safety check: Ensure currentUser.userId is available
    if (!currentUser?.userId) {
      console.error("Cannot send message: currentUser userId is not available.");
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

  return (
    <div className="chat-page">
      <div className="chat-container">
        <div className="chat-header">
          <Link to="/chats" className="back-button">← Back to Messages</Link>
          <div className="chat-header-info">
            <h2>{chat?.product_name || "Unknown Product"}</h2>
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
                  // Call directly, function will use context's currentUser.userId
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
            <PageTitle />
        <AppContent />
        </CartProvider>
      </AuthProvider>
    </Router>
  );
}

function AppContent() {
  const { isAuthenticated, currentUser } = useAuth();
  const [toast, setToast] = useState(null);
  const [globalSocket, setGlobalSocket] = useState(null);
  
  // Set up global socket connection for unread messages
  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      console.log('Skipping socket connection: not authenticated or no user data');
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
    
    const newSocket = io(SOCKET_URL, {
      auth: { token }
    });
    
    newSocket.on('connect', () => {
      console.log('Global socket connected successfully for user:', currentUser.userId);
    });
    
    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
    
    // REMOVED: Listener for 'unread_message' as the feature is removed
    // newSocket.on('unread_message', (message) => {
    //   console.log('Received unread message notification');
    //   // setHasUnreadMessages(true); // This was causing the error
    // });
    //
    // You can add other global socket listeners here if needed in the future
    // e.g., newSocket.on('global_notification', (data) => { ... });
    
    setGlobalSocket(newSocket);
    
    return () => {
      if (newSocket) {
        console.log('Disconnecting socket for user:', currentUser.userId);
        newSocket.disconnect();
      }
    };
  }, [isAuthenticated, currentUser]); // Removed setHasUnreadMessages from dependency array
  
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

