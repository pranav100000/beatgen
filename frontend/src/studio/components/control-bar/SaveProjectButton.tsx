import React, { useState } from 'react';
import { IconButton, CircularProgress, Snackbar, Alert, useTheme } from '@mui/material';
import { IconCloudUpload } from '@tabler/icons-react';
import { 
  createProject, 
  updateProject, 
  saveProjectWithSounds
} from '../../../platform/api/projects';
import { useAuth } from '../../../platform/auth/auth-context';
import { useStudioStore } from '../../stores/studioStore';
import { CombinedTrack, Project } from 'src/platform/types/project';
import { useAppTheme } from '../../../platform/theme/ThemeContext';

interface SaveProjectButtonProps {
  projectTitle: string;
  bpm: number;
  timeSignature: [number, number];
  tracks: CombinedTrack[];
  projectId: string;
  keySignature: string;
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
    severity: 'success' | 'error' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });
  
  // Get auth user and store
  const { user } = useAuth();
  const studioStore = useStudioStore();
  const appTheme = useAppTheme(); // Renamed to avoid conflict
  const muiTheme = useTheme(); // Get the MUI theme for palette

  // Prepare MIDI notes for each track before saving
  const prepareTracksWithMidiNotes = (tracks: CombinedTrack[]): CombinedTrack[] => {
    return tracks.map(track => {
      // Clone the track to avoid mutating the original
      const preparedTrack = {...track};
      
      // For MIDI and sampler tracks, add MIDI notes from the manager
      if (track.type === 'midi' || track.type === 'sampler') {
        const midiNotes = studioStore.getTrackNotes(track.id) || [];
        
        // Add MIDI notes JSON to the track data
        if (preparedTrack.track) {
          preparedTrack.track = {
            ...preparedTrack.track,
            midi_notes_json: { notes: midiNotes }
          };
        }
      }
      
      return preparedTrack;
    });
  };

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
      
      // Project data structure
      const projectData = {
        name: projectTitle,
        bpm: bpm,
        time_signature_numerator: timeSignature[0],
        time_signature_denominator: timeSignature[1],
        key_signature: keySignature,
        user_id: user.id
      };
      
      // Prepare tracks with MIDI notes
      const preparedTracks = prepareTracksWithMidiNotes(tracks);
      
      let savedProject: Project | undefined;
      
      if (projectId) {
        // Update existing project
        if (tracks.some(track => track.type === 'audio' || track.type === 'sampler')) {
          // Use saveProjectWithSounds if we have audio or sampler tracks
          savedProject = await saveProjectWithSounds(projectId, projectData, preparedTracks);
        } else {
          // Use standard update for projects without audio tracks
          savedProject = await updateProject(projectId, {
            ...projectData,
            tracks: preparedTracks
          });
        }
        
        setSnackbar({
          open: true,
          message: 'Project updated successfully',
          severity: 'success'
        });
      } else {
        // Create new project
        const newProject = await createProject(projectData);
        
        if (tracks.length > 0) {
          // If we have tracks, use saveProjectWithSounds
          savedProject = await saveProjectWithSounds(
            newProject.id, 
            projectData, 
            preparedTracks
          );
        } else {
          savedProject = newProject;
        }
        
        setSnackbar({
          open: true,
          message: 'Project saved successfully',
          severity: 'success'
        });
      }
      
      // After successful save/update, update URL and call onSaved
      if (savedProject && savedProject.id) {
        const newUrl = `/studio?projectId=${savedProject.id}`;
        window.history.replaceState({}, '', newUrl);

        // Call the onSaved callback if provided
        if (onSaved) {
          onSaved(savedProject);
        }
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
        sx={{
          color: appTheme.studioMode === 'dark' ? 'white' : 'black',
          borderRadius: '8px',
          '&:hover': {
            backgroundColor: muiTheme.palette.action.hover,
          },
        }}
        disableRipple
      >
        {saving ? <CircularProgress size={20} color="inherit" /> : <IconCloudUpload />}
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