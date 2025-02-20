import { useState, useCallback, useEffect, useRef } from 'react';
import { Box, IconButton, Button } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import PauseIcon from '@mui/icons-material/Pause';
import LoopIcon from '@mui/icons-material/Loop';
import AddIcon from '@mui/icons-material/Add';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Track from '../components/Track';
import AddTrackMenu from '../components/AddTrackMenu';
import { GRID_CONSTANTS } from '../constants/gridConstants';
import PlaybackCursor from '../components/PlaybackCursor';

function NewProject() {
  const [tracks, setTracks] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const animationFrameRef = useRef(null);

  useEffect(() => {
    let lastTimestamp = null;

    const updatePlayback = (timestamp) => {
      if (lastTimestamp === null) {
        lastTimestamp = timestamp;
      }
      
      const deltaTime = (timestamp - lastTimestamp) / 1000; // Convert to seconds
      lastTimestamp = timestamp;

      if (isPlaying) {
        setCurrentTime(prevTime => prevTime + deltaTime);
        animationFrameRef.current = requestAnimationFrame(updatePlayback);
      }
    };

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updatePlayback);
    }

    // Cleanup function
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  const handleAddTrack = (trackTypeOrFile) => {
    if (trackTypeOrFile instanceof File) {
      // Handle audio file
      setTracks(prev => [...prev, { 
        id: Date.now(), 
        type: 'audio',
        audioFile: trackTypeOrFile
      }]);
    } else {
      // Handle other track types
      setTracks(prev => [...prev, { 
        id: Date.now(), 
        type: trackTypeOrFile 
      }]);
    }
  };

  const handleDeleteTrack = (indexToDelete) => {
    setTracks(prev => prev.filter((_, index) => index !== indexToDelete));
  };

  const handleOpenMenu = (event) => {
    setAnchorEl(event.currentTarget);
    setMenuOpen(true);
  };

  const handleCloseMenu = () => {
    setMenuOpen(false);
    setAnchorEl(null);
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    const tenths = Math.floor((timeInSeconds * 10) % 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${tenths}`;
  };

  const gridLineStyle = {
    borderRight: `${GRID_CONSTANTS.borderWidth} solid ${GRID_CONSTANTS.borderColor}`,
  };

  return (
    <Box sx={{ 
      height: '100vh', 
      bgcolor: '#000000', 
      color: 'white',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Top Control Bar */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        p: 1, 
        borderBottom: '1px solid #333',
        gap: 2
      }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton size="small" sx={{ color: 'white' }}>
            <ArrowBackIcon />
          </IconButton>
          <IconButton size="small" sx={{ color: 'white' }}>
            <ArrowForwardIcon />
          </IconButton>
        </Box>

        <IconButton 
          size="small" 
          sx={{ color: 'white' }}
          onClick={handlePlayPause}
        >
          {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
        </IconButton>

        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          bgcolor: '#1E1E1E',
          borderRadius: 1,
          px: 2,
          py: 0.5,
          gap: 1
        }}>
          <Box>120</Box>
          <Box sx={{ opacity: 0.7 }}>bpm</Box>
        </Box>

        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center',
          bgcolor: '#1E1E1E',
          borderRadius: 1,
          px: 2,
          py: 0.5
        }}>
          4 / 4
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton size="small" sx={{ color: 'white' }}>
            <PlayArrowIcon />
          </IconButton>
          <IconButton size="small" sx={{ color: 'white' }}>
            <SkipPreviousIcon />
          </IconButton>
          <IconButton size="small" sx={{ color: 'white', bgcolor: '#3E3E3E' }}>
            <LoopIcon />
          </IconButton>
        </Box>

        <Box sx={{ 
          ml: 'auto', 
          color: '#fff',
          display: 'flex',
          alignItems: 'center'
        }}>
          {formatTime(currentTime)}
        </Box>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar */}
        <Box sx={{ 
          width: GRID_CONSTANTS.sidebarWidth,
          borderRight: gridLineStyle.borderRight,
          p: 2,
          bgcolor: '#1A1A1A'
        }}>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={handleOpenMenu}
            sx={{
              bgcolor: '#333',
              color: 'white',
              '&:hover': {
                bgcolor: '#444'
              }
            }}
          >
            Add Track
          </Button>
        </Box>

        {/* Timeline Area */}
        <Box sx={{ flex: 1, position: 'relative', overflow: 'auto' }}>
          {/* Time Markers */}
          <Box sx={{ 
            display: 'flex',
            position: 'sticky',
            top: 0,
            bgcolor: '#000',
            zIndex: 2
          }}>
            {/* Empty space for track controls alignment */}
            <Box sx={{ 
              width: GRID_CONSTANTS.controlsWidth,
              height: GRID_CONSTANTS.headerHeight,
              borderRight: gridLineStyle.borderRight,
              borderBottom: gridLineStyle.borderRight,
              bgcolor: '#1A1A1A',
              flexShrink: 0
            }} />

            {/* Measure numbers container */}
            <Box sx={{ 
              display: 'flex',
              position: 'relative',
              flex: 1,
              borderBottom: gridLineStyle.borderRight
            }}>
              {/* Vertical grid lines */}
              {Array.from({ length: GRID_CONSTANTS.measureCount + 1 }).map((_, i) => (
                <Box
                  key={`grid-${i}`}
                  sx={{
                    position: 'absolute',
                    left: `${(i * GRID_CONSTANTS.measureWidth)}px`,
                    top: 0,
                    bottom: 0,
                    width: GRID_CONSTANTS.borderWidth,
                    bgcolor: GRID_CONSTANTS.borderColor,
                    zIndex: 1
                  }}
                />
              ))}

              {/* Measure numbers */}
              {Array.from({ length: GRID_CONSTANTS.measureCount }).map((_, i) => (
                <Box 
                  key={`number-${i}`}
                  sx={{ 
                    width: GRID_CONSTANTS.measureWidth,
                    height: GRID_CONSTANTS.headerHeight,
                    display: 'flex',
                    alignItems: 'center',
                    color: '#666',
                    flexShrink: 0,
                    position: 'relative',
                    zIndex: 2,
                    '& > span': {
                      position: 'absolute',
                      left: 20  // Fixed distance from the left grid line
                    }
                  }}
                >
                  <span>{i + 1}</span>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Tracks or Drop Zone */}
          {tracks.length > 0 ? (
            <Box sx={{ 
              minHeight: '100%',
              position: 'relative'
            }}>
              <PlaybackCursor currentTime={currentTime} />

              {tracks.map((track, index) => (
                <Track 
                  key={track.id}
                  index={index}
                  onDelete={handleDeleteTrack}
                  type={track.type}
                  audioFile={track.audioFile}
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  gridLineStyle={gridLineStyle}
                  measureCount={GRID_CONSTANTS.measureCount}
                />
              ))}
            </Box>
          ) : (
            <Box sx={{ 
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              color: '#666',
              height: '100%',
              border: '2px dashed #333',
              m: 2,
              borderRadius: 2
            }}>
              <Box sx={{ fontSize: 24, mb: 1 }}>♫</Box>
              <Box>Drop a loop or an audio/MIDI/Video file</Box>
            </Box>
          )}
        </Box>

        {/* Right Toolbar */}
        <Box sx={{ 
          width: 50,
          borderLeft: gridLineStyle.borderRight,
          display: 'flex',
          flexDirection: 'column',
          p: 1,
          gap: 1
        }}>
          <IconButton size="small" sx={{ color: 'white' }}>
            <ShuffleIcon />
          </IconButton>
          <IconButton size="small" sx={{ color: 'white' }}>
            <ZoomInIcon />
          </IconButton>
          <IconButton size="small" sx={{ color: 'white' }}>
            <ZoomOutIcon />
          </IconButton>
        </Box>
      </Box>

      <AddTrackMenu
        open={menuOpen}
        onClose={handleCloseMenu}
        onSelectTrack={handleAddTrack}
        anchorEl={anchorEl}
      />
    </Box>
  );
}

export default NewProject; 