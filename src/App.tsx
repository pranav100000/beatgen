import './App.css';
import { Button } from '@mui/material';
import { MusicNote, Edit } from '@mui/icons-material';
import LoginModal from './components/LoginModal';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

function App() {
  const navigate = useNavigate();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  return (
    <div className="App">
      <nav className="nav-header">
        <div className="logo">beatgen</div>
        <div className="nav-links">
          <Button 
            variant="text" 
            href="/saved"
            sx={{ color: '#1a237e', marginLeft: 2 }}
          >
            SAVED
          </Button>
          <Button 
            variant="text" 
            onClick={() => setIsLoginModalOpen(true)}
            sx={{ color: '#1a237e', marginLeft: 2 }}
          >
            LOGIN
          </Button>
        </div>
      </nav>
      
      <main className="main-content">
        <h1>How would you like to create today?</h1>
        <div className="action-links">
          <Button
            variant="outlined"
            startIcon={<MusicNote />}
            onClick={() => navigate('/new-project')}
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
      />
    </div>
  );
}

export default App;
