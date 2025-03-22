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
import { requestPasswordReset } from '../api/auth';

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

interface PasswordResetModalProps {
  open: boolean;
  onClose: () => void;
  onLoginClick?: () => void;
}

export default function PasswordResetModal({ open, onClose, onLoginClick }: PasswordResetModalProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      await requestPasswordReset(email);
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'An unexpected error occurred');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="password-reset-modal-title"
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

        <Typography id="password-reset-modal-title" variant="h6" component="h2" sx={{ mb: 3 }}>
          Reset Your Password
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Password reset instructions have been sent to your email.
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

          <Button 
            variant="contained" 
            type="submit"
            disabled={isLoading || success}
            sx={{ 
              mt: 2,
              bgcolor: '#1a237e',
              '&:hover': {
                bgcolor: '#000051'
              }
            }}
          >
            {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Send Reset Instructions'}
          </Button>

          <Typography variant="body2" sx={{ mt: 2, textAlign: 'center' }}>
            Remembered your password?{' '}
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