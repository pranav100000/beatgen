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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface SoundLibraryProps {
  onReload?: () => void;
  sectionColor: string;
}

export default function SoundLibrary({ onReload, sectionColor }: SoundLibraryProps) {
  const queryClient = useQueryClient();

  const [sounds, setSounds] = useState<AudioTrackRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const { 
    data: soundsData = [],
    isLoading, 
    error: fetchError 
  } = useQuery<AudioTrackRead[], Error>({
    queryKey: ['sounds'],
    queryFn: getSounds,
  });
  
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
    
    audioElement.addEventListener('timeupdate', handleTimeUpdate);
    audioElement.addEventListener('durationchange', handleDurationChange);
    audioElement.addEventListener('ended', handleEnded);
    
    return () => {
      audioElement.removeEventListener('timeupdate', handleTimeUpdate);
      audioElement.removeEventListener('durationchange', handleDurationChange);
      audioElement.removeEventListener('ended', handleEnded);
      audioElement.pause();
    };
  }, [audioElement]);
  
  const handlePlaySound = (sound: AudioTrackRead) => {
    if (playingId === sound.id && audioElement) {
      audioElement.pause();
      setPlayingId(null);
      return;
    }
    
    if (audioElement) {
      audioElement.pause();
      setCurrentTime(0);
    }
    
    const audio = new Audio();
    
    const baseUrl = process.env.REACT_APP_SUPABASE_URL || '';
    const url = `${baseUrl}/storage/v1/object/public/tracks/${sound.audio_file_storage_key}`;
    console.log('Audio URL:', url);
    
    audio.crossOrigin = "anonymous";
    audio.src = url;
    
    audio.preload = "metadata";
    
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
  
  const handleSeek = (soundId: string, position: number) => {
    if (!audioElement || playingId !== soundId) return;
    
    audioElement.currentTime = position;
    setCurrentTime(position);
  };
  
  const { mutate: performDeleteSound, isPending: isDeletingSound } = useMutation<void, Error, string>({
    mutationFn: deleteSound,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sounds'] });
      if (onReload) {
        onReload();
      }
    },
    onError: (err: Error) => {
      console.error(`Failed to delete sound: ${err.message}`);
    },
  });

  const handleDeleteSound = async (id: string) => {
    if (playingId === id && audioElement) {
      audioElement.pause();
      setPlayingId(null);
    }
    performDeleteSound(id);
  };
  
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (fetchError) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {fetchError.message}
      </Alert>
    );
  }
  
  if (soundsData.length === 0) {
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
        {soundsData.map((sound) => (
          <Grid item xs={12} sm={6} md={4} key={sound.id}>
            <AudioTrackCard
              sound={sound}
              playingId={playingId}
              currentTime={currentTime}
              duration={duration}
              handlePlaySound={handlePlaySound}
              handleDeleteSound={handleDeleteSound}
              handleSeek={handleSeek}
              sectionColor={sectionColor}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}