import { 
  Box, 
  Typography, 
  Button, 
  Paper, 
  Container, 
  Divider,
  CircularProgress
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../core/auth/auth-context';
import { useState } from 'react';

export default function UserAccount() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    setIsLoading(true);
    await signOut();
    setIsLoading(false);
    navigate('/');
  };

  return (
    <Container maxWidth="md">
      <Paper 
        elevation={3} 
        sx={{ 
          padding: 4, 
          marginTop: 4,
          marginBottom: 4 
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">My Account</Typography>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={() => navigate('/')}
            sx={{ 
              bgcolor: '#1a237e',
              '&:hover': {
                bgcolor: '#000051'
              }
            }}
          >
            Back to Home
          </Button>
        </Box>
        
        <Divider sx={{ mb: 3 }} />
        
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Profile Information</Typography>
          <Typography><strong>Email:</strong> {user?.email}</Typography>
          <Typography><strong>Email Verified:</strong> {user?.email_confirmed_at ? 'Yes' : 'No'}</Typography>
          <Typography><strong>Last Sign In:</strong> {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'N/A'}</Typography>
        </Box>

        <Divider sx={{ mb: 3 }} />
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button 
            variant="outlined" 
            color="primary"
            disabled={isLoading}
            onClick={() => navigate('/account/edit')}
            sx={{ 
              color: '#1a237e',
              borderColor: '#1a237e',
              '&:hover': {
                borderColor: '#000051'
              }
            }}
          >
            Edit Profile
          </Button>
          
          <Button 
            variant="outlined" 
            color="error"
            disabled={isLoading}
            onClick={handleSignOut}
          >
            {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Sign Out'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}