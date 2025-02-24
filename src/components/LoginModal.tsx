import { 
  Modal, 
  Box, 
  Typography, 
  TextField, 
  Button,
  IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

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

        <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            required
            label="Email"
            type="email"
            fullWidth
            variant="outlined"
          />
          
          <TextField
            required
            label="Password"
            type="password"
            fullWidth
            variant="outlined"
          />

          <Button 
            variant="contained" 
            type="submit"
            sx={{ 
              mt: 2,
              bgcolor: '#1a237e',
              '&:hover': {
                bgcolor: '#000051'
              }
            }}
          >
            Log In
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
        </Box>
      </Box>
    </Modal>
  );
} 