import { createFileRoute, useNavigate } from '@tanstack/react-router'
import React, { useState } from 'react'
import { publicRoute } from '../platform/auth/auth-utils.tsx'
import { useAuth } from '../platform/auth/auth-context'
import Navbar from '../platform/components/Navbar'
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Card, 
  CardContent,
  Container,
  Snackbar,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material'
import GoogleIcon from '@mui/icons-material/Google'

// Login route - this will render at the path '/login'
export const Route = createFileRoute('/login')({
  component: LoginPage,
  // Redirect if already logged in
  ...publicRoute('/home'),
})

function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    // Clear any existing token to avoid issues
    localStorage.removeItem('access_token');
    
    try {
      console.log('Login attempt with email:', email);
      
      // Use the auth context to sign in
      const result = await signIn(email, password);
      console.log('Login result:', result);
      
      if (result.success) {
        console.log('Login successful, redirecting to home page');
        
        // Ensure we have time to set the token before navigating
        setTimeout(() => {
          // Force reload to ensure auth state is updated
          window.location.href = '/home';
        }, 100);
      } else {
        console.warn('Login failed:', result);
        
        // Handle specific login error cases
        if (result.message) {
          setError(result.message);
        } else if (result.error) {
          // Handle known error types
          if (result.error.message.includes('Network Error')) {
            setError('Cannot connect to the authentication server. Please check your internet connection or try again later.');
          } else {
            setError(result.error.message || 'Invalid email or password');
          }
        } else {
          setError('Authentication failed. Please check your credentials and try again.');
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      
      // Display user-friendly error message
      if (err instanceof Error) {
        if (err.message.includes('Network Error')) {
          setError('Cannot connect to the server. Please check your internet connection.');
        } else {
          setError(err.message);
        }
      } else {
        setError('An unexpected error occurred. Please try again later.');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError(null);
    
    try {
      // Save current location for redirect after Google auth
      localStorage.setItem('auth_redirect', '/home');
      
      // Redirect to Google OAuth
      await signInWithGoogle();
      // This will redirect the user to Google's login page
    } catch (err) {
      console.error('Google login error:', err);
      setError('Failed to connect to Google authentication service.');
      setIsGoogleLoading(false);
    }
  };
  
  return (
    <Container maxWidth="sm" sx={{ 
      height: '100%', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      bgcolor: '#000',
      color: 'white'
    }}>
      <Card sx={{ width: '100%', p: 2, bgcolor: '#111', color: 'white' }}>
        <CardContent>
          <Typography variant="h4" component="h1" gutterBottom textAlign="center">
            Log In to BeatGen
          </Typography>
          
          <Box component="form" onSubmit={handleLogin} sx={{ mt: 3 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{
                '& .MuiInputBase-input': { color: 'white' },
                '& .MuiInputLabel-root': { color: '#aaa' },
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: '#333' },
                  '&:hover fieldset': { borderColor: '#666' },
                }
              }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={{
                '& .MuiInputBase-input': { color: 'white' },
                '& .MuiInputLabel-root': { color: '#aaa' },
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: '#333' },
                  '&:hover fieldset': { borderColor: '#666' },
                }
              }}
            />
            
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={isLoading || isGoogleLoading}
              sx={{ mt: 3, mb: 2, position: 'relative' }}
            >
              {isLoading ? (
                <>
                  <CircularProgress
                    size={24}
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      marginTop: '-12px',
                      marginLeft: '-12px',
                    }}
                  />
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
            
            <Divider sx={{ my: 2 }}>or</Divider>
            
            <Button
              fullWidth
              variant="outlined"
              startIcon={<GoogleIcon />}
              onClick={handleGoogleLogin}
              disabled={isLoading || isGoogleLoading}
              data-oauth-provider="google"
              sx={{ 
                mb: 2, 
                position: 'relative',
                bgcolor: 'rgba(255, 255, 255, 0.08)',
                borderColor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.12)',
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                }
              }}
            >
              {isGoogleLoading ? (
                <>
                  <CircularProgress
                    size={24}
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      marginTop: '-12px',
                      marginLeft: '-12px',
                    }}
                  />
                  Connecting...
                </>
              ) : (
                'Continue with Google'
              )}
            </Button>
            
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Don't have an account?{' '}
                <Button
                  variant="text"
                  color="primary"
                  size="small"
                  onClick={() => navigate({ to: '/register' })}
                  sx={{ textTransform: 'none', p: 0, minWidth: 'auto', verticalAlign: 'baseline' }}
                >
                  Sign up
                </Button>
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
      
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError(null)}>
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Container>
  );
}