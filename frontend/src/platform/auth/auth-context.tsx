import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  signIn as apiSignIn, 
  signUp as apiSignUp, 
  getUserProfile, 
  LoginResponse,
  UserProfile,
  signInWithGoogle
} from '../api/auth';

interface User {
  id: string;
  email: string;
}

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{
    error: Error | null;
    success: boolean;
    message?: string;
  }>;
  signIn: (email: string, password: string) => Promise<{
    error: Error | null;
    success: boolean;
    message?: string;
  }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to decode JWT token
function parseJwt(token: string) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing token on load or token in URL fragment
  useEffect(() => {
    const processToken = async (token: string) => {
      console.log('Processing token...');
      localStorage.setItem('access_token', token);
      const decodedToken = parseJwt(token);
      console.log('Decoded token:', decodedToken ? 'Valid JSON' : 'Invalid token format');

      if (decodedToken && decodedToken.exp * 1000 > Date.now()) {
        console.log('Token is valid and not expired');
        setUser({
          id: decodedToken.sub || 'unknown',
          email: decodedToken.email || decodedToken.sub || '',
        });
        try {
          console.log('Loading user profile...');
          const userProfile = await getUserProfile();
          console.log('Profile loaded successfully:', userProfile);
          setProfile(userProfile);
        } catch (error) {
          console.error('Failed to load user profile:', error);
          // Consider sign out or specific error handling if profile load fails after login
          localStorage.removeItem('access_token'); // Remove token if profile load fails?
          setUser(null);
          setProfile(null);
        }
      } else {
        console.warn('Token is expired or invalid, removing');
        localStorage.removeItem('access_token');
        setUser(null);
        setProfile(null);
      }
      setLoading(false); // Ensure loading is set to false after processing
    };

    const initializeAuth = async () => {
      setLoading(true); // Start loading
      try {
        // 1. Check URL Fragment for OAuth Token
        if (window.location.hash.includes('#access_token=')) {
          console.log('Access token found in URL fragment.');
          const hash = window.location.hash.substring(1); // Remove #
          const params = new URLSearchParams(hash);
          const accessToken = params.get('access_token');

          if (accessToken) {
            await processToken(accessToken);
            // Clean the URL fragment
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
            console.log('URL fragment cleaned.');
            return; // Exit early, token processed
          } else {
            console.warn('Found #access_token= but failed to parse token from fragment.');
            // Clean the URL fragment even if parsing failed
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        } else {
           console.log('No access token found in URL fragment.');
        }

        // 2. Check Local Storage (if no token in fragment)
        console.log('Checking for authentication token in local storage...');
        const token = localStorage.getItem('access_token');
        if (token) {
          console.log('Token found in local storage, validating...');
          await processToken(token); // Use the same processing logic
        } else {
          console.log('No authentication token found in local storage.');
          setLoading(false); // No token anywhere, stop loading
        }

      } catch (error) {
        console.error('Error during auth initialization:', error);
        localStorage.removeItem('access_token'); // Clear token on error
        setUser(null);
        setProfile(null);
        setLoading(false); // Stop loading on error
      }
    };

    initializeAuth();

    // // Original local storage saving logic (commented out as it's handled by the sign-in flow now)
    // if (typeof window !== 'undefined') {
    //   const saveRedirectPath = () => { ... };
    //   document.addEventListener('click', (e) => { ... });
    // }

  }, []); // Run only once on mount

  const handleAuthResponse = (response: LoginResponse): User | null => {
    console.log('Processing auth response:', response);
    
    if (response.access_token) {
      console.log('Access token received, storing in localStorage');
      localStorage.setItem('access_token', response.access_token);
      
      const decodedToken = parseJwt(response.access_token);
      console.log('Decoded token:', decodedToken);
      
      if (decodedToken) {
        // Create a user object from the token
        const user = {
          id: decodedToken.sub || 'unknown',
          email: decodedToken.email || decodedToken.sub || '',
        };
        console.log('User created from token:', user);
        return user;
      } else {
        console.warn('Failed to decode token');
      }
    } else {
      console.warn('No access token in response');
    }
    
    return null;
  };

  const signUp = async (email: string, password: string) => {
    try {
      console.log('Creating account with:', { email });
      
      const response = await apiSignUp(email, password);
      console.log('Signup response:', response);
      
      // Check if we have a message about email verification
      if (response.message) {
        return { 
          error: null, 
          success: true, 
          message: response.message 
        };
      }
      
      const user = handleAuthResponse(response);
      if (user) {
        setUser(user);
        
        // Load user profile after signup
        try {
          const userProfile = await getUserProfile();
          setProfile(userProfile);
          console.log('User profile created:', userProfile);
        } catch (profileError) {
          console.error('Failed to load new user profile:', profileError);
        }
        
        return { error: null, success: true };
      }
      
      return { 
        error: new Error('Failed to create user: Invalid response from server'), 
        success: false 
      };
    } catch (error: any) {
      console.error('Registration error:', error);
      
      // Provide detailed error information
      let errorMessage = 'Registration failed';
      let errorDetails = '';
      
      if (error.response) {
        // The server responded with an error
        const status = error.response.status;
        errorMessage = `Server error (${status})`;
        
        // Extract useful error details from the response
        if (error.response.data) {
          // Handle common registration errors
          if (status === 400 || status === 422) {
            // Validation errors
            const detail = error.response.data.detail;
            if (Array.isArray(detail)) {
              // Collect field errors
              errorDetails = detail.map(err => `${err.loc[1]}: ${err.msg}`).join(', ');
            } else {
              errorDetails = error.response.data.detail || error.response.data.message || '';
            }
            
            // Check for common cases
            if (errorDetails.toLowerCase().includes('email') && 
                errorDetails.toLowerCase().includes('exist')) {
              errorDetails = 'This email is already registered. Please use a different email or login.';
            }
          } else {
            errorDetails = error.response.data.detail || error.response.data.message || '';
          }
        }
      } else if (error.request) {
        // Request was made but no response received
        errorMessage = 'Network error: No response from server';
        errorDetails = 'Please check your connection and try again';
      } else {
        // Something went wrong in setting up the request
        errorMessage = error.message || 'Unknown error';
      }
      
      return { 
        error: error, 
        success: false,
        message: errorDetails || errorMessage
      };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Authenticating with:', { email });
      
      const response = await apiSignIn(email, password);
      console.log('Auth response:', response);
      
      const user = handleAuthResponse(response);
      if (user) {
        setUser(user);
        
        // Load user profile
        try {
          const userProfile = await getUserProfile();
          setProfile(userProfile);
          console.log('User profile loaded:', userProfile);
        } catch (profileError) {
          console.error('Failed to load user profile:', profileError);
        }
        
        return { error: null, success: true };
      }
      return { 
        error: new Error('Login failed: Invalid response from server'), 
        success: false 
      };
    } catch (error: any) {
      console.error('Authentication error:', error);
      
      // Provide detailed error information
      let errorMessage = 'Authentication failed';
      let errorDetails = '';
      
      if (error.response) {
        // Server responded with an error status code
        errorMessage = `Server error (${error.response.status})`;
        errorDetails = error.response.data?.detail || error.response.data?.message || '';
      } else if (error.request) {
        // Request was made but no response received (network error)
        errorMessage = 'Network error: No response from server';
        errorDetails = 'Please check your connection and try again';
      } else {
        // Something else went wrong
        errorMessage = error.message || 'Unknown error';
      }
      
      return { 
        error: new Error(`${errorMessage}${errorDetails ? ': ' + errorDetails : ''}`), 
        success: false,
        message: errorDetails || errorMessage
      };
    }
  };

  const signOut = async () => {
    localStorage.removeItem('access_token');
    setUser(null);
    setProfile(null);
  };

  const googleSignIn = async () => {
    try {
      await signInWithGoogle();
      // The redirect will happen, so we don't need to do anything else here
    } catch (error: any) {
      console.error('Google sign-in error:', error);
    }
  };

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signInWithGoogle: googleSignIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook for using auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}