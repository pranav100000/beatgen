import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography, Button } from '@mui/material';

/**
 * StudioLoader - Loads the Vite-based studio in an iframe to avoid React DOM conflicts
 * Using an iframe completely isolates the Vite app from the main React app's DOM
 */
const StudioLoader: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Determine if we're in development mode
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // The iframe source depends on whether we're in development or production
  const iframeSrc = isDevelopment
    ? 'http://localhost:5173/' // Vite dev server
    : '/studio-vite/index.html'; // Production build
  
  // Use an iframe to completely isolate the DOM trees
  useEffect(() => {
    console.log(`Loading studio in ${isDevelopment ? 'development' : 'production'} mode`);
    console.log(`Iframe source: ${iframeSrc}`);
    
    // Create timeout to detect loading issues
    const timeoutId = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError('Studio took too long to load. Please try again.');
      }
    }, 10000);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [loading, isDevelopment, iframeSrc]);
  
  // Handle iframe load event
  const handleIframeLoad = () => {
    setLoading(false);
  };
  
  // Handle iframe error
  const handleIframeError = () => {
    setLoading(false);
    if (isDevelopment) {
      setError(
        'Failed to load Studio from development server. ' +
        'Make sure you have started the Vite development server with "cd studio-vite && npm run dev"'
      );
    } else {
      setError('Failed to load Studio. Please try again.');
    }
  };
  
  if (error) {
    return (
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        bgcolor: '#000',
        color: 'white',
        flexDirection: 'column',
        p: 3
      }}>
        <Typography color="error" variant="h6" align="center">
          {error}
        </Typography>
        <Box sx={{ mt: 3 }}>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={() => window.location.reload()}
            sx={{ mr: 2 }}
          >
            Try Again
          </Button>
          
          {isDevelopment && (
            <Button 
              variant="outlined" 
              color="secondary"
              onClick={() => window.open('http://localhost:5173/', '_blank')}
              sx={{ ml: 2 }}
            >
              Open Vite Dev Server Directly
            </Button>
          )}
        </Box>
      </Box>
    );
  }
  
  return (
    <Box sx={{ 
      width: '100%', 
      height: '100vh', 
      position: 'relative',
      bgcolor: '#000'
    }}>
      {/* Loading overlay */}
      {loading && (
        <Box sx={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          flexDirection: 'column',
          bgcolor: '#000',
          zIndex: 10
        }}>
          <CircularProgress color="primary" />
          <Typography sx={{ mt: 2, color: 'white' }}>
            {isDevelopment 
              ? 'Connecting to Vite development server...' 
              : 'Loading Studio...'}
          </Typography>
          
          {isDevelopment && (
            <Typography variant="caption" sx={{ mt: 1, color: '#999', maxWidth: '400px', textAlign: 'center' }}>
              Make sure you have started the Vite development server with:<br />
              <code>cd studio-vite && npm run dev</code>
            </Typography>
          )}
        </Box>
      )}
      
      {/* The iframe completely isolates the Vite Studio from the main React app */}
      <iframe
        src={iframeSrc}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: loading ? 'none' : 'block'
        }}
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        title="BeatGen Studio"
        // Allow necessary permissions for iframe
        allow="midi; camera; microphone; clipboard-read; clipboard-write"
      />
    </Box>
  );
};

export default StudioLoader;