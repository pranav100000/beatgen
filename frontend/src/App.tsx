import './App.css';
import { Button } from '@mui/material';
import { MusicNote, Edit } from '@mui/icons-material';
import LoginModal from './components/LoginModal';
import SignupModal from './components/SignupModal';
import PasswordResetModal from './components/PasswordResetModal';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from './core/auth/auth-context';

function App() {
  const navigate = useNavigate();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const { user, signOut } = useAuth();

  return (
    <div className="App">
      <nav className="nav-header">
        <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          beatgen
        </div>
        <div className="nav-links">
          {user ? (
            <>
              <Button 
                variant="text" 
                onClick={() => navigate('/projects')}
                sx={{ color: '#1a237e', marginLeft: 2 }}
              >
                MY PROJECTS
              </Button>
              <Button 
                variant="text" 
                onClick={() => navigate('/account')}
                sx={{ color: '#1a237e', marginLeft: 2 }}
              >
                MY ACCOUNT
              </Button>
              <Button 
                variant="outlined" 
                onClick={async () => {
                  await signOut();
                  navigate('/');
                }}
                sx={{ 
                  color: '#1a237e', 
                  borderColor: '#1a237e',
                  marginLeft: 2,
                  '&:hover': {
                    borderColor: '#1a237e',
                    backgroundColor: 'rgba(26, 35, 126, 0.04)'
                  }
                }}
              >
                LOGOUT
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="text" 
                href="/saved"
                sx={{ color: '#1a237e', marginLeft: 2 }}
              >
                FEATURES
              </Button>
              <Button 
                variant="text" 
                onClick={() => setIsLoginModalOpen(true)}
                sx={{ color: '#1a237e', marginLeft: 2 }}
              >
                LOGIN
              </Button>
              <Button 
                variant="outlined" 
                onClick={() => setIsSignupModalOpen(true)}
                sx={{ 
                  color: '#1a237e', 
                  borderColor: '#1a237e',
                  marginLeft: 2,
                  '&:hover': {
                    borderColor: '#1a237e',
                    backgroundColor: 'rgba(26, 35, 126, 0.04)'
                  }
                }}
              >
                SIGN UP
              </Button>
            </>
          )}
        </div>
      </nav>
      
      <main className="main-content">
        <h1>How would you like to create today?</h1>
        <div className="action-links">
          <Button
            variant="outlined"
            startIcon={<MusicNote />}
            onClick={() => navigate('/studio')}
            sx={{
              color: '#1a237e',
              borderColor: '#1a237e',
              padding: '10px 30px',
              marginBottom: 2,
              textTransform: 'none',
              '&:hover': {
                borderColor: '#1a237e',
                backgroundColor: 'rgba(26, 35, 126, 0.04)'
              }
            }}
          >
            Begin with a template
          </Button>
          <Button
            variant="outlined"
            startIcon={<Edit />}
            href="/customize"
            sx={{
              color: '#1a237e',
              borderColor: '#1a237e',
              padding: '10px 30px',
              textTransform: 'none',
              '&:hover': {
                borderColor: '#1a237e',
                backgroundColor: 'rgba(26, 35, 126, 0.04)'
              }
            }}
          >
            Customize your beats
          </Button>
        </div>
      </main>

      <LoginModal 
        open={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSignupClick={() => {
          setIsLoginModalOpen(false);
          setIsSignupModalOpen(true);
        }}
      />

      <SignupModal
        open={isSignupModalOpen}
        onClose={() => setIsSignupModalOpen(false)}
        onLoginClick={() => {
          setIsSignupModalOpen(false);
          setIsLoginModalOpen(true);
        }}
      />

      <PasswordResetModal
        open={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onLoginClick={() => {
          setIsResetModalOpen(false);
          setIsLoginModalOpen(true);
        }}
      />
    </div>
  );
}

export default App;
