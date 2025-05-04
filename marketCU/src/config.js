/**
 * Application Configuration
 * 
 * This file provides configuration constants used throughout the application
 * with automatic environment-aware settings.
 */

// Determine if we're in production
const isProduction = import.meta.env.PROD;

// Check if the current domain is lionbay.org
const isLionBayOrg = typeof window !== 'undefined' && 
  (window.location.hostname === 'lionbay.org' || 
   window.location.hostname === 'www.lionbay.org');

// Environment variables with fallbacks
const apiBasePrefix = isProduction
  ? (isLionBayOrg ? 'https://lionbay-api.onrender.com' : 'https://lionbay-api.onrender.com')
  : import.meta.env.VITE_API_BASE_URL || 'http://localhost:3003';

// Base API URL
export const API_BASE_URL = `${apiBasePrefix}/api`;

// Socket.IO URL
export const SOCKET_URL = apiBasePrefix;

// Debug mode toggle
export const DEBUG_MODE = !isProduction;

// Other configuration constants
export const APP_NAME = 'Lion Bay';
export const COLUMBIA_EMAIL_DOMAIN = 'columbia.edu';

// Print configuration in development
if (!isProduction) {
  console.log('Environment:', import.meta.env.MODE);
  console.log('API Base URL:', API_BASE_URL);
  console.log('Socket URL:', SOCKET_URL);
}

// Logging utility that respects debug mode
export const logger = {
  debug: (...args) => {
    if (DEBUG_MODE) {
      console.debug('[DEBUG]', ...args);
    }
  },
  log: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
};

// Helper function to build API URLs
export const buildApiUrl = (path) => {
  return `${API_BASE_URL}${path}`;
};

export default {
  API_BASE_URL,
  SOCKET_URL,
  DEBUG_MODE,
  APP_NAME,
  COLUMBIA_EMAIL_DOMAIN,
  logger,
  buildApiUrl,
}; 