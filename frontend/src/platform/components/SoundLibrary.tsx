import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  CircularProgress,
  Alert,
} from '@mui/material';
import { 
  MusicNote as MusicNoteIcon
} from '@mui/icons-material';
import { getSounds, deleteSound } from '../api/sounds';
import { AudioTrackRead } from '../../platform/types/track_models/audio_track';
import AudioTrackCard from './DisplayCards/AudioTrackCard';

interface SoundLibraryProps {
  onReload?: () => void;
}

export default function SoundLibrary({ onReload }: SoundLibraryProps) {
  const [sounds, setSounds] = useState<AudioTrackRead[]>([]);
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
  
  const handlePlaySound = (sound: AudioTrackRead) => {
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
    const url = `${baseUrl}/storage/v1/object/public/tracks/${sound.audio_file_storage_key}`;
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
            <AudioTrackCard
              sound={sound}
              playingId={playingId}
              currentTime={currentTime}
              duration={duration}
              handlePlaySound={handlePlaySound}
              handleDeleteSound={handleDeleteSound}
              handleSeek={handleSeek}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}