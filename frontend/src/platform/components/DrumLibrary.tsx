import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  CircularProgress,
  Alert,
} from '@mui/material';
import { Drum } from 'lucide-react';
import { getDrumTracks, deleteDrumTrack } from '../api/sounds';
import { DrumTrackRead } from '../types/track_models/drum_track';
import DrumTrackCard from './DisplayCards/DrumTrackCard';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Page } from '../types/pagination'; // Import Page type

interface DrumLibraryProps {
  onReload?: () => void;
}

const ITEMS_PER_PAGE = 10; // Default for drum tracks API

export default function DrumLibrary({ onReload }: DrumLibraryProps) {
  const queryClient = useQueryClient();
  const [currentPageApi, setCurrentPageApi] = useState<number>(1); // For pagination
  const [playingId, setPlayingId] = useState<string | null>(null);
  
  const { 
    data: drumTracksPage,
    isLoading,
    error: fetchError,
    isFetching
  } = useQuery<Page<DrumTrackRead>, Error, Page<DrumTrackRead>, [string, number, number]>({
    queryKey: ['drumTracks', currentPageApi, ITEMS_PER_PAGE],
    queryFn: () => getDrumTracks(currentPageApi, ITEMS_PER_PAGE),
    placeholderData: (previousData) => previousData,
  });

  const drumTracks = drumTracksPage?.items ?? [];
  
  const handlePlayTrack = (track: DrumTrackRead) => {
    // If we're already playing this track, pause it
    if (playingId === track.id) {
      setPlayingId(null);
      return;
    }
    
    // Mock playback for now - in reality we would use a drum sequencer
    // For now, just set the playingId to simulate being able to play drums
    setPlayingId(track.id);
    
    // This is where you would initialize a drum sequencer
    console.log('Playing drum track:', track.name);
    
    // For debugging - after 5 seconds auto-stop
    setTimeout(() => {
      setPlayingId(null);
    }, 5000);
  };
  
  const { mutate: performDeleteDrumTrack, isPending: isDeletingTrack } = useMutation<void, Error, string>({
    mutationFn: deleteDrumTrack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drumTracks', currentPageApi, ITEMS_PER_PAGE] });
      if (onReload) {
        onReload();
      }
    },
    onError: (err: Error) => {
      console.error(`Failed to delete drum track: ${err.message}`);
      // setError(`Failed to delete drum track: ${(err as Error).message}`); // Handled by queryError
    },
  });

  const handleDeleteTrack = async (id: string) => {
    // Stop playback if this is the track being played
    if (playingId === id) {
      setPlayingId(null);
    }
    performDeleteDrumTrack(id);
  };
  
  const handleEditTrack = (id: string) => {
    // For now, just log - this would open the drum editor in the future
    console.log('Edit drum track:', id);
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
  
  if (drumTracks.length === 0 && !isFetching) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
        height: '100%'
      }}>
        <Box sx={{ fontSize: 60, color: '#666', mb: 2 }}>
          <Drum size={60} />
        </Box>
        <Typography variant="h6" gutterBottom sx={{ color: '#ccc' }}>
          No drum tracks in your library
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center">
          Create drum tracks in the studio to see them here
        </Typography>
      </Box>
    );
  }
  
  return (
    <Box sx={{ mt: 2 }}>
      <Grid container spacing={2}>
        {drumTracks.map((track) => (
          <Grid item xs={12} sm={6} md={4} key={track.id}>
            <DrumTrackCard
              track={track}
              playingId={playingId}
              handlePlayTrack={handlePlayTrack}
              handleDeleteTrack={handleDeleteTrack}
              handleEditTrack={handleEditTrack}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}