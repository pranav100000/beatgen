import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, FormControlLabel, Switch } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

// Import components
import TrackControlsSidebar from './components/sidebar/TrackControlsSidebar';
import { Timeline, TimelineRef } from './components/timeline/Timeline';
import AddTrackMenu from './components/sidebar/AddTrackMenu';
import { GRID_CONSTANTS } from './constants/gridConstants';
import { useStudioStore } from './stores/useStudioStore';

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

// Studio Component Props
interface StudioProps {
  projectId?: string;
}

// Main Studio Component
function Studio({ projectId }: StudioProps) {
  // Initialize DB session management
  useStudioDBSession();
  
  // Setup history state sync
  useHistorySync();
  
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
    handleInstrumentChange,
    uploadAudioFile,
    setBpm,
    setAddMenuAnchor,
    openDrumMachines,
    closeDrumMachine,
    setDrumPattern,
    // Fetch MIDI actions
    addMidiNote,
    removeMidiNote,
    updateMidiNote,
    replaceTrackAudioFile,
  } = useStudioStore();
  
  const scrollRef = useRef<TimelineRef>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [existingProjectId, setExistingProjectId] = useState<string | null>(projectId || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [trackIdForFileUpload, setTrackIdForFileUpload] = useState<string | null>(null);

  const handleChatToggle = () => {
    setIsChatOpen(prev => !prev);
  };

  // Initialize audio engine
  useEffect(() => {
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
    setProjectTitle(event.target.value);
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

  return (
    <Box sx={{ 
      height: '100vh', 
      bgcolor: '#000000', 
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <StudioControlBar
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
        onKeySignatureChange={setKeySignature}
        onPlayPause={playPause}
        onStop={stop}
        onTitleChange={handleTitleChange}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onChatToggle={handleChatToggle}
      />

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
              onInstrumentChange={handleInstrumentChange}
              onLoadAudioFile={handleLoadAudioFile}
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
        {<PianoRollWindows />}
        
        {/* Render open Drum Machine instances */}
        {Object.entries(openDrumMachines || {})
          .filter(([, isOpen]) => isOpen) 
          .map(([trackId]) => ( 
            <DrumMachine 
              key={trackId} 
              trackId={trackId} 
              onClose={() => closeDrumMachine(trackId)} 
              onPatternChange={setDrumPattern} 
              // Pass MIDI actions
              onAddNote={addMidiNote}
              onRemoveNote={removeMidiNote}
              onUpdateNote={updateMidiNote}
            />
        ))}

      </Box>
      
      {/* Hidden file input for replacing track audio */}
      <input 
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        accept="audio/*" 
        style={{ display: 'none' }}
      />
    </Box>
  );
}

// Always wrap with PianoRollModule for backward compatibility
const StudioWithPianoRoll = (props: StudioProps) => {
  return (
      <Studio {...props} />
  );
};

export default StudioWithPianoRoll;