import { createFileRoute, useNavigate } from '@tanstack/react-router'
import React, { useState } from 'react'
import { publicRoute } from '../platform/auth/auth-utils.tsx'
import { useAuth } from '../platform/auth/auth-context'
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
  Link,
  Divider
} from '@mui/material'
import GoogleIcon from '@mui/icons-material/Google'

// Registration route - this will render at the path '/register'
export const Route = createFileRoute('/register')({
  component: RegisterPage,
  // Redirect if already logged in
  ...publicRoute('/home'),
})

function RegisterPage() {
  const navigate = useNavigate();
  const { signUp, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Form validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Use the auth context to sign up
      const result = await signUp(email, password);
      
      if (result.success) {
        if (result.message) {
          // If we have a message, it's probably about email verification
          setSuccess(result.message);
          // Wait 3 seconds before redirecting to login
          setTimeout(() => {
            navigate({ to: '/login' });
          }, 3000);
        } else {
          // If no message, user was created and logged in
          navigate({ to: '/home' });
        }
      } else {
        // Handle specific registration error cases
        if (result.message) {
          setError(result.message);
        } else if (result.error) {
          // Handle known error types
          if (result.error.message.includes('Network Error')) {
            setError('Cannot connect to the authentication server. Please check your internet connection or try again later.');
          } else if (result.error.message.includes('already exists')) {
            setError('An account with this email already exists. Please use a different email or try logging in.');
          } else {
            setError(result.error.message || 'Failed to create account');
          }
        } else {
          setError('Registration failed. Please try again later.');
        }
      }
    } catch (err) {
      console.error('Registration error:', err);
      
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
  
  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true);
    setError(null);
    
    try {
      // Save current location for redirect after Google auth
      localStorage.setItem('auth_redirect', '/home');
      
      // Redirect to Google OAuth
      await signInWithGoogle();
      // This will redirect the user to Google's login page
    } catch (err) {
      console.error('Google signup error:', err);
      setError('Failed to connect to Google authentication service.');
      setIsGoogleLoading(false);
    }
  };
  
  return (
    <Container maxWidth="sm" sx={{ 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      bgcolor: '#000',
      color: 'white'
    }}>
      <Card sx={{ width: '100%', p: 2, bgcolor: '#111', color: 'white' }}>
        <CardContent>
          <Typography variant="h4" component="h1" gutterBottom textAlign="center">
            Create Your BeatGen Account
          </Typography>
          
          <Box component="form" onSubmit={handleRegister} sx={{ mt: 3 }}>
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
              autoComplete="new-password"
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
              helperText="Password must be at least 8 characters"
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label="Confirm Password"
              type="password"
              id="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
                  Creating Account...
                </>
              ) : (
                'Sign Up'
              )}
            </Button>
            
            <Divider sx={{ my: 2 }}>or</Divider>
            
            <Button
              fullWidth
              variant="outlined"
              startIcon={<GoogleIcon />}
              onClick={handleGoogleSignUp}
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
                Already have an account?{' '}
                <Button
                  variant="text"
                  color="primary"
                  size="small"
                  onClick={() => navigate({ to: '/login' })}
                  sx={{ textTransform: 'none', p: 0, minWidth: 'auto', verticalAlign: 'baseline' }}
                >
                  Log in
                </Button>
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
      
      {/* Error notification */}
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError(null)}>
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
      
      {/* Success notification */}
      <Snackbar open={!!success} autoHideDuration={6000} onClose={() => setSuccess(null)}>
        <Alert onClose={() => setSuccess(null)} severity="success" sx={{ width: '100%' }}>
          {success}
        </Alert>
      </Snackbar>
    </Container>
  );
}