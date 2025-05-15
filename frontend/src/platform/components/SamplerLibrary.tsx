import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  CircularProgress,
  Alert,
} from '@mui/material';
import { 
  GraphicEq as GraphicEqIcon
} from '@mui/icons-material';
import { getSamplerTracks, deleteSamplerTrack, downloadAudioTrackFile } from '../api/sounds';
import { SamplerTrackRead } from '../types/track_models/sampler_track';
import SamplerTrackCard from './DisplayCards/SamplerTrackCard';

interface SamplerLibraryProps {
  onReload?: () => void;
}

export default function SamplerLibrary({ onReload }: SamplerLibraryProps) {
  const [samplerTracks, setSamplerTracks] = useState<SamplerTrackRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Load sampler tracks on mount
  useEffect(() => {
    loadSamplerTracks();
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
  
  const loadSamplerTracks = async () => {
    try {
      setLoading(true);
      setError(null);
      const loadedTracks = await getSamplerTracks();
      setSamplerTracks(loadedTracks.items);
    } catch (err) {
      setError(`Failed to load sampler tracks: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handlePlayTrack = async (track: SamplerTrackRead) => {
    // If we're already playing this track, pause it
    if (playingId === track.id && audioElement) {
      audioElement.pause();
      setPlayingId(null);
      return;
    }
    
    // If we have another track playing, stop it
    if (audioElement) {
      audioElement.pause();
      setCurrentTime(0);
    }
    
    try {
      // Create a new audio element
      const audio = new Audio();
      
      // To play the audio, we need to get the audio file from storage
      // For now, we'll use a direct URL construction
      const baseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://fmpafpwdkegazcerrnso.supabase.co';
      const url = `${baseUrl}/storage/v1/object/public/tracks/${track.audio_storage_key}`;
      
      console.log('Audio URL:', url);
      
      // Add CORS headers
      audio.crossOrigin = "anonymous";
      audio.src = url;
      
      // Preload metadata to get duration faster
      audio.preload = "metadata";
      
      // Add error event listener for debugging
      audio.addEventListener('error', (e) => {
        console.error('Audio error details:', audio.error);
        setError(`Failed to play sampler track: ${audio.error?.message || 'Unknown error'}`);
      });
      
      audio.play().catch(err => {
        console.error('Failed to play sampler track:', err);
        setError(`Failed to play sampler track: ${err.message}`);
      });
      
      setAudioElement(audio);
      setPlayingId(track.id);
      setCurrentTime(0);
    } catch (err) {
      console.error('Error playing sampler track:', err);
      setError(`Failed to play sampler track: ${(err as Error).message}`);
    }
  };
  
  const handleDeleteTrack = async (id: string) => {
    // Stop playback if this is the track being played
    if (playingId === id && audioElement) {
      audioElement.pause();
      setPlayingId(null);
    }
    
    try {
      await deleteSamplerTrack(id);
      setSamplerTracks(samplerTracks.filter(track => track.id !== id));
      if (onReload) {
        onReload();
      }
    } catch (err) {
      setError(`Failed to delete sampler track: ${(err as Error).message}`);
    }
  };
  
  // Handle seeking when user clicks on waveform
  const handleSeek = (trackId: string, position: number) => {
    if (!audioElement || playingId !== trackId) return;
    
    // Set the current time of the audio
    audioElement.currentTime = position;
    setCurrentTime(position);
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
  
  if (samplerTracks.length === 0) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
        height: '100%'
      }}>
        <GraphicEqIcon sx={{ fontSize: 60, color: '#666', mb: 2 }} />
        <Typography variant="h6" gutterBottom sx={{ color: '#ccc' }}>
          No sampler tracks in your library
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center">
          Create sampler tracks in the studio to see them here
        </Typography>
      </Box>
    );
  }
  
  return (
    <Box sx={{ mt: 2 }}>
      <Grid container spacing={2}>
        {samplerTracks.map((track) => (
          <Grid item xs={12} sm={6} md={4} key={track.id}>
            <SamplerTrackCard
              track={track}
              playingId={playingId}
              currentTime={currentTime}
              duration={duration}
              handlePlayTrack={handlePlayTrack}
              handleDeleteTrack={handleDeleteTrack}
              handleSeek={handleSeek}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}