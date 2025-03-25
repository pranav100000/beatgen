import React, { useEffect, useRef } from 'react';
import { Box, IconButton, Button, Typography, TextField, Menu, MenuItem } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import AddIcon from '@mui/icons-material/Add';

// Import components
import BPMControl from './components/BPMControl';
import TimeSignatureDisplay from './components/TimeSignatureDisplay';
import KeySelector from './components/KeySelector';
import TrackControlsSidebar from './components/TrackControlsSidebar';
import { Timeline } from './components/Timeline/Timeline';
import AddTrackMenu from './components/AddTrackMenu';
import { GRID_CONSTANTS } from './constants/gridConstants';
import * as Tone from 'tone';
import { useStudioStore } from './stores/useStudioStore';

// Main Studio Component
function Studio() {
  // Get state and actions from Zustand store
  const {
    store,
    tracks,
    isPlaying,
    currentTime,
    bpm,
    timeSignature,
    keySignature,
    zoomLevel,
    projectTitle,
    canUndo,
    canRedo,
    measureCount,
    isInitialized,
    addMenuAnchor,
    
    // Actions
    initializeAudio,
    setZoomLevel,
    setProjectTitle,
    setTimeSignature,
    setKeySignature,
    playPause,
    stop,
    setCurrentTime,
    setMeasureCount,
    undo,
    redo,
    handleTrackVolumeChange,
    handleTrackPanChange,
    handleTrackMuteToggle,
    handleTrackSoloToggle,
    handleTrackDelete,
    handleAddTrack,
    handleTrackPositionChange,
    handleTrackNameChange,
    uploadAudioFile,
    setBpm,
    setAddMenuAnchor
  } = useStudioStore();
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize audio engine
  useEffect(() => {
    initializeAudio();
    
    return () => {
      // Cleanup on unmount
      delete (window as any).storeInstance;
    };
  }, [initializeAudio]);
  
  // Handlers
  const handleBpmChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newBpm = parseInt(event.target.value, 10);
    if (!isNaN(newBpm) && newBpm > 0 && newBpm <= 999) {
      setBpm(newBpm);
    }
  };

  const handleTimeSignatureChange = (numerator?: number, denominator?: number) => {
    const [currentNumerator, currentDenominator] = timeSignature;
    setTimeSignature(
      numerator ?? currentNumerator,
      denominator ?? currentDenominator
    );
  };

  const handleZoomIn = () => {
    setZoomLevel(Math.min(zoomLevel + 0.1, 4));
  };

  const handleZoomOut = () => {
    setZoomLevel(Math.max(zoomLevel - 0.1, 0.3));
  };

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setProjectTitle(event.target.value);
  };

  // Update UI time display based on transport position
  useEffect(() => {
    if (!isPlaying || !store) return;

    const updateTime = () => {
      const transport = store.getTransport();
      if (transport) {
        // Get the current position from transport
        setCurrentTime(transport.position);
        animationFrameRef.current = requestAnimationFrame(updateTime);
      }
    };

    // Start the animation frame loop
    animationFrameRef.current = requestAnimationFrame(updateTime);

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, store, setCurrentTime]);

  // Handle infinite scrolling for the timeline
  const handleScroll = React.useCallback(() => {
    if (!scrollRef.current) return;

    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;

    if (scrollLeft + clientWidth >= scrollWidth - 100) {
      setMeasureCount(measureCount + 20);
    }
  }, [measureCount, setMeasureCount]);

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    const debounceScroll = () => requestAnimationFrame(handleScroll);
    scrollContainer.addEventListener("scroll", debounceScroll);

    return () => scrollContainer.removeEventListener("scroll", debounceScroll);
  }, [handleScroll]);

  return (
    <Box sx={{ 
      height: '100vh', 
      bgcolor: '#000000', 
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Top Control Bar */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        p: 1, 
        borderBottom: '1px solid #333',
        gap: 2,
        paddingLeft: 2,
        position: 'relative',
        zIndex: 1300,
      }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton 
            size="small" 
            sx={{ color: canUndo ? 'white' : '#666' }}
            onClick={undo}
            disabled={!canUndo}
            title="Undo"
          >
            <UndoIcon />
          </IconButton>
          <IconButton 
            size="small" 
            sx={{ color: canRedo ? 'white' : '#666' }}
            onClick={redo}
            disabled={!canRedo}
            title="Redo"
          >
            <RedoIcon />
          </IconButton>
        </Box>

        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          bgcolor: '#1E1E1E',
          borderRadius: 1,
          px: 2,
          py: 0.5,
          gap: 1
        }}>
          <BPMControl bpm={bpm} onBpmChange={handleBpmChange} />
        </Box>

        <TimeSignatureDisplay 
          topNumber={timeSignature[0]} 
          bottomNumber={timeSignature[1]}
          onTopNumberChange={(value) => handleTimeSignatureChange(value, undefined)}
          onBottomNumberChange={(value) => handleTimeSignatureChange(undefined, value)}
        />

        <KeySelector 
          selectedKey={keySignature}
          onKeyChange={setKeySignature}
        />

        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton 
            size="small" 
            sx={{ color: 'white' }}
            onClick={playPause}
          >
            {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
          </IconButton>
          <IconButton 
            size="small" 
            sx={{ color: 'white' }}
            onClick={stop}
          >
            <SkipPreviousIcon />
          </IconButton>
        </Box>

        <Box sx={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1
        }}>
          <TextField
            variant="standard"
            value={projectTitle}
            onChange={handleTitleChange}
            sx={{
              '& input': {
                color: 'white',
                textAlign: 'center',
                fontSize: '1rem',
                fontWeight: 500,
                padding: '4px 8px',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)'
                }
              },
              '& .MuiInput-underline:before': {
                borderBottom: 'none'
              },
              '& .MuiInput-underline:hover:before': {
                borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
              },
              '& .MuiInput-underline:after': {
                borderBottom: '2px solid white'
              }
            }}
          />
        </Box>

        <Box sx={{ 
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          pr: 2
        }}>
          <Box sx={{ 
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}>
            <IconButton size="small" sx={{ color: 'white' }} onClick={handleZoomIn}>
              <ZoomInIcon />
            </IconButton>
            <Box sx={{ color: "white", fontWeight: "bold", backgroundColor: "#333", minWidth: 40, textAlign: "center", border: "1px solid rgba(255, 255, 255, 0.2)", padding: "4px 4px", borderRadius: "6px" }}>
              {zoomLevel.toFixed(1)}x
            </Box>
            <IconButton size="small" sx={{ color: 'white' }} onClick={handleZoomOut}>
              <ZoomOutIcon />
            </IconButton>
          </Box>
        </Box>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ 
        display: 'flex', 
        flex: 1, 
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Left Sidebar */}
        <Box sx={{ 
          width: GRID_CONSTANTS.sidebarWidth,
          borderRight: `${GRID_CONSTANTS.borderWidth} solid ${GRID_CONSTANTS.borderColor}`,
          bgcolor: '#1A1A1A',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header section with Add Track button */}
          <Box sx={{
            height: GRID_CONSTANTS.headerHeight,
            borderBottom: `${GRID_CONSTANTS.borderWidth} solid ${GRID_CONSTANTS.borderColor}`,
            display: 'flex',
            alignItems: 'center',
            p: 0.3,
            boxSizing: 'border-box'
          }}>
            <Box sx={{ 
              position: 'relative', 
              display: 'flex',
              width: '100%'
            }}>
              <Button
                startIcon={<AddIcon />}
                variant="contained"
                onClick={(e) => setAddMenuAnchor(e.currentTarget)}
                sx={{
                  bgcolor: '#1A1A1A',
                  color: 'white',
                  '&:hover': { bgcolor: '#444' },
                  height: 24,
                  textTransform: 'none',
                  width: '100%',
                  mx: 'auto',
                  display: 'flex',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}
              >
                Add Track
              </Button>
              <AddTrackMenu
                isOpen={Boolean(addMenuAnchor)}
                anchorEl={addMenuAnchor}
                onClose={() => setAddMenuAnchor(null)}
                onAddTrack={handleAddTrack}
                onFileUpload={uploadAudioFile}
              />
            </Box>
          </Box>

          {/* Track controls section */}
          <Box sx={{ 
            flex: 1, 
            overflow: 'auto'
          }}>
            <TrackControlsSidebar 
              tracks={tracks}
              onVolumeChange={handleTrackVolumeChange}
              onPanChange={handleTrackPanChange}
              onMuteToggle={handleTrackMuteToggle}
              onSoloToggle={handleTrackSoloToggle}
              onTrackDelete={handleTrackDelete}
              onTrackNameChange={handleTrackNameChange}
            />
          </Box>
        </Box>

        {/* Timeline Area */}
        <Timeline
          tracks={tracks}
          currentTime={currentTime}
          isPlaying={isPlaying}
          measureCount={measureCount}
          zoomLevel={zoomLevel}
          bpm={bpm}
          timeSignature={timeSignature}
          onTrackPositionChange={handleTrackPositionChange}
          onTimeChange={(newTime) => {
            setCurrentTime(newTime);
            if (store && store.getTransport()) {
              store.getTransport().setPosition(newTime);
            }
          }}
          gridLineStyle={{
            borderRight: `${GRID_CONSTANTS.borderWidth} solid ${GRID_CONSTANTS.borderColor}`
          }}
          ref={scrollRef}
        />
      </Box>
    </Box>
  );
}

export default Studio;