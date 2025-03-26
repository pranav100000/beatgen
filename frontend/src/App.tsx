import React from 'react';
import { Box } from '@mui/material';
import './index.css';

// Import the Studio component
import Studio from './studio/Studio';

function App() {
  return (
    <Box sx={{ 
      position: 'relative', 
      width: '100%', 
      height: '100vh', 
      bgcolor: '#000000'
    }}>
      <Studio />
    </Box>
  );
}

export default App;