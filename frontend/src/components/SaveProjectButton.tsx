import React, { useState } from 'react';
import { Button, CircularProgress, Snackbar, Alert, Tooltip } from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { createProject, updateProject, Project } from '../api/projects';
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
      // Extract necessary data from tracks and convert any special objects
      const simplifiedTracks = tracks.map(track => {
        return {
          id: track.id,
          name: track.name,
          type: track.type,
          volume: track.volume || 1,
          pan: track.pan || 0,
          solo: track.soloed || false,
          mute: track.muted || false,
          color: track.color || '#4285F4',
          content: {
            position: track.position,
            duration: track.duration,
            // Convert any complex objects to JSON-friendly formats
            // For example, audio data references, MIDI notes, etc.
            audioFileId: track.dbId || null,
            // Add any other track-specific data you need to store
          }
        };
      });

      const timeSignatureStr = `${timeSignature[0]}/${timeSignature[1]}`;
      
      // Determine if we should create or update
      let savedProject;
      if (projectId) {
        // Update existing project
        savedProject = await updateProject(projectId, {
          name: projectTitle,
          description: `BPM: ${bpm}, Time Signature: ${timeSignatureStr}`,
          bpm: bpm,
          time_signature: timeSignatureStr
        });
        
        // Note: In a real implementation, you would also update the tracks
        // This would require additional API endpoints for track management
        
        setSnackbar({
          open: true,
          message: 'Project updated successfully',
          severity: 'success'
        });
      } else {
        // Create new project
        savedProject = await createProject({
          name: projectTitle,
          description: `BPM: ${bpm}, Time Signature: ${timeSignatureStr}`,
          bpm: bpm,
          time_signature: timeSignatureStr
        });
        
        // Note: In a real implementation, you would also save the tracks
        // This would require additional API endpoints for track management
        
        setSnackbar({
          open: true,
          message: 'Project saved successfully',
          severity: 'success'
        });
      }
      
      // Call the onSaved callback if provided
      if (onSaved && savedProject) {
        onSaved(savedProject);
      }
    } catch (error) {
      console.error('Error saving project:', error);
      setSnackbar({
        open: true,
        message: 'Failed to save project. Please try again.',
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
      <Tooltip title="Save project" arrow>
        <Button
          variant="contained"
          color="primary"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving}
          sx={{
            backgroundColor: '#1976D2',
            '&:hover': {
              backgroundColor: '#1565C0'
            }
          }}
        >
          Save
        </Button>
      </Tooltip>
      
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