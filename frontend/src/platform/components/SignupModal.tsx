import { 
  Modal, 
  Box, 
  Typography, 
  TextField, 
  Button,
  IconButton,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import GoogleIcon from '@mui/icons-material/Google';
import { useState } from 'react';
import { useAuth } from '../auth/auth-context';

const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  borderRadius: 2,
  boxShadow: 24,
  p: 4,
};

interface SignupModalProps {
  open: boolean;
  onClose: () => void;
  onLoginClick?: () => void;
}

export default function SignupModal({ open, onClose, onLoginClick }: SignupModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('Registration successful! Please check your email to confirm your account.');
  
  const { signUp, signInWithGoogle } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(false);
    setSuccessMessage('Registration successful! Please check your email to confirm your account.');
    
    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }
    
    try {
      const { error, success, message } = await signUp(email, password);
      
      if (success) {
        // If we got a custom message from the backend (e.g., about email verification)
        if (message) {
          setSuccessMessage(message);
        }
        setSuccess(true);
      } else if (error) {
        // Use the message from the error if available
        setError(message || error.message || 'Failed to create account');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      await signInWithGoogle();
      // Will redirect to Google
    } catch (err) {
      setError('Failed to connect to Google');
      console.error(err);
      setIsGoogleLoading(false);
    }
  };
  
  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="signup-modal-title"
    >
      <Box sx={style}>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: 'grey.500',
          }}
        >
          <CloseIcon />
        </IconButton>

        <Typography id="signup-modal-title" variant="h6" component="h2" sx={{ mb: 3 }}>
          Create Your Account
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {successMessage}
          </Alert>
        )}
        
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            required
            label="Email"
            type="email"
            fullWidth
            variant="outlined"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading || success}
          />
          
          <TextField
            required
            label="Password"
            type="password"
            fullWidth
            variant="outlined"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading || success}
          />
          
          <TextField
            required
            label="Confirm Password"
            type="password"
            fullWidth
            variant="outlined"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isLoading || success}
          />

          <Button 
            variant="contained" 
            type="submit"
            disabled={isLoading || isGoogleLoading || success}
            sx={{ 
              mt: 2,
              bgcolor: '#1a237e',
              '&:hover': {
                bgcolor: '#000051'
              }
            }}
          >
            {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Sign Up'}
          </Button>
          
          <Divider sx={{ my: 2 }}>or</Divider>
          
          <Button 
            variant="outlined" 
            startIcon={<GoogleIcon />}
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isLoading || success}
            fullWidth
            data-oauth-provider="google"
            sx={{ 
              mt: 1,
              borderColor: '#1a237e',
              color: '#1a237e',
              '&:hover': {
                borderColor: '#000051',
                bgcolor: 'rgba(26, 35, 126, 0.04)'
              }
            }}
          >
            {isGoogleLoading ? <CircularProgress size={24} color="inherit" /> : 'Continue with Google'}
          </Button>

          <Typography variant="body2" sx={{ mt: 2, textAlign: 'center' }}>
            Already have an account?{' '}
            <Button 
              variant="text" 
              sx={{ 
                p: 0, 
                textTransform: 'none',
                color: '#1a237e'
              }}
              onClick={() => {
                onClose();
                if (onLoginClick) {
                  onLoginClick();
                }
              }}
            >
              Log in
            </Button>
          </Typography>
        </Box>
      </Box>
    </Modal>
  );
}