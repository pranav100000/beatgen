import React, { useState } from 'react';
import { IconButton, CircularProgress, Snackbar, Alert } from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { 
  createProject, 
  updateProject, 
  Project, 
  saveProjectWithSounds,
  AudioTrackData,
  MidiTrackData
} from '../api/projects';
import { useAuth } from '../core/auth/auth-context';
import { db } from '../core/db/dexie-client';

interface SaveProjectButtonProps {
  projectTitle: string;
  bpm: number;
  timeSignature: [number, number];
  tracks: any[];
  projectId: string;
  keySignature: string; // Musical key signature
  onSaved?: (project: Project) => void;
}

export const SaveProjectButton: React.FC<SaveProjectButtonProps> = ({
  projectTitle,
  bpm,
  timeSignature,
  tracks,
  projectId,
  keySignature,
  onSaved
}) => {
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const { user } = useAuth();

  const handleSave = async () => {
    if (!user) {
      setSnackbar({
        open: true,
        message: 'Please log in to save your project',
        severity: 'error'
      });
      return;
    }

    setSaving(true);
    try {
      console.log('Starting project save with tracks:', tracks);
      
      // Collect tracks that need to be uploaded
      const audioTracksToUpload: AudioTrackData[] = [];
      const midiTracksToUpload: MidiTrackData[] = [];
      
      // Process all tracks
      const projectTracks = tracks.map(track => {
        console.log('Processing track:', track);
        
        // For audio tracks with files, prepare for upload
        if (track.type === 'audio' && track.audioFile) {
          console.log('Found audio track with file:', track.audioFile.name);
          
          // Generate a UUID for this track to use consistently across systems
          const trackId = track.id || crypto.randomUUID();
          
          // Add to upload list
          audioTracksToUpload.push({
            id: trackId, // Use consistent ID across systems
            file: track.audioFile,
            x_position: track.position?.x || 0,
            y_position: track.position?.y || 0,
            track_number: track.trackIndex || 0,
            left_trim_ms: 0, // Default for now
            right_trim_ms: 0, // Default for now
            volume: track.volume || 1, // Keep as 0-1 scale
            pan: track.pan || 0, // Keep as -1 to 1 scale
            is_muted: track.muted || false,
            name: track.name
          });
          
          // Return a placeholder - this will be replaced by the upload process
          return null;
        }
        
        // For MIDI tracks, get the MIDI file from IndexedDB and prepare for upload
        if (track.type === 'midi') {
          console.log('Found MIDI track to save:', track.id);
          
          // We'll fetch the MIDI data from IndexedDB and add it to upload list asynchronously
          // Add this track to the placeholders list and process it separately
          return null;
        }
        
        // For other tracks, convert to API format (using flattened structure)
        return {
          id: track.id,
          name: track.name,
          type: track.type,
          volume: track.volume || 1,
          pan: track.pan || 0,
          mute: track.muted || false,
          color: track.color || '#4285F4',
          x_position: track.position?.x || 0,
          y_position: track.position?.y || 0,
          duration: track.duration,
          storage_key: track.storage_key, // Include storage key if available
        };
      }).filter(track => track !== null); // Remove null placeholders
      
      // Now handle the MIDI tracks - fetch from IndexedDB
      const midiTracks = tracks.filter(track => track.type === 'midi');
      
      // Get MIDI files from IndexedDB for MIDI tracks
      for (const track of midiTracks) {
        try {
          console.log(`Fetching MIDI data for track ${track.id} from DB`);
          const midiBlob = await db.getMidiTrackBlob(track.id);
          
          if (midiBlob) {
            console.log(`Found MIDI blob for track ${track.id}, size: ${midiBlob.size} bytes`);
            
            // Add to upload list
            midiTracksToUpload.push({
              id: track.id,
              file: midiBlob,
              x_position: track.position?.x || 0,
              y_position: track.position?.y || 0,
              volume: track.volume || 1,
              pan: track.pan || 0,
              is_muted: track.muted || false,
              name: track.name,
              bpm: bpm,
              time_signature: timeSignature
            });
          } else {
            console.log(`No MIDI data found in DB for track ${track.id}, adding to standard tracks`);
            // Add to regular project tracks since there's no file to upload
            projectTracks.push({
              id: track.id,
              name: track.name,
              type: track.type,
              volume: track.volume || 1,
              pan: track.pan || 0,
              mute: track.muted || false,
              color: track.color || '#4285F4',
              x_position: track.position?.x || 0,
              y_position: track.position?.y || 0,
              duration: track.duration,
              storage_key: track.storage_key // Include storage key if available
            });
          }
        } catch (error) {
          console.error(`Error fetching MIDI data for track ${track.id}:`, error);
        }
      }
      
      let savedProject;
      
      // Project data structure
      console.log('Project data being prepared for save:', {
        name: projectTitle,
        bpm: bpm,
        time_signature: timeSignature,
        key_signature: keySignature
      });
      
      const projectData = {
        name: projectTitle,
        bpm: bpm,
        time_signature_numerator: timeSignature[0],
        time_signature_denominator: timeSignature[1],
        key_signature: keySignature
      };
      
      // If we have files to upload, use the special save function
      if (audioTracksToUpload.length > 0 || midiTracksToUpload.length > 0) {
        console.log(`Saving project with ${audioTracksToUpload.length} audio tracks and ${midiTracksToUpload.length} MIDI tracks to upload`);
        
        if (projectId) {
          // Update existing project with uploads
          savedProject = await saveProjectWithSounds(
            projectId, 
            projectData, 
            audioTracksToUpload,
            midiTracksToUpload
          );
          
          setSnackbar({
            open: true,
            message: 'Project updated with tracks successfully',
            severity: 'success'
          });
        } else {
          // For new projects, create the project first, then add tracks
          const newProject = await createProject(projectData);
          savedProject = await saveProjectWithSounds(
            newProject.id, 
            projectData, 
            audioTracksToUpload,
            midiTracksToUpload
          );
          
          setSnackbar({
            open: true,
            message: 'Project saved with tracks successfully',
            severity: 'success'
          });
        }
      } else {
        // No files to upload, use standard project save
        console.log('Saving project without file uploads');
        
        if (projectId) {
          // Update existing project
          savedProject = await updateProject(projectId, {
            ...projectData,
            tracks: projectTracks
          });
          
          setSnackbar({
            open: true,
            message: 'Project updated successfully',
            severity: 'success'
          });
        } else {
          // Create new project
          savedProject = await createProject(projectData);
          
          setSnackbar({
            open: true,
            message: 'Project saved successfully',
            severity: 'success'
          });
        }
      }
      
      // Call the onSaved callback if provided
      if (onSaved && savedProject) {
        onSaved(savedProject);
      }
    } catch (error) {
      console.error('Error saving project:', error);
      setSnackbar({
        open: true,
        message: `Failed to save project: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({
      ...snackbar,
      open: false
    });
  };

  return (
    <>
      <IconButton
        size="small"
        onClick={handleSave}
        disabled={saving}
        sx={{ color: 'white' }}
      >
        {saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
      </IconButton>
      
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={4000} 
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity} 
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};