/**
 * Application Configuration
 * 
 * This file provides configuration constants used throughout the application
 * with automatic environment-aware settings.
 */

// Determine if we're in production
const isProduction = import.meta.env.PROD;

// Base API URL - using Render backend URL for both environments
export const API_BASE_URL = 'https://lionbay-api.onrender.com';

// Socket.IO URL - using Render backend URL for both environments
export const SOCKET_URL = 'https://lionbay-api.onrender.com';

// Debug mode toggle
export const DEBUG_MODE = !isProduction;

// Other configuration constants
export const APP_NAME = 'Lion Bay';
export const COLUMBIA_EMAIL_DOMAIN = 'columbia.edu';

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