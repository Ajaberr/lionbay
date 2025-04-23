/**
 * API Service Example
 * 
 * This file demonstrates the correct way to make API calls that 
 * will work in both development and production environments.
 * 
 * Usage:
 * import { fetchProducts, fetchProductById } from './api-example';
 */

import { buildApiUrl, logger } from './config';

// Common headers for JSON API requests
const defaultHeaders = {
  'Content-Type': 'application/json',
};

// Function to add authentication token if available
const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

/**
 * Base fetch function with error handling
 */
async function fetchApi(endpoint, options = {}) {
  try {
    const url = buildApiUrl(endpoint);
    logger.debug(`API Request: ${options.method || 'GET'} ${url}`);
    
    // Merge headers
    const headers = {
      ...defaultHeaders,
      ...getAuthHeaders(),
      ...options.headers,
    };
    
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Include cookies for auth
    });
    
    // Handle non-2xx responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.error || `API Error: ${response.status}`);
      error.status = response.status;
      error.data = errorData;
      throw error;
    }
    
    // Check if response is empty
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    return await response.text();
  } catch (error) {
    logger.error('API Request failed:', error);
    throw error;
  }
}

/**
 * Example API functions
 */

// Fetch all products
export async function fetchProducts(filters = {}) {
  // Convert filters object to URL query parameters
  const queryParams = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) queryParams.append(key, value);
  });
  
  const queryString = queryParams.toString();
  const endpoint = `products${queryString ? `?${queryString}` : ''}`;
  
  return fetchApi(endpoint);
}

// Fetch product by ID
export async function fetchProductById(id) {
  if (!id) throw new Error('Product ID is required');
  return fetchApi(`products/${id}`);
}

// Add product to cart
export async function addToCart(productData) {
  return fetchApi('cart', {
    method: 'POST',
    body: JSON.stringify(productData),
  });
}

// Fetch user's cart items
export async function fetchCart() {
  return fetchApi('cart');
}

// Example of using the socket.io connection
export function setupSocketConnection(socket, token) {
  // Connect with auth
  socket.auth = { token };
  socket.connect();
  
  // Setup event handlers
  socket.on('connect', () => {
    logger.log('Socket connected');
  });
  
  socket.on('disconnect', (reason) => {
    logger.warn('Socket disconnected:', reason);
  });
  
  socket.on('error', (error) => {
    logger.error('Socket error:', error);
  });
  
  return {
    // Join a chat room
    joinChat: (chatId) => {
      socket.emit('join_chat', chatId);
    },
    
    // Send a message
    sendMessage: (chatId, message) => {
      socket.emit('send_message', { chat_id: chatId, message });
    },
    
    // Disconnect socket
    disconnect: () => {
      socket.disconnect();
    }
  };
}

// Export a default object with all functions
export default {
  fetchProducts,
  fetchProductById,
  addToCart,
  fetchCart,
  setupSocketConnection,
}; 