import React, { useState, useEffect } from 'react';
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
import { getMidiTracks, deleteMidiTrack } from '../api/sounds';
import { MidiTrackRead } from '../types/track_models/midi_track';
import MidiTrackCard from './DisplayCards/MidiTrackCard';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Page } from '../types/pagination'; // Import Page type

interface MidiLibraryProps {
  onReload?: () => void;
}

const ITEMS_PER_PAGE = 25; // Define items per page, as used before

export default function MidiLibrary({ onReload }: MidiLibraryProps) {
  const queryClient = useQueryClient();
  const [currentPageApi, setCurrentPageApi] = useState<number>(1); // For pagination

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const { 
    data: midiTracksPage,
    isLoading,
    error: fetchError,
    isFetching // To indicate background fetching for pagination
  } = useQuery<Page<MidiTrackRead>, Error, Page<MidiTrackRead>, [string, number, number]>({
    queryKey: ['midiTracks', currentPageApi, ITEMS_PER_PAGE],
    queryFn: () => getMidiTracks(currentPageApi, ITEMS_PER_PAGE),
    placeholderData: (previousData) => previousData,
  });

  const midiTracks = midiTracksPage?.items ?? [];
  
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
  
  const handlePlayTrack = (track: MidiTrackRead) => {
    // If we're already playing this track, pause it
    if (playingId === track.id && audioElement) {
      audioElement.pause();
      setPlayingId(null);
      return;
    }
    
    // Mock playback for now - in reality we would use a MIDI player library
    // For now, just set the playingId to simulate being able to play MIDI
    setPlayingId(track.id);
    
    // This is where you would initialize a MIDI player
    console.log('Playing MIDI track:', track.name);
    
    // For debugging - after 5 seconds auto-stop
    setTimeout(() => {
      setPlayingId(null);
    }, 5000);
  };
  
  const { mutate: performDeleteMidiTrack, isPending: isDeletingTrack } = useMutation<void, Error, string>({
    mutationFn: deleteMidiTrack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['midiTracks', currentPageApi, ITEMS_PER_PAGE] });
      // Or broader: queryClient.invalidateQueries({ queryKey: ['midiTracks'] });
      if (onReload) {
        onReload();
      }
    },
    onError: (err: Error) => {
      console.error(`Failed to delete MIDI track: ${err.message}`);
      // Update an error state or show snackbar
    },
  });

  const handleDeleteTrack = async (id: string) => {
    // Stop playback if this is the track being played
    if (playingId === id && audioElement) {
      audioElement.pause();
      setPlayingId(null);
    }
    performDeleteMidiTrack(id);
  };
  
  if (isLoading) { // Initial page load
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
  
  if (midiTracks.length === 0 && !isFetching) { // Show no tracks only if not fetching more
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
          No MIDI tracks in your library
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center">
          Create MIDI tracks in the studio to see them here
        </Typography>
      </Box>
    );
  }
  
  return (
    <Box sx={{ mt: 2 }}>
      <Grid container spacing={2}>
        {midiTracks.map((track) => (
          <Grid item xs={12} sm={6} md={4} key={track.id}>
            <MidiTrackCard
              track={track}
              playingId={playingId}
              currentTime={currentTime}
              duration={duration}
              handlePlayTrack={handlePlayTrack}
              handleDeleteTrack={handleDeleteTrack}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}