import { 
  Modal, 
  Box, 
  Typography, 
  TextField, 
  Button,
  IconButton,
  CircularProgress,
  Alert
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useState } from 'react';
import { useAuth } from '../core/auth/auth-context';

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

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onSignupClick?: () => void;
}

export default function LoginModal({ open, onClose, onSignupClick }: LoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      const { error, success } = await signIn(email, password);
      
      if (success) {
        onClose();
      } else if (error) {
        setError(error.message);
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="login-modal-title"
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

        <Typography id="login-modal-title" variant="h6" component="h2" sx={{ mb: 3 }}>
          Welcome Back
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            required
            label="Email"
            type="email"
            fullWidth
            variant="outlined"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
          />
          
          <TextField
            required
            label="Password"
            type="password"
            fullWidth
            variant="outlined"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
          />

          <Button 
            variant="contained" 
            type="submit"
            disabled={isLoading}
            sx={{ 
              mt: 2,
              bgcolor: '#1a237e',
              '&:hover': {
                bgcolor: '#000051'
              }
            }}
          >
            {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Log In'}
          </Button>

          <Typography variant="body2" sx={{ mt: 2, textAlign: 'center' }}>
            Don't have an account?{' '}
            <Button 
              variant="text" 
              sx={{ 
                p: 0, 
                textTransform: 'none',
                color: '#1a237e'
              }}
              onClick={() => {
                onClose();
                if (onSignupClick) {
                  onSignupClick();
                }
              }}
            >
              Sign up
            </Button>
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
            <Button 
              variant="text" 
              sx={{ 
                p: 0, 
                textTransform: 'none',
                color: '#1a237e'
              }}
              onClick={() => {
                onClose();
              }}
            >
              Forgot password?
            </Button>
          </Typography>
        </Box>
      </Box>
    </Modal>
  );
} 