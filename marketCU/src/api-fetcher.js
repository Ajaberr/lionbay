/**
 * API Fetcher - A simplified API client for MarketCU
 */

// Use environment variable if provided, otherwise fall back to localhost:3001
const API_HOST = import.meta.env.VITE_API_HOST || 'http://localhost:3001';

// Fix for API calls in local development with two separate servers
const isDevelopment = import.meta.env.DEV;
const API_BASE_URL = isDevelopment ? API_HOST : '';

/**
 * Fetch API with proper error handling
 * @param {string} endpoint - API endpoint without leading slash
 * @param {object} options - Fetch options
 */
export async function fetchAPI(endpoint, options = {}) {
  // Ensure endpoint starts with a slash
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}/api${path}`;
  
  console.log(`API Request: ${options.method || 'GET'} ${url}`);
  
  // Get auth token if available
  const token = localStorage.getItem('authToken');
  const authHeader = token ? { 'Authorization': `Bearer ${token}` } : {};
  
  // Merge headers
  const headers = {
    'Content-Type': 'application/json',
    ...authHeader,
    ...options.headers
  };
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    });
    
    if (!response.ok) {
      // Try to parse error as JSON
      const errorData = await response.json().catch(() => ({
        error: `HTTP error ${response.status}`
      }));
      
      throw new Error(errorData.error || `API Error: ${response.status}`);
    }
    
    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    return await response.text();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

/**
 * Common API methods
 */
export const API = {
  // Products
  getProducts: () => fetchAPI('products'),
  getProduct: (id) => fetchAPI(`products/${id}`),
  createProduct: (data) => fetchAPI('products', { 
    method: 'POST', 
    body: JSON.stringify(data) 
  }),
  
  // Cart
  getCart: () => fetchAPI('cart'),
  addToCart: (data) => fetchAPI('cart', { 
    method: 'POST', 
    body: JSON.stringify(data) 
  }),
  removeFromCart: (id) => fetchAPI(`cart/${id}`, { 
    method: 'DELETE' 
  }),
  
  // Authentication
  verifyEmail: (email) => fetchAPI('auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ email })
  }),
  verifyCode: (email, code) => fetchAPI('auth/verify-code', {
    method: 'POST',
    body: JSON.stringify({ email, code })
  }),
  
  // Chats
  getChats: () => fetchAPI('chats'),
  getChat: (id) => fetchAPI(`chats/${id}`),
  createChat: (data) => fetchAPI('chats', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getChatMessages: (chatId) => fetchAPI(`chats/${chatId}/messages`),
  sendMessage: (chatId, message) => fetchAPI(`chats/${chatId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message })
  }),
  
  // Helper to get socket URL
  getSocketURL: () => isDevelopment ? API_HOST : window.location.origin
};

export default API; 