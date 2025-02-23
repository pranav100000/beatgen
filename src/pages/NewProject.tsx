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
import { historyManager, AddTrackAction, DeleteTrackAction, MoveTrackAction } from '../core/state/history';
import { TrackState, Position } from '../core/types/track';

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

  const storeRef = useRef<Store | null>(null);
  const animationFrameRef = useRef<number | null>(null);

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
    storeRef.current = new Store();
    storeRef.current.projectManager.createProject('New Project');
    Tone.Transport.bpm.value = bpm;

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
    if (!storeRef.current || !isInitialized) {
      console.warn('Store not initialized');
      return;
    }

    try {
      if (trackTypeOrFile instanceof File) {
        // Handle audio file
        const newTrack = storeRef.current.createTrack('Audio Track', 'audio');
        const audioTrack = await storeRef.current.getAudioEngine().createTrack(newTrack.id, trackTypeOrFile);
        
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
        const action = new AddTrackAction(storeRef.current, trackData, setTracks);
        await historyManager.executeAction(action);

      } else {
        // Handle other track types
        const newTrack = storeRef.current.createTrack(trackTypeOrFile, trackTypeOrFile as TrackType['type']);
        const audioTrack = await storeRef.current.getAudioEngine().createTrack(newTrack.id);
        
        const trackData: TrackState = {
          ...newTrack,
          ...audioTrack,
          position: {
            x: 0,
            y: tracks.length * GRID_CONSTANTS.trackHeight
          }
        };

        // Create and execute the add track action
        const action = new AddTrackAction(storeRef.current, trackData, setTracks);
        await historyManager.executeAction(action);
      }
    } catch (error) {
      console.error('Failed to create track:', error);
    }
  };

  const handleDeleteTrack = async (indexToDelete: number) => {
    const trackToDelete = tracks[indexToDelete];
    if (trackToDelete && storeRef.current) {
      // Create and execute the delete track action
      const action = new DeleteTrackAction(storeRef.current, trackToDelete, setTracks);
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

  const handleOpenMenu = async (event: React.MouseEvent<HTMLButtonElement>) => {
    // Initialize audio on first click if needed
    if (!isInitialized && storeRef.current) {
      try {
        await storeRef.current.initialize();
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize audio:', error);
      }
    }
    setAnchorEl(event.currentTarget);
    setMenuOpen(true);
  };

  const handleCloseMenu = () => {
    setMenuOpen(false);
    setAnchorEl(null);
  };

  const handlePlayPause = async () => {
    if (!storeRef.current) return;

    const transport = storeRef.current.getTransport();
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
    if (!isPlaying || !storeRef.current) return;

    const updateTime = () => {
      const transport = storeRef.current?.getTransport();
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
    if (!storeRef.current) return;
    storeRef.current.getAudioEngine().setTrackVolume(trackId, volume);
    setTracks(currentTracks => 
      currentTracks.map(track => 
        track.id === trackId ? { ...track, volume } : track
      )
    );
  }, []);

  const handlePanChange = useCallback((trackId: string, pan: number) => {
    if (!storeRef.current) return;
    storeRef.current.getAudioEngine().setTrackPan(trackId, pan);
    setTracks(currentTracks => 
      currentTracks.map(track => 
        track.id === trackId ? { ...track, pan } : track
      )
    );
  }, []);

  const handleMute = useCallback((trackId: string, muted: boolean) => {
    if (!storeRef.current) return;
    storeRef.current.getAudioEngine().setTrackMute(trackId, muted);
    setTracks(currentTracks => 
      currentTracks.map(track => 
        track.id === trackId ? { ...track, muted } : track
      )
    );
  }, []);

  const handleSolo = useCallback((trackId: string, soloed: boolean) => {
    if (!storeRef.current) return;
    setTracks(currentTracks => 
      currentTracks.map(track => 
        track.id === trackId ? { ...track, soloed } : track
      )
    );
  }, []);

  const handleTrackNameChange = useCallback((trackId: string, name: string) => {
    if (!storeRef.current) return;
    storeRef.current.getAudioEngine().setTrackName(trackId, name);
    setTracks(currentTracks => 
      currentTracks.map(track => 
        track.id === trackId ? { ...track, name } : track
      )
    );
  }, []);

  const handleBpmChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newBpm = parseInt(event.target.value, 10);
    if (!isNaN(newBpm) && newBpm > 0 && newBpm <= 999) {
      console.log('BPM changing to:', newBpm);
      if (storeRef.current) {
        // Update Tone.js transport BPM
        Tone.getTransport().bpm.value = newBpm;
        
        // Update tracks first to ensure they have the latest BPM value
        setTracks(currentTracks => {
          console.log('Updating tracks with new BPM:', newBpm);
          return currentTracks.map(track => {
            if (!track.duration) return track;
            
            // Calculate new width based on duration and new BPM
            const expectedWidth = calculateTrackWidth(track.duration, newBpm);
            console.log(`Track ${track.id} width calculation for BPM change:`, {
              duration: track.duration,
              oldBpm: bpm,
              newBpm,
              expectedWidth,
              oldWidth: track._calculatedWidth
            });
            
            // Create a completely new track object to force React to see it as a change
            return {
              ...track,
              position: { ...track.position },
              _calculatedWidth: expectedWidth,
              _bpmUpdateId: Date.now() // Force React to see this as a new object
            };
          });
        });
        
        // Then update the BPM state
        setBpm(newBpm);
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
    if (storeRef.current) {
      storeRef.current.projectManager.setTimeSignature(
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
    if (!track || !storeRef.current) return;

    if (isDragEnd && !positionsAreEqual(track.position, newPosition)) {
      // Only create a history event when the drag ends
      const oldPosition = track.position;
      const action = new MoveTrackAction(
        storeRef.current,
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
          <Box sx={{ opacity: 0.7 }}>bpm</Box>
        </Box>

        <TimeSignatureDisplay 
          topNumber={timeSignature[0]} 
          bottomNumber={timeSignature[1]}
          onTopNumberChange={(value) => handleTimeSignatureChange(value, undefined)}
          onBottomNumberChange={(value) => handleTimeSignatureChange(undefined, value)}
        />

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
                textTransform: 'none'
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
        <Box sx={{ flex: 1, position: 'relative', overflow: 'auto' }}>
          {/* Time Markers */}
          <Box sx={{ 
            display: 'flex',
            position: 'sticky',
            top: 0,
            bgcolor: '#000',
            zIndex: 2,
            height: GRID_CONSTANTS.headerHeight,
            boxSizing: 'border-box'
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
              overflow: 'hidden'
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