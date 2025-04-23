/**
 * Application Configuration
 * 
 * This file provides configuration constants used throughout the application
 * with automatic environment-aware settings.
 */

// Determine if we're in production
const isProduction = import.meta.env.PROD;

// Base API URL - in production this uses the same origin,
// in development it uses localhost:3002
export const API_BASE_URL = isProduction 
  ? '' // Empty string means use the same origin in production
  : 'http://localhost:3002';

// Socket.IO URL - follows the same pattern as API_BASE_URL
export const SOCKET_URL = isProduction
  ? '' // Empty string means use the same origin in production
  : 'http://localhost:3002';

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

// Function to build a complete API URL
export const buildApiUrl = (endpoint) => {
  // Ensure endpoint starts with a slash
  const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}/api${formattedEndpoint}`;
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