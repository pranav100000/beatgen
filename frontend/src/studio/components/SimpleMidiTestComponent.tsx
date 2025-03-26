import React, { useEffect, useState, useRef } from 'react';
import { Box, Button, Typography, CircularProgress, Slider, Stack } from '@mui/material';
import { runSoundfontMidiPlayerTest } from '../core/audio-engine/simpleMidiTest';

const SimpleMidiTestComponent: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [playerReady, setPlayerReady] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const positionTimerRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  
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
      
      // Clean up any running timers
      if (positionTimerRef.current) {
        window.clearInterval(positionTimerRef.current);
      }
      
      // Clean up player if it exists
      if ((window as any).__soundfontTest?.cleanup) {
        (window as any).__soundfontTest.cleanup();
      }
    };
  }, []);
  
  // Start position update timer when player is ready
  useEffect(() => {
    if (playerReady && !positionTimerRef.current) {
      // Get initial duration
      try {
        const player = (window as any).__soundfontTest;
        if (player) {
          setDuration(player.getDuration());
        }
      } catch (err) {
        console.error('Failed to get duration:', err);
      }
      
      // Set up position updating
      positionTimerRef.current = window.setInterval(() => {
        if (!isDraggingRef.current) {
          try {
            const player = (window as any).__soundfontTest;
            if (player) {
              const position = player.getCurrentTime();
              setCurrentPosition(position);
              setIsPlaying(player.isPlaying());
            }
          } catch (err) {
            console.error('Failed to update position:', err);
          }
        }
      }, 100); // Update every 100ms for smooth UI
    }
    
    return () => {
      if (positionTimerRef.current) {
        window.clearInterval(positionTimerRef.current);
        positionTimerRef.current = null;
      }
    };
  }, [playerReady]);
  
  const handleRunTest = () => {
    setIsLoading(true);
    setIsPlaying(false);
    setError(null);
    setLogMessages([]);
    setPlayerReady(false);
    
    // Clean up existing player if there is one
    if ((window as any).__soundfontTest?.cleanup) {
      (window as any).__soundfontTest.cleanup();
    }
    
    try {
      runSoundfontMidiPlayerTest();
      
      // Add initial log
      setLogMessages(['Started SoundfontMidiPlayer test - click anywhere to trigger audio playback']);
      
      // Check every second if the player is ready
      const checkInterval = setInterval(() => {
        if ((window as any).__soundfontTest) {
          clearInterval(checkInterval);
          setIsLoading(false);
          setPlayerReady(true);
          setIsPlaying(true);
          
          // Get the duration
          try {
            setDuration((window as any).__soundfontTest.getDuration());
          } catch (err) {
            console.error('Failed to get duration:', err);
          }
        }
      }, 1000);
      
      // Fallback timeout
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!(window as any).__soundfontTest) {
          setError("Test initialization timed out. Try clicking on the page again.");
          setIsLoading(false);
        }
      }, 10000); // 10 second timeout
      
    } catch (err) {
      setError(`Failed to initialize test: ${err instanceof Error ? err.message : String(err)}`);
      setIsLoading(false);
    }
  };
  
  const handlePlayPause = () => {
    if (!(window as any).__soundfontTest) {
      setError("Test not initialized yet. Please run the test first.");
      return;
    }
    
    try {
      if (isPlaying) {
        (window as any).__soundfontTest.pause();
        setLogMessages(prev => [...prev, 'LOG: Pausing playback']);
        setIsPlaying(false);
      } else {
        (window as any).__soundfontTest.play();
        setLogMessages(prev => [...prev, 'LOG: Starting playback']);
        setIsPlaying(true);
      }
    } catch (err) {
      setError(`Playback control failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  
  const handleStop = () => {
    if (!(window as any).__soundfontTest) {
      setError("Test not initialized yet. Please run the test first.");
      return;
    }
    
    try {
      (window as any).__soundfontTest.stop();
      setLogMessages(prev => [...prev, 'LOG: Stopping playback']);
      setIsPlaying(false);
      setCurrentPosition(0);
    } catch (err) {
      setError(`Stop failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  
  const handleSeek = (position: number, autoPlay?: boolean) => {
    if (!(window as any).__soundfontTest) {
      setError("Test not initialized yet. Please run the test first.");
      return;
    }
    
    try {
      (window as any).__soundfontTest.seek(position, autoPlay);
      setLogMessages(prev => [...prev, `LOG: Seeked to ${position.toFixed(1)}s${autoPlay ? ' with autoplay' : ''}`]);
      setCurrentPosition(position);
      if (autoPlay) {
        setIsPlaying(true);
      }
    } catch (err) {
      setError(`Seek failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  
  const handleSliderChange = (_event: Event, value: number | number[]) => {
    isDraggingRef.current = true;
    setCurrentPosition(value as number);
  };
  
  const handleSliderCommitted = (_event: React.SyntheticEvent | Event, value: number | number[]) => {
    handleSeek(value as number);
    // Short timeout before allowing position updates again
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);
  };
  
  // Format time in MM:SS format
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        SoundfontMidiPlayer Test
      </Typography>
      
      <Typography variant="body2" sx={{ mb: 2 }}>
        This test uses the SoundfontMidiPlayer class to play a MIDI file with a soundfont.
      </Typography>
      
      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
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
          color={isPlaying ? "secondary" : "success"}
          onClick={handlePlayPause}
          disabled={isLoading || !playerReady}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </Button>
        
        <Button
          variant="outlined"
          color="error"
          onClick={handleStop}
          disabled={isLoading || !playerReady}
        >
          Stop
        </Button>
        
        {isLoading && <CircularProgress size={24} />}
      </Box>
      
      {playerReady && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Playback Position
          </Typography>
          
          <Stack spacing={2} direction="row" sx={{ mb: 1 }} alignItems="center">
            <Typography variant="body2" sx={{ minWidth: 45 }}>
              {formatTime(currentPosition)}
            </Typography>
            
            <Slider
              value={currentPosition}
              min={0}
              max={duration}
              step={0.1}
              onChange={handleSliderChange}
              onChangeCommitted={handleSliderCommitted}
              disabled={!playerReady}
              aria-label="Playback position"
              sx={{ 
                '& .MuiSlider-thumb': {
                  width: 12,
                  height: 12,
                },
                height: 4
              }}
            />
            
            <Typography variant="body2" sx={{ minWidth: 45 }}>
              {formatTime(duration)}
            </Typography>
          </Stack>
          
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
            <Typography variant="subtitle2" sx={{ flexBasis: '100%' }}>
              Quick Seek:
            </Typography>
            
            {[0, 5, 10, 15, 30].map(seconds => (
              <Button 
                key={seconds}
                size="small"
                variant="outlined"
                onClick={() => handleSeek(seconds)}
                sx={{ minWidth: 0, px: 1 }}
              >
                {formatTime(seconds)}
              </Button>
            ))}
            
            <Button 
              size="small"
              variant="outlined"
              onClick={() => handleSeek(Math.max(0, currentPosition - 5))}
              sx={{ minWidth: 0, px: 1 }}
            >
              -5s
            </Button>
            
            <Button 
              size="small"
              variant="outlined"
              onClick={() => handleSeek(Math.min(duration, currentPosition + 5))}
              sx={{ minWidth: 0, px: 1 }}
            >
              +5s
            </Button>
          </Box>
        </Box>
      )}
      
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
        Note: This test demonstrates the enhanced SoundfontMidiPlayer with seek functionality.
      </Typography>
    </Box>
  );
};

export default SimpleMidiTestComponent;