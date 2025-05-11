import axios from 'axios';
import { logApiRequest, logApiResponse, logApiError } from './debug';

// In development, use a relative URL to leverage Vite's proxy
// In production, this would be the actual API URL
// The backend has redirect_slashes=False, but we need to be consistent with URL formats
const API_URL = import.meta.env.DEV ? '/api' : 'https://beatgen-api.onrender.com';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Prevent Axios from following redirects - we'll handle them ourselves
  maxRedirects: 0
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token && config.headers) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Log the request details in development
  if (config.method && config.url) {
    logApiRequest(
      config.method.toUpperCase(),
      config.url,
      config.data,
      config.headers
    );
  }
  
  return config;
});

// Handle API responses and errors
apiClient.interceptors.response.use(
  (response) => {
    // Log successful response
    if (response.config.method && response.config.url) {
      logApiResponse(
        response.config.method.toUpperCase(),
        response.config.url,
        response.status,
        response.data
      );
    }
    return response;
  },
  async (error) => {
    // Handle authentication errors (401)
    if (error.response?.status === 401) {
      console.warn('Authentication error (401) from API:', error.config.url);
      
      // Don't redirect if we're already on login-related pages
      const currentPath = window.location.pathname;
      if (currentPath === '/login' || currentPath === '/register') {
        console.log('Already on authentication page, not redirecting');
        return Promise.reject(error);
      }
      
      // Check if we have a valid token but still getting 401
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.log('No token found, redirecting to login');
        window.location.href = '/login';
        return Promise.reject(error);
      }
      
      try {
        // Try to parse the token and check if it's expired
        const tokenData = JSON.parse(atob(token.split('.')[1]));
        const isExpired = tokenData.exp * 1000 < Date.now();
        
        if (isExpired) {
          console.log('Token is expired, clearing and redirecting');
          localStorage.removeItem('access_token');
          window.location.href = '/login';
        } else {
          console.log('Token appears valid but got 401 - API access issue');
          // Don't redirect on every request to prevent loops
          // This may be an issue with specific endpoints only
        }
      } catch (e) {
        console.error('Failed to parse token:', e);
        // Invalid token format - clear and redirect
        localStorage.removeItem('access_token');
        window.location.href = '/login';
      }
    }
    
    // Handle permission errors (403)
    if (error.response?.status === 403) {
      console.error('Permission denied:', error.response.data);
    }
    
    // Handle other errors with response data
    if (error.response?.data) {
      // If the backend provides an error message, use it
      const backendError = new Error(
        error.response.data.detail || 
        error.response.data.message || 
        `API Error (${error.response.status})`
      );
      return Promise.reject(backendError);
    }
    
    // Log the error for debugging
    if (error.config?.method && error.config?.url) {
      logApiError(
        error.config.method.toUpperCase(),
        error.config.url,
        error
      );
    }
    
    // Network errors, CORS issues, etc.
    return Promise.reject(error);
  }
);