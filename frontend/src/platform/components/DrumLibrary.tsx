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

interface DrumLibraryProps {
  onReload?: () => void;
}

export default function DrumLibrary({ onReload }: DrumLibraryProps) {
  const [drumTracks, setDrumTracks] = useState<DrumTrackRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  
  // Load drum tracks on mount
  useEffect(() => {
    loadDrumTracks();
  }, []);
  
  const loadDrumTracks = async () => {
    try {
      setLoading(true);
      setError(null);
      const loadedTracks = await getDrumTracks();
      setDrumTracks(loadedTracks.items);
    } catch (err) {
      setError(`Failed to load drum tracks: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };
  
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
  
  const handleDeleteTrack = async (id: string) => {
    // Stop playback if this is the track being played
    if (playingId === id) {
      setPlayingId(null);
    }
    
    try {
      await deleteDrumTrack(id);
      setDrumTracks(drumTracks.filter(track => track.id !== id));
      if (onReload) {
        onReload();
      }
    } catch (err) {
      setError(`Failed to delete drum track: ${(err as Error).message}`);
    }
  };
  
  const handleEditTrack = (id: string) => {
    // For now, just log - this would open the drum editor in the future
    console.log('Edit drum track:', id);
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
  
  if (drumTracks.length === 0) {
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