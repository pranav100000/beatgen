import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  signIn as apiSignIn, 
  signUp as apiSignUp, 
  getUserProfile, 
  LoginResponse,
  UserProfile
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

  // Check for existing token on load
  useEffect(() => {
    const loadUser = async () => {
      try {
        console.log('Checking for authentication token...');
        const token = localStorage.getItem('access_token');
        
        if (token) {
          console.log('Token found, validating...');
          const decodedToken = parseJwt(token);
          console.log('Decoded token:', decodedToken ? 'Valid JSON' : 'Invalid token format');
          
          if (decodedToken && decodedToken.exp * 1000 > Date.now()) {
            // Token is valid
            console.log('Token is valid and not expired');
            setUser({
              id: decodedToken.sub || 'unknown',
              email: decodedToken.email || decodedToken.sub || '', // Email might not be in the token
            });
            
            // Load user profile
            try {
              console.log('Loading user profile...');
              const userProfile = await getUserProfile();
              console.log('Profile loaded successfully:', userProfile);
              setProfile(userProfile);
            } catch (error) {
              console.error('Failed to load user profile:', error);
              // Don't remove token just because profile fetch failed
            }
          } else {
            // Token expired or invalid
            console.warn('Token is expired or invalid, removing');
            localStorage.removeItem('access_token');
          }
        } else {
          console.log('No authentication token found');
        }
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        console.log('Auth initialization complete');
        setLoading(false);
      }
    };

    loadUser();
  }, []);

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

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
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