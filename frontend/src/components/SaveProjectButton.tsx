import React, { useState } from 'react';
import { IconButton, CircularProgress, Snackbar, Alert } from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { 
  createProject, 
  updateProject, 
  Project, 
  saveProjectWithSounds,
  AudioTrackData
} from '../api/projects';
import { useAuth } from '../core/auth/auth-context';

interface SaveProjectButtonProps {
  projectTitle: string;
  bpm: number;
  timeSignature: [number, number];
  tracks: any[];
  projectId?: string;
  onSaved?: (project: Project) => void;
}

export const SaveProjectButton: React.FC<SaveProjectButtonProps> = ({
  projectTitle,
  bpm,
  timeSignature,
  tracks,
  projectId,
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
      
      // Collect audio tracks that need to be uploaded
      const audioTracksToUpload: AudioTrackData[] = [];
      
      // Process all tracks
      const projectTracks = tracks.map(track => {
        console.log('Processing track:', track);
        
        // For audio tracks with files, prepare for upload
        if (track.type === 'audio' && track.audioFile) {
          console.log('Found audio track with file:', track.audioFile.name);
          
          // Generate a UUID for this track to use consistently across systems
          const trackId = crypto.randomUUID();
          
          // Add to upload list
          audioTracksToUpload.push({
            id: trackId, // Use consistent ID across systems
            file: track.audioFile,
            y_position: track.position?.y || 0,
            track_number: track.trackIndex || 0,
            left_trim_ms: 0, // Default for now
            right_trim_ms: 0, // Default for now
            volume: (track.volume || 1) * 100, // Convert to 0-100 scale
            pan: (track.pan || 0) * 100, // Convert to -100 to 100 scale
            is_muted: track.muted || false,
            name: track.name
          });
          
          // Return a placeholder - this will be replaced by the upload process
          return null;
        }
        
        // For other tracks, convert to API format
        return {
          id: track.id,
          name: track.name,
          type: track.type,
          volume: track.volume || 1,
          pan: track.pan || 0,
          mute: track.muted || false,
          color: track.color || '#4285F4',
          y_position: track.position?.y || 0,
          duration: track.duration,
        };
      }).filter(track => track !== null); // Remove null placeholders
      
      let savedProject;
      
      // Project data structure
      const projectData = {
        name: projectTitle,
        bpm: bpm,
        time_signature_numerator: timeSignature[0],
        time_signature_denominator: timeSignature[1]
      };
      
      // If we have audio files to upload, use the special save function
      if (audioTracksToUpload.length > 0) {
        console.log(`Saving project with ${audioTracksToUpload.length} audio tracks to upload`);
        
        if (projectId) {
          // Update existing project with audio uploads
          savedProject = await saveProjectWithSounds(projectId, projectData, audioTracksToUpload);
          
          setSnackbar({
            open: true,
            message: 'Project updated with audio tracks successfully',
            severity: 'success'
          });
        } else {
          // For new projects, create the project first, then add audio tracks
          const newProject = await createProject(projectData);
          savedProject = await saveProjectWithSounds(newProject.id, projectData, audioTracksToUpload);
          
          setSnackbar({
            open: true,
            message: 'Project saved with audio tracks successfully',
            severity: 'success'
          });
        }
      } else {
        // No audio files to upload, use standard project save
        console.log('Saving project without audio uploads');
        
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