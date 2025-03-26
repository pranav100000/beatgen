/**
 * API Debugging Utilities
 * 
 * This file contains helper functions for API debugging in development
 */

// Enable API debugging
const DEBUG_API = import.meta.env.DEV;

/**
 * Log API requests with detailed information
 */
export const logApiRequest = (
  method: string, 
  url: string, 
  data?: any, 
  headers?: any
) => {
  if (!DEBUG_API) return;
  
  console.group(`🌐 API Request: ${method} ${url}`);
  
  if (headers) {
    console.log('Headers:', headers);
  }
  
  if (data) {
    console.log('Request Data:', data);
  }
  
  console.groupEnd();
};

/**
 * Log API responses with detailed information
 */
export const logApiResponse = (
  method: string, 
  url: string, 
  status: number, 
  data?: any
) => {
  if (!DEBUG_API) return;
  
  const isSuccess = status >= 200 && status < 300;
  
  console.group(
    `${isSuccess ? '✅' : '❌'} API Response: ${method} ${url} (${status})`
  );
  
  if (data) {
    console.log('Response Data:', data);
  }
  
  console.groupEnd();
};

/**
 * Log API errors with detailed debugging information
 */
export const logApiError = (
  method: string,
  url: string,
  error: any
) => {
  if (!DEBUG_API) return;
  
  console.group(`❌ API Error: ${method} ${url}`);
  
  if (error.response) {
    // The request was made and the server responded with an error status
    console.log('Status:', error.response.status);
    console.log('Headers:', error.response.headers);
    console.log('Data:', error.response.data);
  } else if (error.request) {
    // The request was made but no response was received
    console.log('Request was sent but no response received:');
    console.log(error.request);
  } else {
    // Something happened in setting up the request that triggered an error
    console.log('Error setting up request:', error.message);
  }
  
  if (error.config) {
    console.log('Request Config:', {
      url: error.config.url,
      method: error.config.method,
      headers: error.config.headers,
      data: error.config.data
    });
  }
  
  console.trace('Error trace:');
  console.groupEnd();
};