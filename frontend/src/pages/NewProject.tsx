import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, IconButton, Button, TextField, Tooltip } from '@mui/material';
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
import { ArrowBack, ChatBubble, ChatBubbleOutlineRounded, ChatBubbleRounded, Save, ViewSidebar, ViewSidebarRounded } from '@mui/icons-material';
import { SaveProjectButton } from '../components/SaveProjectButton';
import ChatWindow from '../components/chat/ChatWindow';
import { Timeline } from '../components/Timeline/Timeline';
import { useNavigate, useLocation } from 'react-router-dom';
import { TimeDisplay } from '../components/TimeDisplay';

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
  const [key, setKey] = useState<string>();
  const [zoomLevel, setZoomLevel] = useState(1);
  const [measureCount, setMeasureCount] = useState<number>(GRID_CONSTANTS.measureCount);
  const store = useStore();
  const animationFrameRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [projectTitle, setProjectTitle] = useState("Untitled Project");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [existingProjectId, setExistingProjectId] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

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

  // Parse query parameters for projectId
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const projectId = queryParams.get('projectId');
    if (projectId) {
      setExistingProjectId(projectId);
    }
  }, [location]);

  // Initialize store and potentially load existing project
  useEffect(() => {
    const initializeProject = async () => {
      // First create a default project
      store.projectManager.createProject('New Project');
      Tone.Transport.bpm.value = bpm;
      
      // If we have an existing project ID, try to load it
      if (existingProjectId) {
        try {
          // Import the getProject function here to avoid circular dependencies
          const { getProject } = await import('../api/projects');
          const project = await getProject(existingProjectId);
          
          // Update project metadata
          setProjectTitle(project.name);
          if (project.bpm) {
            setBpm(project.bpm);
            Tone.Transport.bpm.value = project.bpm;
          }
          
          if (project.time_signature_numerator && project.time_signature_denominator) {
            setTimeSignature([project.time_signature_numerator, project.time_signature_denominator]);
          }
          
          if (project.key_signature) {
            setKey(project.key_signature);
          }
          
          // Load tracks from project.tracks
          if (project.tracks && project.tracks.length > 0) {
            console.log('Loading tracks from project:', project.tracks);
            
            // Import the necessary modules
            const { getSounds } = await import('../api/sounds');
            
            try {
              // Get all user's sounds for reference
              const userSounds = await getSounds();
              console.log('User sounds:', userSounds);
              
              // Process each track in the project
              for (const trackData of project.tracks) {
                console.log('Processing track:', {
                  id: trackData.id,
                  name: trackData.name,
                  type: trackData.type,
                  volume: trackData.volume,
                  pan: trackData.pan,
                  mute: trackData.mute,
                  storage_key: trackData.storage_key,
                  y_position: trackData.y_position,
                  duration: trackData.duration
                });
                
                // Initialize audio before creating track
                await store.initializeAudio();
                
                if (trackData.type === 'audio' && trackData.storage_key) {
                  // This is an audio track with storage_key
                  console.log('Loading audio track with storage key:', trackData.storage_key);
                  
                  // Create the track in store
                  const newTrack = store.createTrack(trackData.name, 'audio');
                  
                  // Find the audio file URL using storage key
                  // storage_key format is audio/{user_id}/{track_id}.{extension}
                  const baseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://dsscfzvrjlyfktnrpukj.supabase.co';
                  const storageUrl = `${baseUrl}/storage/v1/object/public/tracks/${trackData.storage_key}`;
                  console.log('Audio URL:', storageUrl);
                  console.log('Track ID:', trackData.id);
                  
                  // Create an audio element to load the file with CORS handling
                  const audioEl = new Audio();
                  audioEl.crossOrigin = "anonymous"; // Important for CORS
                  audioEl.src = storageUrl;
                  
                  // Wait for metadata to load
                  await new Promise(resolve => {
                    audioEl.addEventListener('loadedmetadata', resolve);
                    audioEl.addEventListener('error', () => {
                      console.error('Error loading audio file:', audioEl.error);
                      resolve(null);
                    });
                  });
                  
                  // Create a blob from the audio element (via fetch)
                  let audioFile;
                  try {
                    console.log('Fetching audio file from URL:', storageUrl);
                    const response = await fetch(storageUrl, { 
                      mode: 'cors',
                      credentials: 'same-origin'
                    });
                    
                    if (!response.ok) {
                      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
                    }
                    
                    const blob = await response.blob();
                    audioFile = new File([blob], trackData.name, { type: 'audio/wav' });
                  } catch (error) {
                    console.error('Error fetching audio file:', error);
                    throw new Error(`Failed to load audio file: ${error.message}`);
                  }
                  
                  // Create the audio track using the file
                  const audioTrack = await store.getAudioEngine().createTrack(newTrack.id, audioFile);
                  
                  // Set track properties from saved data
                  const initialPosition = {
                    x: trackData.x_position || 0,
                    y: trackData.y_position || 0
                  };
                  
                  // Use volume and pan directly (already in 0-1 and -1 to 1 scale)
                  const volume = trackData.volume !== undefined ? trackData.volume : 1;
                  const pan = trackData.pan !== undefined ? trackData.pan : 0;
                  store.getAudioEngine().setTrackVolume(newTrack.id, volume);
                  store.getAudioEngine().setTrackPan(newTrack.id, pan);
                  store.getAudioEngine().setTrackMute(newTrack.id, trackData.mute || false);
                  
                  // Create track state object
                  const trackState: TrackState = {
                    ...newTrack,
                    ...audioTrack,
                    audioFile,
                    dbId: trackData.id, // Now it's a string so this works fine
                    duration: trackData.duration,
                    position: initialPosition,
                    volume: volume, // Use the volume value
                    pan: pan, // Use the pan value
                    muted: trackData.mute || false,
                    soloed: false, // We don't use solo anymore but it's still in the interface
                    _calculatedWidth: trackData.duration ? calculateTrackWidth(trackData.duration, bpm) : undefined
                  };
                  
                  // Set track position in the audio engine
                  store.getAudioEngine().setTrackPosition(
                    trackState.id,
                    initialPosition.x,
                    initialPosition.y
                  );
                  
                  // Add track to state
                  setTracks(prev => [...prev, trackState]);
                } else {
                  // Handle other track types
                  console.log('Loading non-audio track:', trackData);
                  
                  const newTrack = store.createTrack(trackData.name, trackData.type as TrackType['type']);
                  const audioTrack = await store.getAudioEngine().createTrack(newTrack.id);
                  
                  const initialPosition = {
                    x: trackData.x_position || 0,
                    y: trackData.y_position || 0
                  };
                  
                  // Use volume and pan directly (already in 0-1 and -1 to 1 scale)
                  const volume = trackData.volume !== undefined ? trackData.volume : 1;
                  const pan = trackData.pan !== undefined ? trackData.pan : 0;
                  store.getAudioEngine().setTrackVolume(newTrack.id, volume);
                  store.getAudioEngine().setTrackPan(newTrack.id, pan);
                  store.getAudioEngine().setTrackMute(newTrack.id, trackData.mute || false);
                  
                  const trackState: TrackState = {
                    ...newTrack,
                    ...audioTrack,
                    position: initialPosition,
                    duration: trackData.duration,
                    volume: volume, // Use the volume value
                    pan: pan, // Use the pan value
                    muted: trackData.mute || false,
                    soloed: false, // We don't use solo anymore but it's still in the interface
                    dbId: trackData.id, // Store ID for reference
                    _calculatedWidth: trackData.duration ? calculateTrackWidth(trackData.duration, bpm) : undefined
                  };
                  
                  // Set track position in the audio engine
                  store.getAudioEngine().setTrackPosition(
                    trackState.id,
                    initialPosition.x,
                    initialPosition.y
                  );
                  
                  // Add track to state
                  setTracks(prev => [...prev, trackState]);
                }
              }
            } catch (error) {
              console.error('Error loading tracks:', error);
            }
          }
          
          console.log('Loaded project:', project);
        } catch (error) {
          console.error('Failed to load project:', error);
        }
      }
      
      setIsInitialized(true);
    };
    
    initializeProject();

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
  }, [existingProjectId]);

  const handleAddTrack = async (trackTypeOrFile: string | File) => {
    if (!store || !isInitialized) {
      console.warn('Store not initialized');
      return;
    }

    try {
      // Initialize audio before creating track
      await store.initializeAudio();

      if (trackTypeOrFile instanceof File) {
        // Handle audio file
        const newTrack = store.createTrack('Audio Track', 'audio');
        const audioTrack = await store.getAudioEngine().createTrack(newTrack.id, trackTypeOrFile);
        
        // Save to database
        let dbId: string;
        let duration: number | undefined;
        
        if (trackTypeOrFile.type.includes('audio')) {
          duration = await db.getAudioDuration(trackTypeOrFile);
          const numericDbId = await db.addAudioFile(trackTypeOrFile, duration);
          dbId = numericDbId.toString(); // Convert numeric ID to string
          
          console.log('Adding audio track with duration:', {
            duration,
            bpm,
            expectedWidth: duration ? calculateTrackWidth(duration, bpm) : undefined
          });
        } else if (trackTypeOrFile.type.includes('midi')) {
          // For MIDI files, we could potentially extract tempo and time signature here
          const numericDbId = await db.addMidiFile(trackTypeOrFile);
          dbId = numericDbId.toString(); // Convert numeric ID to string
        } else {
          throw new Error('Unsupported file type');
        }

        // Create track data with initial position
        const initialPosition = {
          x: 0,
          y: tracks.length * GRID_CONSTANTS.trackHeight
        };
        
        const trackData: TrackState = {
          ...newTrack,
          ...audioTrack,
          audioFile: trackTypeOrFile,
          dbId,
          duration,
          position: initialPosition,
          // Calculate initial width based on duration and current BPM
          _calculatedWidth: duration ? calculateTrackWidth(duration, bpm) : undefined
        };
        
        // Make sure the AudioEngine knows the position
        store.getAudioEngine().setTrackPosition(
          trackData.id,
          initialPosition.x,
          initialPosition.y
        );

        // Create and execute the add track action
        const action = new AddTrackAction(store, trackData, setTracks);
        await historyManager.executeAction(action);

      } else {
        // Handle other track types
        const newTrack = store.createTrack(trackTypeOrFile, trackTypeOrFile as TrackType['type']);
        const audioTrack = await store.getAudioEngine().createTrack(newTrack.id);
        
        // Default duration for MIDI tracks (4 bars at 4/4 time signature = 16 beats)
        let defaultDuration;
        let dbId: string | undefined;
        
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
            const numericDbId = await db.addDrumMachineTrack(newTrack.id, `Drum Machine ${tracks.length + 1}`);
            dbId = numericDbId.toString(); // Convert numeric ID to string
          }
        }
        
        const initialPosition = {
          x: 0,
          y: tracks.length * GRID_CONSTANTS.trackHeight
        };
        
        const trackData: TrackState = {
          ...newTrack,
          ...audioTrack,
          position: initialPosition,
          duration: defaultDuration,
          _calculatedWidth: defaultDuration ? calculateTrackWidth(defaultDuration, bpm) : undefined,
          dbId
        };
        
        // Make sure the AudioEngine knows the position
        store.getAudioEngine().setTrackPosition(
          trackData.id,
          initialPosition.x,
          initialPosition.y
        );

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
      // During drag, update the state directly and notify AudioEngine
      setTracks(prev => prev.map(t => 
        t.id === trackId 
          ? { ...t, position: newPosition }
          : t
      ));
      
      // Update AudioEngine immediately during drag for responsive playback
      store.getAudioEngine().setTrackPosition(
        trackId,
        newPosition.x,
        newPosition.y
      );
      
      // Also tell the transport controller to adjust playback if playing
      store.getTransport().handleTrackPositionChange(trackId, newPosition.x);
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

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setProjectTitle(event.target.value);
    if (store) {
      store.projectManager.setProjectName(event.target.value);
    }
  };

  const handleChatToggle = () => {
    setIsChatOpen(prev => !prev);
  };

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
        zIndex: 1300, // Ensure nav bar stays on top
      }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Go back to Projects" arrow>
            <IconButton 
              size="small" 
              sx={{ color: 'white' }}
              onClick={() => {
                navigate('/projects');
              }}
            >
              <ArrowBack />
            </IconButton>
          </Tooltip>
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
          <IconButton 
            size="small" 
            sx={{ color: 'white' }}
            onClick={() => {
              if (store) {
                console.log('🎮 UI: Triggering stop');
                store.getTransport().stop();
                setIsPlaying(false);
                setCurrentTime(0);
              }
            }}
          >
            <SkipPreviousIcon />
          </IconButton>
        </Box>

        {/* Add this new title section */}
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

        {/* Remove the separate boxes and combine them */}
        <Box sx={{ 
          borderLeft: gridLineStyle.borderRight,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          marginLeft: 'auto'
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

          <TimeDisplay currentTime={currentTime} />

          <Box sx={{ 
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            pr: 2,
            gap: 2
          }}>
            <SaveProjectButton 
              projectTitle={projectTitle}
              bpm={bpm}
              timeSignature={timeSignature}
              tracks={tracks}
              projectId={existingProjectId || ""}
              keySignature={key}
              onSaved={(project) => {
                console.log('Project saved:', project);
                // Update the URL with the project ID
                if (!existingProjectId && project.id) {
                  navigate(`/studio?projectId=${project.id}`, { replace: true });
                  setExistingProjectId(project.id);
                }
              }}
            />
            <IconButton 
              size="small" 
              sx={{ color: 'white' }} 
              onClick={handleChatToggle}
            >
              {isChatOpen ? <ChatBubbleRounded /> : <ChatBubbleOutlineRounded />}
            </IconButton>
          </Box>
        </Box>
      </Box>

      {/* Main Content Area - Make this a relative container */}
      <Box sx={{ 
        display: 'flex', 
        flex: 1, 
        overflow: 'hidden',
        position: 'relative' // This is important for chat window positioning
      }}>
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
            p: 0.3,
            boxSizing: 'border-box'
          }}>
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              onClick={handleOpenMenu}
              sx={{
                bgcolor: '#1A1A1A',
                color: 'white',
                '&:hover': { bgcolor: '#444' },
                height: 24,
                textTransform: 'none',
                width: '100%',
                mx: 'auto',  // Add horizontal margin auto
                display: 'flex',
                fontSize: '12px',
                fontWeight: 'bold'
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
            const previousTime = currentTime;
            setCurrentTime(newTime);
            
            // Log detailed debug info
            console.log(`Changing playback position from ${previousTime}s to ${newTime}s (delta: ${newTime - previousTime}s)`, {
              store: !!store,
              transport: store ? !!store.getTransport() : false,
              hasSetPosition: store && store.getTransport() ? typeof store.getTransport().setPosition === 'function' : false,
              isPlaying: isPlaying
            });
            
            try {
              if (store && store.getTransport()) {
                store.getTransport().setPosition(newTime);
              }
            } catch (err) {
              console.error('Error setting transport position:', err);
            }
          }}
          gridLineStyle={gridLineStyle}
          ref={scrollRef}
        />

        {/* Chat Window - Move it inside the main content area */}
        <ChatWindow
          isOpen={isChatOpen}
          onClose={handleChatToggle}
        />
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