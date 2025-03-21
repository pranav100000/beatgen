import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, IconButton, Button, TextField } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import PauseIcon from '@mui/icons-material/Pause';
import LoopIcon from '@mui/icons-material/Loop';
import AddIcon from '@mui/icons-material/Add';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import Track from '../components/Track';
import AddTrackMenu from '../components/AddTrackMenu';
import { GRID_CONSTANTS, calculateTrackWidth } from '../constants/gridConstants';
import PlaybackCursor from '../components/PlaybackCursor';
import { Store } from '../core/state/store';
import { Track as TrackType } from '../core/state/project';
import { TrackControlsSidebar } from '../components/Sidebar/TrackControlsSidebar';
import { AudioTrack } from '../core/audio-engine/audioEngine';
import * as Tone from 'tone';
import BPMControl from '../components/BPMControl';
import TimeSignatureDisplay from '../components/TimeSignatureDisplay';
import { db } from '../core/db/dexie-client';
import { historyManager } from '../core/state/history/HistoryManager';
import { AddTrackAction, DeleteTrackAction, MoveTrackAction } from '../core/state/history/actions/TrackActions';
import { BPMChangeAction } from '../core/state/history/actions/BPMActions';
import { TrackState, Position } from '../core/types/track';
import KeySelector from '../components/KeySelector';
import { PianoRollProvider } from '../components/piano-roll/PianoRollWindow';
import { StoreProvider } from '../core/state/StoreContext';
import { useStore } from '../core/state/StoreContext';

function NewProject() {
  const [tracks, setTracks] = useState<TrackState[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [bpm, setBpm] = useState<number>(120);
  const [timeSignature, setTimeSignature] = useState<[number, number]>([4, 4]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [key, setKey] = useState<string>('C');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [measureCount, setMeasureCount] = useState<number>(GRID_CONSTANTS.measureCount);
  const store = useStore();
  const animationFrameRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Update undo/redo state whenever history changes
  useEffect(() => {
    const updateHistoryState = () => {
      setCanUndo(historyManager.canUndo());
      setCanRedo(historyManager.canRedo());
    };

    // Initial state
    updateHistoryState();

    // Subscribe to history changes
    historyManager.subscribe(updateHistoryState);

    return () => {
      historyManager.unsubscribe(updateHistoryState);
    };
  }, []);

  // Initialize store only (not audio) on mount
  useEffect(() => {
    const initializeStore = async () => {
      try {
        if (!store.projectManager.getCurrentProject()) {
          store.projectManager.createProject('New Project');
        }
        Tone.Transport.bpm.value = bpm;
        
        // Initialize audio immediately
        await store.initialize();
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize store:', error);
      }
    };

    initializeStore();

    // Clear database on window unload/refresh
    const handleUnload = async () => {
      console.log('🧹 Cleaning up database...');
      try {
        await db.clearAllFiles();
      } catch (error) {
        console.error('Failed to clear database:', error);
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  const handleAddTrack = async (trackTypeOrFile: string | File) => {
    if (!store || !isInitialized) {
      console.warn('Store not initialized');
      return;
    }

    try {
      if (trackTypeOrFile instanceof File) {
        // Handle audio file
        const newTrack = store.createTrack('Audio Track', 'audio');
        const audioTrack = await store.getAudioEngine().createTrack(newTrack.id, trackTypeOrFile);
        
        // Save to database
        let dbId: number;
        let duration: number | undefined;
        
        if (trackTypeOrFile.type.includes('audio')) {
          duration = await db.getAudioDuration(trackTypeOrFile);
          dbId = await db.addAudioFile(trackTypeOrFile, duration);
          
          console.log('Adding audio track with duration:', {
            duration,
            bpm,
            expectedWidth: duration ? calculateTrackWidth(duration, bpm) : undefined
          });
        } else if (trackTypeOrFile.type.includes('midi')) {
          // For MIDI files, we could potentially extract tempo and time signature here
          dbId = await db.addMidiFile(trackTypeOrFile);
        } else {
          throw new Error('Unsupported file type');
        }

        // Create track data with initial position
        const trackData: TrackState = {
          ...newTrack,
          ...audioTrack,
          audioFile: trackTypeOrFile,
          dbId,
          duration,
          position: {
            x: 0,
            y: tracks.length * GRID_CONSTANTS.trackHeight
          },
          // Calculate initial width based on duration and current BPM
          _calculatedWidth: duration ? calculateTrackWidth(duration, bpm) : undefined
        };

        // Create and execute the add track action
        const action = new AddTrackAction(store, trackData, setTracks);
        await historyManager.executeAction(action);

      } else {
        // Handle other track types
        const newTrack = store.createTrack(trackTypeOrFile, trackTypeOrFile as TrackType['type']);
        const audioTrack = await store.getAudioEngine().createTrack(newTrack.id);
        
        // Default duration for MIDI tracks (4 bars at 4/4 time signature = 16 beats)
        let defaultDuration;
        let dbId: number | undefined;
        
        if (trackTypeOrFile === 'midi' || trackTypeOrFile === 'drum') {
          // Convert beats to seconds based on current BPM
          // Duration = (beats * 60) / BPM
          const beatsPerBar = 4; // Assuming 4/4 time signature
          const defaultBars = 4;
          const totalBeats = defaultBars * beatsPerBar;
          defaultDuration = (totalBeats * 60) / bpm;
          
          const trackTypeLabel = trackTypeOrFile === 'midi' ? 'MIDI' : 'Drum Machine';
          console.log(`Creating ${trackTypeLabel} track with default duration:`, {
            defaultBars,
            totalBeats,
            bpm,
            defaultDuration,
            expectedWidth: calculateTrackWidth(defaultDuration, bpm)
          });
          
          // Add record to database based on track type
          if (trackTypeOrFile === 'drum') {
            dbId = await db.addDrumMachineTrack(newTrack.id, `Drum Machine ${tracks.length + 1}`);
          }
        }
        
        const trackData: TrackState = {
          ...newTrack,
          ...audioTrack,
          position: {
            x: 0,
            y: tracks.length * GRID_CONSTANTS.trackHeight
          },
          duration: defaultDuration,
          _calculatedWidth: defaultDuration ? calculateTrackWidth(defaultDuration, bpm) : undefined,
          dbId
        };

        // Create and execute the add track action
        const action = new AddTrackAction(store, trackData, setTracks);
        await historyManager.executeAction(action);
      }
    } catch (error) {
      console.error('Failed to create track:', error);
    }
  };

  const handleDeleteTrack = async (indexToDelete: number) => {
    const trackToDelete = tracks[indexToDelete];
    if (trackToDelete && store) {
      // Create and execute the delete track action
      const action = new DeleteTrackAction(store, trackToDelete, setTracks);
      await historyManager.executeAction(action);
    }
  };

  const handleUndo = async () => {
    if (historyManager.canUndo()) {
      await historyManager.undo();
    }
  };

  const handleRedo = async () => {
    if (historyManager.canRedo()) {
      await historyManager.redo();
    }
  };

  const handleOpenMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!isInitialized) {
      console.warn('Store not initialized yet');
      return;
    }
    setAnchorEl(event.currentTarget);
    setMenuOpen(true);
  };

  const handleCloseMenu = () => {
    setMenuOpen(false);
    setAnchorEl(null);
  };

  const handlePlayPause = async () => {
    if (!store) return;

    const transport = store.getTransport();
    try {
      if (!isPlaying) {
        console.log('🎮 UI: Triggering play');
        await transport.play();
        setIsPlaying(true);
      } else {
        console.log('🎮 UI: Triggering pause');
        transport.pause();
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('Playback control failed:', error);
    }
  };

  // Update UI time display based on transport position
  useEffect(() => {
    if (!isPlaying || !store) return;

    const updateTime = () => {
      const transport = store?.getTransport();
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
  }, [isPlaying]);

  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    const tenths = Math.floor((timeInSeconds * 10) % 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${tenths}`;
  };

  const gridLineStyle = {
    borderRight: `${GRID_CONSTANTS.borderWidth} solid ${GRID_CONSTANTS.borderColor}`,
  };

  // Add these handlers
  const handleVolumeChange = useCallback((trackId: string, volume: number) => {
    if (!store) return;
    store.getAudioEngine().setTrackVolume(trackId, volume);
    setTracks(currentTracks => 
      currentTracks.map(track => 
        track.id === trackId ? { ...track, volume } : track
      )
    );
  }, []);

  const handlePanChange = useCallback((trackId: string, pan: number) => {
    if (!store) return;
    store.getAudioEngine().setTrackPan(trackId, pan);
    setTracks(currentTracks => 
      currentTracks.map(track => 
        track.id === trackId ? { ...track, pan } : track
      )
    );
  }, []);

  const handleMute = useCallback((trackId: string, muted: boolean) => {
    if (!store) return;
    store.getAudioEngine().setTrackMute(trackId, muted);
    setTracks(currentTracks => 
      currentTracks.map(track => 
        track.id === trackId ? { ...track, muted } : track
      )
    );
  }, []);

  const handleSolo = useCallback((trackId: string, soloed: boolean) => {
    if (!store) return;
    setTracks(currentTracks => 
      currentTracks.map(track => 
        track.id === trackId ? { ...track, soloed } : track
      )
    );
  }, []);

  const handleTrackNameChange = useCallback((trackId: string, name: string) => {
    if (!store) return;
    store.getAudioEngine().setTrackName(trackId, name);
    setTracks(currentTracks => 
      currentTracks.map(track => 
        track.id === trackId ? { ...track, name } : track
      )
    );
  }, []);

  const handleBpmChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newBpm = parseInt(event.target.value, 10);
    if (!isNaN(newBpm) && newBpm > 0 && newBpm <= 999) {
      console.log('BPM changing to:', newBpm);
      if (store) {
        // Create and execute the BPM change action
        const action = new BPMChangeAction(
          store,
          setBpm,
          setTracks,
          bpm, // old BPM
          newBpm // new BPM
        );
        await historyManager.executeAction(action);
        // Track widths are now recalculated inside the BPMChangeAction
      }
    }
  };

  const handleTimeSignatureChange = (numerator?: number, denominator?: number) => {
    const [currentNumerator, currentDenominator] = timeSignature;
    const newTimeSignature: [number, number] = [
      numerator ?? currentNumerator,
      denominator ?? currentDenominator
    ];
    
    setTimeSignature(newTimeSignature);
    if (store) {
      store.projectManager.setTimeSignature(
        newTimeSignature[0],
        newTimeSignature[1]
      );
      // Update Tone.js time signature if needed
      Tone.getTransport().timeSignature = [newTimeSignature[0], newTimeSignature[1]];
    }
  };

  const positionsAreEqual = (p1: Position, p2: Position): boolean => {
    return p1.x === p2.x && p1.y === p2.y;
  };

  const handleTrackPositionChange = async (trackId: string, newPosition: Position, isDragEnd: boolean) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track || !store) return;

    if (isDragEnd && !positionsAreEqual(track.position, newPosition)) {
      // Only create a history event when the drag ends
      const oldPosition = track.position;
      const action = new MoveTrackAction(
        store,
        setTracks,
        trackId,
        oldPosition,
        newPosition
      );
      await historyManager.executeAction(action);
    } else {
      // During drag, just update the state directly
      setTracks(prev => prev.map(t => 
        t.id === trackId 
          ? { ...t, position: newPosition }
          : t
      ));
    }
  };

  const handleKeyChange = (newKey: string) => {
    setKey(newKey);
    if (store) {
      store.projectManager.setKey(newKey);
    }
  };

  const handleZoomIn = () => {
    setZoomLevel((prevZoom) => Math.min(prevZoom + 0.1, 4)); // Zoom in by 10%, max at 2x
  };

  // Function to zoom out
  const handleZoomOut = () => {
    setZoomLevel((prevZoom) => Math.max(prevZoom - 0.1, 0.3)); // Zoom out by 10%, min at 0.5x
  };

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;

    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;

    if (scrollLeft + clientWidth >= scrollWidth - 100) {
      setMeasureCount((prev) => prev + 20);
    }
  }, []);

  useEffect(() => {
    if (tracks.length === 0) return;
    const maxTrackWidth = Math.max(...tracks.map(track => track._calculatedWidth || 0));

    const newMeasureCount = Math.ceil(maxTrackWidth / GRID_CONSTANTS.measureWidth);

    if (newMeasureCount > measureCount) {
      setMeasureCount(newMeasureCount);
    }
  }, [tracks, measureCount]);

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
      flexDirection: 'column'
    }}>
      {/* Top Control Bar */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        p: 1, 
        borderBottom: '1px solid #333',
        gap: 2,
        paddingLeft: 2,
      }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton 
            size="small" 
            sx={{ color: canUndo ? 'white' : '#666' }}
            onClick={handleUndo}
            disabled={!canUndo}
          >
            <UndoIcon />
          </IconButton>
          <IconButton 
            size="small" 
            sx={{ color: canRedo ? 'white' : '#666' }}
            onClick={handleRedo}
            disabled={!canRedo}
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

        <KeySelector selectedKey={key} onKeyChange={handleKeyChange} />

        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton 
            size="small" 
            sx={{ color: 'white' }}
            onClick={handlePlayPause}
          >
            {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
          </IconButton>
          <IconButton size="small" sx={{ color: 'white' }}>
            <SkipPreviousIcon />
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
          bgcolor: '#1A1A1A',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header section with Add Track button */}
          <Box sx={{
            height: GRID_CONSTANTS.headerHeight,
            borderBottom: gridLineStyle.borderRight,
            display: 'flex',
            alignItems: 'center',
            p: 1.5,
            boxSizing: 'border-box'
          }}>
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              onClick={handleOpenMenu}
              sx={{
                bgcolor: '#333',
                color: 'white',
                '&:hover': { bgcolor: '#444' },
                height: 36,
                textTransform: 'none',
                width: '100%'
              }}
            >
              Add Track
            </Button>
          </Box>

          {/* Track controls section */}
          <Box sx={{ 
            flex: 1, 
            overflow: 'auto',
            px: 1.5,
            py: 0
          }}>
            <TrackControlsSidebar
              tracks={tracks}
              onVolumeChange={handleVolumeChange}
              onPanChange={handlePanChange}
              onMute={handleMute}
              onSolo={handleSolo}
              onTrackNameChange={handleTrackNameChange}
              onDeleteTrack={handleDeleteTrack}
            />
          </Box>
        </Box>

        {/* Timeline Area */}
        <Box sx={{ flex: 1, position: 'relative', overflow: 'auto' }} ref={scrollRef}>
          {/* Time Markers */}
          <Box sx={{ 
            display: 'flex',
            position: 'sticky',
            top: 0,
            bgcolor: '#000',
            zIndex: 2,
            height: GRID_CONSTANTS.headerHeight,
            boxSizing: 'border-box',
            transform: `scaleX(${zoomLevel})`,
            willChange: "transform",
            imageRendering: "crisp-edges",
            transformOrigin: "top left",
          }}>
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
                    width: 2,
                    height: '1',
                    bgcolor: GRID_CONSTANTS.borderColor,
                    zIndex: 10
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
              position: 'relative',
              overflow: 'hidden',
              transform: `scaleX(${zoomLevel})`,
              willChange: "transform",
              imageRendering: "crisp-edges",
              transformOrigin: "top left",
            }}>
              {/* Grid Overlay */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  pointerEvents: 'none',
                  zIndex: 1000
                }}
              >
                {/* Major grid lines (measures) */}
                {Array.from({ length: GRID_CONSTANTS.measureCount + 1 }).map((_, i) => (
                  <Box
                    key={`major-${i}`}
                    sx={{
                      position: 'absolute',
                      left: `${i * GRID_CONSTANTS.measureWidth}px`,
                      top: 0,
                      bottom: 0,
                      width: '1px',
                      bgcolor: GRID_CONSTANTS.borderColor,
                      opacity: 1,
                      zIndex: 1000
                    }}
                  />
                ))}

                {/* Minor grid lines (beats) */}
                {Array.from({ length: GRID_CONSTANTS.measureCount * GRID_CONSTANTS.gridSubdivisions }).map((_, i) => {
                  if (i % GRID_CONSTANTS.gridSubdivisions !== 0) { // Skip positions where major lines exist
                    return (
                      <Box
                        key={`minor-${i}`}
                        sx={{
                          position: 'absolute',
                          left: `${i * (GRID_CONSTANTS.measureWidth / GRID_CONSTANTS.gridSubdivisions)}px`,
                          top: 0,
                          bottom: 0,
                          width: '1px',
                          bgcolor: GRID_CONSTANTS.borderColor,
                          opacity: 0.3,
                          zIndex: 1000
                        }}
                      />
                    );
                  }
                  return null;
                })}
              </Box>

              <PlaybackCursor currentTime={currentTime} />

              {tracks.map((track, index) => (
                <Track 
                  key={track.id}
                  id={track.id}
                  index={index}
                  type={track.type}
                  audioFile={track.audioFile}
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  gridLineStyle={gridLineStyle}
                  measureCount={GRID_CONSTANTS.measureCount}
                  position={track.position}
                  onPositionChange={(newPosition, isDragEnd) => handleTrackPositionChange(track.id, newPosition, isDragEnd)}
                  bpm={bpm}
                  duration={track.duration}
                  _calculatedWidth={track._calculatedWidth}
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
          <IconButton size="small" sx={{ color: 'white' }} onClick={handleZoomIn}>
            <ZoomInIcon />
          </IconButton>
          <Box sx={{ color: "white", fontWeight: "bold", backgroundColor: "#333", minWidth: 40, textAlign: "center", border: "1px solid rgba(255, 255, 255, 0.2)", padding: "4px 4px", borderRadius: "6px", marginRight: '2px' }}>
            {zoomLevel.toFixed(1)}x
          </Box>
          <IconButton size="small" sx={{ color: 'white' }} onClick={handleZoomOut}>
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

export default function NewProjectWithProvider() {
  // Create a single store instance for the entire application
  const store = useRef(new Store()).current;
  
  // Log the store instance for debugging
  console.log('Store instance in NewProjectWithProvider:', store);
  
  return (
    <StoreProvider store={store}>
      <PianoRollProvider>
        <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
          <Box sx={{ position: 'absolute', top: 10, right: 10, zIndex: 1000 }}>
          </Box>
          <NewProject />
        </Box>
      </PianoRollProvider>
    </StoreProvider>
  );
} 