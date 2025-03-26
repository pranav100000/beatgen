import React, { useEffect, useState } from 'react';
import { Button, Typography, Box, CircularProgress } from '@mui/material';
import { runMidiTest } from '../core/audio-engine/midiPlayerTest';

const MidiPlayerTestComponent: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logMessages, setLogMessages] = useState<string[]>([]);
  
  // Capture console logs
  useEffect(() => {
    // Store the original console methods
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    
    // Override console methods to capture logs
    console.log = (...args) => {
      // Call the original method
      originalConsoleLog(...args);
      
      // Add to our log messages
      setLogMessages(prev => [...prev, `LOG: ${args.join(' ')}`]);
    };
    
    console.error = (...args) => {
      // Call the original method
      originalConsoleError(...args);
      
      // Add to our log messages
      setLogMessages(prev => [...prev, `ERROR: ${args.join(' ')}`]);
      
      // Set the error state
      setError(`${args.join(' ')}`);
    };
    
    // Restore original console methods on cleanup
    return () => {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
    };
  }, []);
  
  const handleRunTest = () => {
    setIsLoading(true);
    setError(null);
    setLogMessages([]);
    
    try {
      runMidiTest();
      
      // Add initial log
      setLogMessages(['Started MIDI test - click anywhere to trigger audio playback']);
    } catch (err) {
      setError(`Failed to initialize test: ${err instanceof Error ? err.message : String(err)}`);
      setIsLoading(false);
    }
  };
  
  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        MIDI Player Test
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleRunTest}
          disabled={isLoading}
          sx={{ mr: 2 }}
        >
          {isLoading ? 'Test Running...' : 'Run MIDI Test'}
        </Button>
        
        {isLoading && <CircularProgress size={24} sx={{ ml: 2 }} />}
      </Box>
      
      {error && (
        <Box sx={{ mb: 2, p: 2, bgcolor: '#ffebee', borderRadius: 1 }}>
          <Typography color="error">Error: {error}</Typography>
        </Box>
      )}
      
      <Box
        sx={{
          bgcolor: '#f5f5f5',
          p: 2,
          borderRadius: 1,
          mb: 2,
          maxHeight: 400,
          overflow: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.9rem'
        }}
      >
        <Typography variant="subtitle2" gutterBottom>
          Test Log:
        </Typography>
        
        {logMessages.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            (No log messages yet. Click "Run MIDI Test" to start)
          </Typography>
        ) : (
          logMessages.map((message, index) => (
            <Box 
              key={index} 
              sx={{ 
                py: 0.5, 
                borderBottom: '1px solid #e0e0e0',
                color: message.startsWith('ERROR') ? 'error.main' : 'text.primary'
              }}
            >
              {message}
            </Box>
          ))
        )}
      </Box>
      
      <Typography variant="caption" color="text.secondary">
        Note: This test requires an audio worklet file to be available at '/worklet_processor.min.js'.
        Make sure this file is copied to the public directory.
      </Typography>
    </Box>
  );
};

export default MidiPlayerTestComponent;