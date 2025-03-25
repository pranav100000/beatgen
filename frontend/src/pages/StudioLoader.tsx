import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

const StudioLoader: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    // Create a div for Vite studio to mount to
    const rootDiv = document.createElement('div');
    rootDiv.id = 'studio-vite-root';
    rootDiv.style.width = '100%';
    rootDiv.style.height = '100vh';
    document.body.appendChild(rootDiv);

    // Load the Vite studio script
    console.log('Loading Vite studio script');
    const script = document.createElement('script');
    const scriptPath = '/studio-vite/assets/Studio.js'; // Note: Case sensitivity matters!
    console.log('Script path:', scriptPath);
    script.src = scriptPath;
    script.type = 'module';
    
    script.onload = () => {
      console.log('Script loaded successfully!');
      setScriptLoaded(true);
      
      // Try to mount the studio using the global function exposed by Vite
      setTimeout(() => {
        try {
          console.log('Window object keys:', Object.keys(window));
          console.log('Mount function exists:', typeof (window as any).mountStudioVite === 'function');
          
          if (typeof (window as any).mountStudioVite === 'function') {
            console.log('Calling mount function with target:', 'studio-vite-root');
            const result = (window as any).mountStudioVite('studio-vite-root');
            console.log('Mount result:', result);
            setLoading(false);
          } else {
            console.error('Mount function not found on window object');
            setError('Studio component loaded but mount function not found');
          }
        } catch (e) {
          console.error('Error during mount:', e);
          setError(`Error mounting studio: ${e.message}`);
        }
      }, 300); // Longer delay to ensure everything is initialized
    };
    
    script.onerror = () => setError('Failed to load studio component');
    
    document.body.appendChild(script);

    // Clean up when component unmounts
    return () => {
      if (document.body.contains(script)) document.body.removeChild(script);
      if (document.body.contains(rootDiv)) document.body.removeChild(rootDiv);
      
      // Cleanup any Tone.js resources
      try {
        if (typeof (window as any).Tone !== 'undefined') {
          (window as any).Tone.Transport.stop();
          (window as any).Tone.context.close();
        }
      } catch (e) {
        console.error('Error cleaning up Tone.js:', e);
      }
    };
  }, []);

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        flexDirection: 'column',
        bgcolor: '#000'
      }}>
        <CircularProgress color="primary" />
        <Typography sx={{ mt: 2, color: 'white' }}>
          {scriptLoaded ? 'Initializing Studio...' : 'Loading Studio...'}
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        bgcolor: '#000',
        color: 'white',
        flexDirection: 'column'
      }}>
        <Typography color="error" variant="h6" align="center">
          {error}
        </Typography>
        <Typography sx={{ mt: 2 }}>
          Please refresh the page or try again later.
        </Typography>
      </Box>
    );
  }

  // Once loaded, Vite takes over rendering
  return null;
};

export default StudioLoader;