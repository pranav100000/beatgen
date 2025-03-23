import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  signIn as apiSignIn, 
  signUp as apiSignUp, 
  getUserProfile, 
  LoginResponse,
  UserProfile
} from '../../api/auth';

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
        const token = localStorage.getItem('access_token');
        if (token) {
          const decodedToken = parseJwt(token);
          
          if (decodedToken && decodedToken.exp * 1000 > Date.now()) {
            // Token is valid
            setUser({
              id: decodedToken.sub,
              email: decodedToken.email || '', // Email might not be in the token
            });
            
            // Load user profile
            try {
              const userProfile = await getUserProfile();
              setProfile(userProfile);
            } catch (error) {
              console.error('Failed to load user profile:', error);
            }
          } else {
            // Token expired
            localStorage.removeItem('access_token');
          }
        }
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const handleAuthResponse = (response: LoginResponse): User | null => {
    if (response.access_token) {
      localStorage.setItem('access_token', response.access_token);
      
      const decodedToken = parseJwt(response.access_token);
      if (decodedToken) {
        return {
          id: decodedToken.sub,
          email: decodedToken.email || '',
        };
      }
    }
    return null;
  };

  const signUp = async (email: string, password: string) => {
    try {
      const response = await apiSignUp(email, password);
      
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
        return { error: null, success: true };
      }
      
      return { error: new Error('Failed to create user'), success: false };
    } catch (error: any) {
      return { 
        error: error, 
        success: false,
        message: error.response?.data?.detail || 'An error occurred during signup'
      };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const response = await apiSignIn(email, password);
      const user = handleAuthResponse(response);
      if (user) {
        setUser(user);
        
        // Load user profile
        try {
          const userProfile = await getUserProfile();
          setProfile(userProfile);
        } catch (profileError) {
          console.error('Failed to load user profile:', profileError);
        }
        
        return { error: null, success: true };
      }
      return { error: new Error('Login failed'), success: false };
    } catch (error) {
      return { error: error as Error, success: false };
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