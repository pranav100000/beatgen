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

interface MidiLibraryProps {
  onReload?: () => void;
}

export default function MidiLibrary({ onReload }: MidiLibraryProps) {
  const [midiTracks, setMidiTracks] = useState<MidiTrackRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Load MIDI tracks on mount
  useEffect(() => {
    loadMidiTracks();
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
  
  const loadMidiTracks = async () => {
    try {
      setLoading(true);
      setError(null);
      const loadedTracks = await getMidiTracks();
      setMidiTracks(loadedTracks);
    } catch (err) {
      setError(`Failed to load MIDI tracks: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };
  
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
  
  const handleDeleteTrack = async (id: string) => {
    // Stop playback if this is the track being played
    if (playingId === id && audioElement) {
      audioElement.pause();
      setPlayingId(null);
    }
    
    try {
      await deleteMidiTrack(id);
      setMidiTracks(midiTracks.filter(track => track.id !== id));
      if (onReload) {
        onReload();
      }
    } catch (err) {
      setError(`Failed to delete MIDI track: ${(err as Error).message}`);
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
  
  if (midiTracks.length === 0) {
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