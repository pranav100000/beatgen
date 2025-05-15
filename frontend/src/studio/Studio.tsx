import React, { useEffect, useRef, useState, useMemo, useLayoutEffect } from 'react';
import { Box, Button, FormControlLabel, Switch, useTheme } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';

// Import components
import TrackControlsSidebar from './components/sidebar/TrackControlsSidebar';
import { Timeline, TimelineRef } from './components/timeline/Timeline';
import AddTrackMenu from './components/sidebar/AddTrackMenu';
import { GRID_CONSTANTS } from './constants/gridConstants';
import { useStudioStore } from './stores/studioStore';

// Import piano roll components
import PianoRollWindows from './components/piano-roll-new/PianoRollWindows';

// Import Drum Machine
import DrumMachine from './components/drum-machine/DrumMachine';

// Import custom hooks
import { useStudioDBSession } from './hooks/useStudioDBSession';
import { useHistorySync } from './hooks/useHistorySync';

import StudioControlBar from './components/control-bar/ControlBar';
import { DEFAULT_MEASURE_WIDTH, useGridStore } from './core/state/gridStore';
import ChatWindow from './components/ai-assistant/ChatWindow';
import DrumMachineWindows from './components/drum-machine/DrumMachineWindows';
import { StudioSettingsModal } from './components/modals/StudioSettingsModal';
import { useAppTheme } from '../platform/theme/ThemeContext';
import { studioLightTheme, studioDarkTheme } from '../platform/theme/ThemeContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { IconChevronLeftPipe, IconChevronRightPipe } from '@tabler/icons-react';

// Studio Component Props
interface StudioProps {
  projectId?: string;
}

const COLLAPSED_SIDEBAR_WIDTH = '40px'; // Width of the sidebar when collapsed

// Main Studio Component
function Studio({ projectId }: StudioProps) {
  // Add console log here
  console.log('>>> Studio Component Rendering <<<'); 

  // Initialize DB session management
  useStudioDBSession();
  
  // Setup history state sync
  useHistorySync();
  
  // Ref and state for Control Bar height
  const controlBarRef = useRef<HTMLDivElement>(null);
  const [controlBarHeight, setControlBarHeight] = useState(0);
  
  // Get studioMode from theme context
  const { studioMode } = useAppTheme();
  
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
    loadProject,
    setZoomLevel,
    handleProjectParamChange,
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
    handleInstrumentChange,
    uploadAudioFile,
    setAddMenuAnchor,
    openDrumMachines,
    closeDrumMachine,
    setDrumPattern,
    addSamplerTrackToDrumTrack,
    removeSamplerTrack,
    selectDrumTrackById,
    selectSamplerTracksForDrumTrack,
    // Fetch MIDI actions
    addMidiNote,
    removeMidiNote,
    updateMidiNote,
    replaceTrackAudioFile,
  } = useStudioStore();
  
  const scrollRef = useRef<TimelineRef>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Default to open
  const [existingProjectId, setExistingProjectId] = useState<string | null>(projectId || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [trackIdForFileUpload, setTrackIdForFileUpload] = useState<string | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const handleChatToggle = () => {
    setIsChatOpen(prev => !prev);
  };

  const handleSettingsToggle = () => {
    setIsSettingsModalOpen(prev => !prev);
  };

  // Effect to measure control bar height
  useLayoutEffect(() => {
    if (controlBarRef.current) {
      const height = controlBarRef.current.offsetHeight;
      setControlBarHeight(height);
      console.log('Control Bar Height:', height);
    }
  }, []); // Empty dependency array to run once on mount

  // Initialize audio engine
  useEffect(() => {
    console.log('>>> Studio useEffect <<<');
    // Always favor prop projectId over existingProjectId state
    const projectToLoad = projectId || existingProjectId;
    
    // If we have a project ID, load the project instead of just initializing
    if (projectToLoad) {
      console.log(`Studio initialized with existing project ID: ${projectToLoad}`);
      loadProject(projectToLoad)
        .then(() => {
          console.log(`Successfully loaded project: ${projectToLoad}`);
          // Update existingProjectId state if it was from props
          if (projectId && projectId !== existingProjectId) {
            setExistingProjectId(projectId);
          }
        })
        .catch(error => {
          console.error('Failed to load project:', error);
          // Fall back to initializing an empty project
          initializeAudio();
        });
    } else {
      console.log('Studio initialized with new project');
      initializeAudio();
    }
    
    return () => {
      // Cleanup on unmount
      delete (window as any).storeInstance;
    };
  }, [initializeAudio, existingProjectId, projectId, loadProject]);
  
  // Handlers
  const handleBpmChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newBpm = parseInt(event.target.value, 10);
    if (!isNaN(newBpm) && newBpm > 0 && newBpm <= 999) {
      // Use handleProjectParamChange instead of setBpm
      handleProjectParamChange('bpm', newBpm);
    }
  };

  const handleTimeSignatureChange = (numerator?: number, denominator?: number) => {
    const [currentNumerator, currentDenominator] = timeSignature;
    // Use handleProjectParamChange for both numerator and denominator
    // Note: This assumes handleProjectParamChange can handle updating nested state or the store handles this logic.
    // If it needs separate updates, this needs adjustment.
    // For now, let's update them individually if provided.
    if (numerator !== undefined) {
      handleProjectParamChange('timeSignature', [numerator, currentDenominator]);
    }
    if (denominator !== undefined) {
      // Get the potentially updated numerator before setting denominator
      const updatedNumerator = numerator !== undefined ? numerator : currentNumerator;
      handleProjectParamChange('timeSignature', [updatedNumerator, denominator]);
    }
  };

  const handleZoomIn = () => {
    setZoomLevel(Math.min(zoomLevel + GRID_CONSTANTS.studioZoomStep, GRID_CONSTANTS.studioZoomMax));
    // Update measureWidth in gridStore based on zoom level
    const newMeasureWidth = DEFAULT_MEASURE_WIDTH * (Math.min(zoomLevel + GRID_CONSTANTS.studioZoomStep, GRID_CONSTANTS.studioZoomMax));
    useGridStore.getState().setMidiMeasurePixelWidth(newMeasureWidth);
    useGridStore.getState().setAudioMeasurePixelWidth(newMeasureWidth);
  };

  const handleZoomOut = () => {
    setZoomLevel(Math.max(zoomLevel - GRID_CONSTANTS.studioZoomStep, GRID_CONSTANTS.studioZoomMin));
    // Update measureWidth in gridStore based on zoom level
    const newMeasureWidth = DEFAULT_MEASURE_WIDTH * (Math.max(zoomLevel - GRID_CONSTANTS.studioZoomStep, GRID_CONSTANTS.studioZoomMin));
    useGridStore.getState().setMidiMeasurePixelWidth(newMeasureWidth);
    useGridStore.getState().setAudioMeasurePixelWidth(newMeasureWidth);
  };

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleProjectParamChange('projectTitle', event.target.value);
  };

  // Handler to trigger file input for replacing track audio
  const handleLoadAudioFile = (trackId: string) => {
    if (fileInputRef.current) {
      setTrackIdForFileUpload(trackId);
      fileInputRef.current.click();
    }
  };

  // Handler for when a file is selected via the hidden input
  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && trackIdForFileUpload) {
      console.log(`File selected for track ${trackIdForFileUpload}:`, file.name);
      replaceTrackAudioFile(trackIdForFileUpload, file);
    }
    event.target.value = '';
    setTrackIdForFileUpload(null);
  };

  // Control playback cursor directly when playback state changes
  useEffect(() => {
    if (!store || !scrollRef.current?.playbackCursor) return;
    
    if (isPlaying) {
      // Start the cursor animation when playback starts
      scrollRef.current.playbackCursor.play();
      console.log('Starting cursor animation via imperative API');
    } else {
      // Pause the cursor animation when playback stops
      scrollRef.current.playbackCursor.pause();
      console.log('Pausing cursor animation via imperative API');
    }
    
    // Clean up any stray animation frames
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying, store]);

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

  // Determine the theme for the studio based on studioMode
  const currentStudioTheme = useMemo(() => {
    return studioMode === 'light' ? studioLightTheme : studioDarkTheme;
  }, [studioMode]);

  return (
    <MuiThemeProvider theme={currentStudioTheme}>
      <Box sx={{ 
        height: '100vh', 
        bgcolor: 'background.default',
        color: 'text.primary',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <StudioControlBar
          ref={controlBarRef}
          canUndo={canUndo}
          canRedo={canRedo}
          bpm={bpm}
          timeSignature={timeSignature}
          keySignature={keySignature}
          isPlaying={isPlaying}
          projectTitle={projectTitle}
          zoomLevel={zoomLevel}
          currentTime={currentTime}
          isChatOpen={isChatOpen}
          existingProjectId={existingProjectId}
          tracks={tracks}
          onUndo={undo}
          onRedo={redo}
          onBpmChange={handleBpmChange}
          onTimeSignatureChange={handleTimeSignatureChange}
          onKeySignatureChange={(newKey) => handleProjectParamChange('keySignature', newKey)}
          onPlayPause={playPause}
          onStop={stop}
          onTitleChange={handleTitleChange}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onChatToggle={handleChatToggle}
          onSettingsToggle={handleSettingsToggle}
        />

        {/* Main Content Area */}
        <Box sx={{ 
          display: 'flex', 
          flex: 1, 
          overflow: 'visible',
          position: 'relative',
          paddingTop: `${controlBarHeight}px`
        }}>
          {/* Left Sidebar - Fixed position */}
          <Box sx={{ 
            width: isSidebarOpen ? GRID_CONSTANTS.sidebarWidth : COLLAPSED_SIDEBAR_WIDTH,
            transition: 'width 0.3s ease-in-out',
            borderRight: `${GRID_CONSTANTS.borderWidth} solid ${GRID_CONSTANTS.borderColor}`,
            bgcolor: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
            position: 'fixed',
            left: 0,
            top: `${controlBarHeight}px`,
            height: `calc(100vh - ${controlBarHeight}px)`,
            overflowX: 'hidden', // Prevent horizontal overflow during transition
            zIndex: 10
          }}>
            {/* Header section with Add Track button */}
            <Box sx={{
              height: GRID_CONSTANTS.headerHeight,
              minHeight: GRID_CONSTANTS.headerHeight, // Ensure header height is maintained
              borderBottom: `${GRID_CONSTANTS.borderWidth} solid ${GRID_CONSTANTS.borderColor}`,
              display: 'flex',
              alignItems: 'center',
              p: 0, // User's update
              boxSizing: 'border-box',
              overflow: 'hidden', // Prevent content spill during transition
            }}>
              <Box sx={{ 
                position: 'relative', 
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                padding: '0 4px', // Add some padding for content within header
              }}>
                {isSidebarOpen && (
                  <Button
                      size="small"
                      color="inherit"
                      onClick={() => {
                         setIsSidebarOpen(false);
                      }}
                      sx={{
                          borderRadius: '8px',
                          minWidth: 'auto',
                          width: '28px',
                          padding: '4px',
                          marginRight: '8px', // Space between close button and Add Track
                          '&:hover': {
                              backgroundColor: currentStudioTheme.palette.action.hover,
                          },
                      }}
                  >
                      <IconChevronLeftPipe size={20} />
                  </Button>
                )}
                {isSidebarOpen && (
                  <Button
                    startIcon={<AddIcon />}
                    variant="contained"
                    onClick={(e) => setAddMenuAnchor(e.currentTarget)}
                    sx={{
                      height: 24,
                      textTransform: 'none',
                      flexGrow: 1, 
                      display: 'flex',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      minWidth: 0, // Allow shrinking
                      overflow: 'hidden', // Prevent text overflow
                      textOverflow: 'ellipsis', // Add ellipsis for overflow
                      whiteSpace: 'nowrap', // Prevent wrapping
                    }}
                  >
                    Add Track
                  </Button>
                )}
                {/* Placeholder for right side balance when sidebar is open */}
                {isSidebarOpen && (
                  <Box
                    sx={{
                      width: '28px',
                      minWidth: '28px',
                      marginLeft: '8px', // Match marginRight of the left chevron
                    }}
                  />
                )}
                {!isSidebarOpen && (
                  <Button
                      size="small"
                      color="inherit"
                      onClick={() => {
                           setIsSidebarOpen(true);
                      }}
                      sx={{
                          borderRadius: '8px',
                          minWidth: 'auto',
                          width: '28px',
                          padding: '4px',
                          margin: 'auto', // Center the button when sidebar is collapsed
                          '&:hover': {
                              backgroundColor: currentStudioTheme.palette.action.hover,
                          },
                      }}
                  >
                      <IconChevronRightPipe size={20} />
                  </Button>
                )}
                {isSidebarOpen && (
                  <AddTrackMenu
                    isOpen={Boolean(addMenuAnchor)}
                    anchorEl={addMenuAnchor}
                    onClose={() => setAddMenuAnchor(null)}
                    onAddTrack={handleAddTrack}
                    onFileUpload={uploadAudioFile}
                  />
                )}
              </Box>
            </Box>

            {/* Track controls section */}
            {isSidebarOpen && (
              <Box sx={{ 
                flex: 1, 
                overflowY: 'auto', // Allow scrolling for track controls only when open
                overflowX: 'hidden',
              }}>
                <TrackControlsSidebar 
                  tracks={tracks}
                  onVolumeChange={handleTrackVolumeChange}
                  onPanChange={handleTrackPanChange}
                  onMuteToggle={handleTrackMuteToggle}
                  onSoloToggle={handleTrackSoloToggle}
                  onTrackDelete={handleTrackDelete}
                  onTrackNameChange={handleTrackNameChange}
                  onInstrumentChange={handleInstrumentChange}
                  onLoadAudioFile={handleLoadAudioFile}
                />
              </Box>
            )}
          </Box>
          
          {/* Spacer to maintain layout with fixed sidebar */}
          <Box sx={{ 
            width: isSidebarOpen ? GRID_CONSTANTS.sidebarWidth : COLLAPSED_SIDEBAR_WIDTH,
            flexShrink: 0,
            transition: 'width 0.3s ease-in-out', // Match transition for smoothness
          }} />

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
              // Update global state only when user explicitly changes time
              setCurrentTime(newTime);
              
              // Update transport position
              if (store && store.getTransport()) {
                store.getTransport().setPosition(newTime);
              }
              
              // Use imperative API to update cursor position
              if (scrollRef.current?.playbackCursor) {
                scrollRef.current.playbackCursor.seek(newTime);
              }
            }}
            gridLineStyle={{
              borderRight: `${GRID_CONSTANTS.borderWidth} solid ${GRID_CONSTANTS.borderColor}`
            }}
            ref={scrollRef}
          />
          
          {/* AI Assistant Chat Window - slides in from right */}
          <ChatWindow 
            isOpen={isChatOpen}
            onClose={handleChatToggle}
          />
          
          {/* Render the new piano roll windows directly in Studio */}
          <PianoRollWindows />
          <DrumMachineWindows />

        </Box>
        
        {/* Studio Settings Modal */}
        <StudioSettingsModal
          open={isSettingsModalOpen}
          onClose={handleSettingsToggle}
        />

        {/* Hidden file input for replacing track audio */}
        <input 
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelected}
          accept="audio/*" 
          style={{ display: 'none' }}
        />
      </Box>
    </MuiThemeProvider>
  );
}

// Always wrap with PianoRollModule for backward compatibility
const StudioWithPianoRoll = (props: StudioProps) => {
  return (
      <Studio {...props} />
  );
};

export default StudioWithPianoRoll;