import React, { useEffect, useState } from 'react';
import { Box, Button, Typography, CircularProgress, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { runMidiPlayerDirectTest } from '../core/audio-engine/midiPlayerDirectTest';

const MidiPlayerDirectTestComponent: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [selectedInstrument, setSelectedInstrument] = useState<string>('piano');
  
  // Available instrument options
  const instruments = [
    { id: 'piano', name: 'Piano' },
    { id: 'guitar', name: 'Guitar' },
    { id: 'bass', name: 'Bass' },
    { id: 'brass', name: 'Brass' },
    { id: 'strings', name: 'Strings' },
    { id: 'synth', name: 'Synth Lead' }
  ];
  
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
    setIsPlaying(false);
    setError(null);
    setLogMessages([]);
    
    try {
      runMidiPlayerDirectTest();
      
      // Add initial log
      setLogMessages(['Started MidiPlayer test - click anywhere to trigger audio playback']);
    } catch (err) {
      setError(`Failed to initialize test: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // We removed the changeInstrument functionality since we're using a direct approach
  const handleChangeInstrument = () => {
    setError("Instrument changing is not available in the direct test approach.");
    setLogMessages(prev => [...prev, `LOG: Instrument changing not available in direct test`]);
  };
  
  const handlePlayPause = () => {
    if (!(window as any).__midiTest) {
      setError("Test not initialized yet. Please run the test first.");
      return;
    }
    
    try {
      if (isPlaying) {
        (window as any).__midiTest.stop();
        setLogMessages(prev => [...prev, 'LOG: Stopping playback']);
        setIsPlaying(false);
      } else {
        (window as any).__midiTest.play();
        setLogMessages(prev => [...prev, 'LOG: Starting playback']);
        setIsPlaying(true);
      }
    } catch (err) {
      setError(`Playback control failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  
  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        MidiPlayer Direct Test
      </Typography>
      
      <Typography variant="body2" sx={{ mb: 2 }}>
        This test directly interacts with the MidiPlayer class to verify its core functionality.
      </Typography>
      
      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleRunTest}
          disabled={isLoading}
        >
          {isLoading ? 'Initializing...' : 'Run Test'}
        </Button>
        
        <Button
          variant="outlined"
          color={isPlaying ? "error" : "success"}
          onClick={handlePlayPause}
          disabled={!(window as any).__midiTest}
        >
          {isPlaying ? 'Stop' : 'Play'}
        </Button>
        
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="instrument-select-label">Instrument</InputLabel>
          <Select
            labelId="instrument-select-label"
            value={selectedInstrument}
            label="Instrument"
            onChange={(e) => setSelectedInstrument(e.target.value)}
            disabled={!(window as any).__midiTest}
          >
            {instruments.map((inst) => (
              <MenuItem key={inst.id} value={inst.id}>{inst.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <Button
          variant="outlined"
          onClick={handleChangeInstrument}
          disabled={!(window as any).__midiTest}
        >
          Change Instrument
        </Button>
        
        {isLoading && <CircularProgress size={24} />}
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
            (No log messages yet. Click "Run Test" to start)
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
        Note: This test requires the spessasynth library to be properly loaded 
        and soundfont files to be available in the appropriate locations.
      </Typography>
    </Box>
  );
};

export default MidiPlayerDirectTestComponent;