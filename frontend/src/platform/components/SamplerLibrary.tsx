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
import { getSamplerTracks, deleteSamplerTrack } from '../api/sounds';
import { SamplerTrackRead } from '../types/track_models/sampler_track';
import SamplerTrackCard from './DisplayCards/SamplerTrackCard';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Page } from '../types/pagination';

interface SamplerLibraryProps {
  onReload?: () => void;
  sectionColor: string;
}

const ITEMS_PER_PAGE = 10;

export default function SamplerLibrary({ onReload, sectionColor }: SamplerLibraryProps) {
  const queryClient = useQueryClient();
  const [currentPageApi, setCurrentPageApi] = useState<number>(1);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const { 
    data: samplerTracksPage,
    isLoading,
    error: fetchError,
    isFetching
  } = useQuery<Page<SamplerTrackRead>, Error, Page<SamplerTrackRead>, [string, number, number]>({
    queryKey: ['samplerTracks', currentPageApi, ITEMS_PER_PAGE],
    queryFn: () => getSamplerTracks(currentPageApi, ITEMS_PER_PAGE),
    placeholderData: (previousData) => previousData,
  });

  const samplerTracks = samplerTracksPage?.items ?? [];
  
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
  
  const handlePlayTrack = async (track: SamplerTrackRead) => {
    if (playingId === track.id && audioElement) {
      audioElement.pause();
      setPlayingId(null);
      return;
    }
    
    if (audioElement) {
      audioElement.pause();
      setCurrentTime(0);
    }
    
    try {
      const audio = new Audio();
      
      const baseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://fmpafpwdkegazcerrnso.supabase.co';
      const url = `${baseUrl}/storage/v1/object/public/tracks/${track.audio_storage_key}`;
      
      console.log('Audio URL:', url);
      
      audio.crossOrigin = "anonymous";
      audio.src = url;
      
      audio.preload = "metadata";
      
      audio.addEventListener('error', (e) => {
        console.error('Audio error details:', audio.error);
      });
      
      audio.play().catch(err => {
        console.error('Failed to play sampler track:', err);
      });
      
      setAudioElement(audio);
      setPlayingId(track.id);
      setCurrentTime(0);
    } catch (err) {
      console.error('Error playing sampler track:', err);
    }
  };
  
  const { mutate: performDeleteSamplerTrack, isPending: isDeletingTrack } = useMutation<void, Error, string>({
    mutationFn: deleteSamplerTrack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samplerTracks', currentPageApi, ITEMS_PER_PAGE] });
      if (onReload) {
        onReload();
      }
    },
    onError: (err: Error) => {
      console.error(`Failed to delete sampler track: ${err.message}`);
    },
  });

  const handleDeleteTrack = async (id: string) => {
    if (playingId === id && audioElement) {
      audioElement.pause();
      setPlayingId(null);
    }
    performDeleteSamplerTrack(id);
  };
  
  const handleSeek = (trackId: string, position: number) => {
    if (!audioElement || playingId !== trackId) return;
    
    audioElement.currentTime = position;
    setCurrentTime(position);
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
  
  if (samplerTracks.length === 0 && !isFetching) {
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
              sectionColor={sectionColor}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}