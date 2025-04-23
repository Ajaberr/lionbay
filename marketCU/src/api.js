import { buildApiUrl } from './config';

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
    console.log(`API Request: ${options.method || 'GET'} ${url}`);
    
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
    console.error('API Request failed:', error);
    throw error;
  }
}

// Export the fetchApi function and other useful functions
export default fetchApi; 