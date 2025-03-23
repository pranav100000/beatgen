import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  IconButton,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material';
import { 
  PlayArrow as PlayIcon, 
  Pause as PauseIcon, 
  Delete as DeleteIcon,
  MusicNote as MusicNoteIcon
} from '@mui/icons-material';
import { getSounds, deleteSound } from '../api/sounds';
import { Sound } from '../types/sound';

// Enhanced waveform component with progress and click handling
const Waveform = ({ 
  data, 
  playing = false, 
  progress = 0, 
  duration = 0,
  onSeek
}: { 
  data: number[], 
  playing?: boolean, 
  progress?: number, 
  duration?: number,
  onSeek?: (position: number) => void 
}) => {
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  
  // Calculate current position as percentage
  const progressPercent = duration > 0 ? (progress / duration) : 0;
  
  // Handle mouse move to show time indicator
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!waveformRef.current || !onSeek) return;
    
    const rect = waveformRef.current.getBoundingClientRect();
    const position = (e.clientX - rect.left) / rect.width;
    setHoverPosition(position);
  };
  
  // Handle click to seek
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!waveformRef.current || !onSeek || !duration) return;
    
    const rect = waveformRef.current.getBoundingClientRect();
    const position = (e.clientX - rect.left) / rect.width;
    onSeek(position * duration);
  };
  
  // Format time for hover display
  const formatHoverTime = (position: number): string => {
    if (!duration) return "0:00";
    const seconds = Math.floor(position * duration);
    return formatTime(seconds);
  };
  
  return (
    <Box 
      ref={waveformRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverPosition(null)}
      sx={{ 
        height: 40, 
        width: '100%', 
        display: 'flex', 
        alignItems: 'flex-end',
        position: 'relative',
        marginTop: 1,
        marginBottom: 1,
        cursor: onSeek ? 'pointer' : 'default',
      }}
    >
      {/* Waveform bars */}
      {data.map((value, index) => (
        <Box 
          key={index}
          sx={{
            height: `${Math.max(3, value * 40)}px`,
            width: '100%',
            flex: 1,
            backgroundColor: index < (data.length * progressPercent) ? '#6a3de8' : '#555',
            mx: '1px',
            transition: 'background-color 0.1s ease'
          }}
        />
      ))}
      
      {/* Time indicator on hover */}
      {hoverPosition !== null && (
        <Box sx={{
          position: 'absolute',
          bottom: '100%',
          left: `${hoverPosition * 100}%`,
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '0.7rem',
          marginBottom: '4px'
        }}>
          {formatHoverTime(hoverPosition)}
        </Box>
      )}
      
      {/* Playback position indicator */}
      {playing && progress > 0 && (
        <Box sx={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${progressPercent * 100}%`,
          width: '2px',
          backgroundColor: '#fff',
          zIndex: 2
        }} />
      )}
    </Box>
  );
};

// Format time in mm:ss
const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Format file size
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface SoundLibraryProps {
  onReload?: () => void;
}

export default function SoundLibrary({ onReload }: SoundLibraryProps) {
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Load sounds on mount
  useEffect(() => {
    loadSounds();
  }, []);
  
  // Set up timeupdate listener for tracking playback progress
  useEffect(() => {
    if (!audioElement) return;
    
    const handleTimeUpdate = () => {
      setCurrentTime(audioElement.currentTime);
    };
    
    const handleDurationChange = () => {
      setDuration(audioElement.duration);
    };
    
    const handleEnded = () => {
      setPlayingId(null);
      setCurrentTime(0);
    };
    
    // Add event listeners
    audioElement.addEventListener('timeupdate', handleTimeUpdate);
    audioElement.addEventListener('durationchange', handleDurationChange);
    audioElement.addEventListener('ended', handleEnded);
    
    // Clean up listeners
    return () => {
      audioElement.removeEventListener('timeupdate', handleTimeUpdate);
      audioElement.removeEventListener('durationchange', handleDurationChange);
      audioElement.removeEventListener('ended', handleEnded);
      audioElement.pause();
    };
  }, [audioElement]);
  
  const loadSounds = async () => {
    try {
      setLoading(true);
      setError(null);
      const loadedSounds = await getSounds();
      setSounds(loadedSounds);
    } catch (err) {
      setError(`Failed to load sounds: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handlePlaySound = (sound: Sound) => {
    // If we're already playing this sound, pause it
    if (playingId === sound.id && audioElement) {
      audioElement.pause();
      setPlayingId(null);
      return;
    }
    
    // If we have another sound playing, stop it
    if (audioElement) {
      audioElement.pause();
      setCurrentTime(0);
    }
    
    // Create a new audio element
    const audio = new Audio();
    
    // Construct URL from storage key
    const baseUrl = process.env.REACT_APP_SUPABASE_URL || '';
    const url = `${baseUrl}/storage/v1/object/public/tracks/${sound.storage_key}`;
    console.log('Audio URL:', url);
    
    // Add CORS headers
    audio.crossOrigin = "anonymous";
    audio.src = url;
    
    // Preload metadata to get duration faster
    audio.preload = "metadata";
    
    // Add error event listener for debugging
    audio.addEventListener('error', (e) => {
      console.error('Audio error details:', audio.error);
      setError(`Failed to play sound: ${audio.error?.message || 'Unknown error'}`);
    });
    
    audio.play().catch(err => {
      console.error('Failed to play sound:', err);
      setError(`Failed to play sound: ${err.message}`);
    });
    
    setAudioElement(audio);
    setPlayingId(sound.id);
    setCurrentTime(0);
  };
  
  // Handle seeking when user clicks on waveform
  const handleSeek = (soundId: string, position: number) => {
    if (!audioElement || playingId !== soundId) return;
    
    // Set the current time of the audio
    audioElement.currentTime = position;
    setCurrentTime(position);
  };
  
  const handleDeleteSound = async (id: string) => {
    // Stop playback if this is the sound being played
    if (playingId === id && audioElement) {
      audioElement.pause();
      setPlayingId(null);
    }
    
    try {
      await deleteSound(id);
      setSounds(sounds.filter(sound => sound.id !== id));
      if (onReload) {
        onReload();
      }
    } catch (err) {
      setError(`Failed to delete sound: ${(err as Error).message}`);
    }
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }
  
  if (sounds.length === 0) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
        height: '100%'
      }}>
        <MusicNoteIcon sx={{ fontSize: 60, color: '#666', mb: 2 }} />
        <Typography variant="h6" gutterBottom sx={{ color: '#ccc' }}>
          No sounds in your library
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center">
          Upload some sounds to get started
        </Typography>
      </Box>
    );
  }
  
  return (
    <Box sx={{ mt: 2 }}>
      <Grid container spacing={2}>
        {sounds.map((sound) => (
          <Grid item xs={12} sm={6} md={4} key={sound.id}>
            <Card sx={{ 
              bgcolor: '#1a1a1a', 
              borderRadius: 2,
              '&:hover': {
                boxShadow: '0 5px 15px rgba(0,0,0,0.2)'
              }
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6" sx={{ color: 'white', fontSize: '1rem' }}>
                    {sound.name}
                  </Typography>
                  <Box>
                    <IconButton 
                      size="small" 
                      onClick={() => handlePlaySound(sound)}
                      sx={{ color: playingId === sound.id ? '#6a3de8' : 'white' }}
                    >
                      {playingId === sound.id ? <PauseIcon /> : <PlayIcon />}
                    </IconButton>
                    <IconButton 
                      size="small" 
                      onClick={() => handleDeleteSound(sound.id)}
                      sx={{ color: 'white' }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </Box>
                
                <Waveform 
                  data={sound.waveform_data} 
                  playing={playingId === sound.id}
                  progress={playingId === sound.id ? currentTime : 0}
                  duration={playingId === sound.id ? (duration || sound.duration) : sound.duration}
                  onSeek={(position) => handleSeek(sound.id, position)}
                />
                
                {/* Current playback time display */}
                {playingId === sound.id && (
                  <Typography variant="body2" sx={{ 
                    textAlign: 'center', 
                    color: '#6a3de8',
                    fontSize: '0.75rem',
                    mt: 0.5
                  }}>
                    {formatTime(currentTime)} / {formatTime(duration || sound.duration)}
                  </Typography>
                )}
                
                <Divider sx={{ my: 1, bgcolor: '#444' }} />
                
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  color: '#aaa',
                  fontSize: '0.8rem'
                }}>
                  <Typography variant="body2" sx={{ color: '#aaa' }}>
                    {formatTime(sound.duration)}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#aaa' }}>
                    {sound.file_format} · {formatFileSize(sound.file_size)}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}