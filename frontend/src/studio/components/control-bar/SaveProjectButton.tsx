import React, { useState } from 'react';
import { IconButton, CircularProgress, Snackbar, Alert } from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { 
  createProject, 
  updateProject, 
  Project, 
  saveProjectWithSounds,
  AudioTrackData,
  MidiTrackData,
  SamplerTrackData
} from '../../../platform/api/projects';
import { useAuth } from '../../../platform/auth/auth-context';
import { db } from '../../core/db/dexie-client';
import { internalProjectToApiUpdate } from '../../../platform/types/adapters';
import { useStudioStore } from '../../../studio/stores/useStudioStore';

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
    severity: 'success' | 'error' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });
  
  // Get auth user
  const { user } = useAuth();
  
  // Get the studio store for access to MidiManager
  const studioStore = useStudioStore();

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
      const samplerTracksToUpload: SamplerTrackData[] = [];
      
      // Process all tracks
      const projectTracks = tracks.map(track => {
        console.log('Processing track:', track);
        
        // For audio tracks with files, prepare for upload
        if (track.type === 'audio' && track.audioFile) {
          console.log('Found audio track with file:', track.audioFile.name);
          
          // Generate a UUID for this track to use consistently across systems
          const trackId = track.id;
          
          // Add to upload list
          audioTracksToUpload.push({
            id: trackId, // Use consistent ID across systems
            file: track.audioFile,
            x_position: track.position?.x || 0,
            y_position: track.position?.y || 0,
            track_number: track.trackIndex || 0,
            trim_start_ticks: track.trimStartTicks || 0,
            trim_end_ticks: track.trimEndTicks || 0, 
            volume: track.volume || 1, // Keep as 0-1 scale
            pan: track.pan || 0, // Keep as -1 to 1 scale
            is_muted: track.muted || false,
            name: track.name
          });
          
          // Return a placeholder - this will be replaced by the upload process
          return null;
        }
        
        // For MIDI tracks, return them normally so we can access the notes directly
          // We'll populate midi_notes_json for MIDI tracks when we process them below
          if (track.type === 'midi') {
            console.log('Found MIDI track to save:', track.id);
            // Continue normal processing to add to projectTracks
          }

        console.log('Processing track:', track);
        
        // For other tracks, construct the object matching CombinedTrack structure
        // Include necessary top-level properties and a **cleaned, serializable** nested track object
        // Define the properties to include in the cleaned track object explicitly
        const cleanedTrackData = {
          id: track.id,
          name: track.name,
          type: track.type,
          volume: track.volume !== undefined ? track.volume : 1, // Ensure defaults are applied if undefined
          pan: track.pan !== undefined ? track.pan : 0,
          muted: track.muted !== undefined ? track.muted : false,
          color: track.color || '#4285F4',
          position: { x: track.position?.x || 0, y: track.position?.y || 0 }, // Assuming backend expects position object
          duration: track.duration, // Ensure this is serializable (e.g., number)
          trimStartTicks: track.trimStartTicks || 0,
          trimEndTicks: track.trimEndTicks || 0,
          storage_key: track.storage_key,
          // Instrument info - ensure these are serializable primitives
          instrumentId: (track.type === 'midi' || track.type === 'drum') ? track.instrumentId : undefined,
          instrumentName: (track.type === 'midi' || track.type === 'drum') ? track.instrumentName : undefined,
          instrumentStorageKey: (track.type === 'midi' || track.type === 'drum') ? track.instrumentStorageKey : undefined,
          // Add any other necessary *serializable* properties here
          // Explicitly OMIT potentially circular refs like audio nodes, contexts, file objects (handled elsewhere)
        };

        return {
          id: track.id, // Top-level ID for CombinedTrack structure
          name: track.name, // Top-level name
          type: track.type, // Top-level type
          track: cleanedTrackData // Use the cleaned, serializable data
        };
      }).filter(track => track !== null); // Remove null placeholders

      console.log('Project tracks prepared for standard update:', projectTracks);
      
      // Handle MIDI tracks - get notes directly from MidiManager
      const midiTracks = tracks.filter(track => track.type === 'midi');
      
      // Process MIDI tracks
      for (const track of midiTracks) {
        try {
          console.log(`Processing MIDI data for track ${track.id}`);
          
          // Get MIDI notes directly from MidiManager
          const midiNotes = studioStore.getTrackNotes(track.id) || [];
          console.log(`Retrieved ${midiNotes.length} MIDI notes from MidiManager for track ${track.id}`);
          
          // If no MidiManager or no notes, log warning
          if (midiNotes.length === 0) {
            console.warn(`No MIDI notes found for track ${track.id}`);
          }
          
          // Log for debugging
          console.log(`Track ${track.id} data:`, {
            instrumentId: track.instrumentId,
            name: track.name,
            notesCount: midiNotes.length
          });
          
          // Add to upload list with notes JSON
          midiTracksToUpload.push({
            id: track.id,
            x_position: track.position?.x || 0,
            y_position: track.position?.y || 0,
            trim_start_ticks: track.trimStartTicks || 0,
            trim_end_ticks: track.trimEndTicks || 0,
            volume: track.volume || 1,
            pan: track.pan || 0,
            is_muted: track.muted || false,
            name: track.name,
            bpm: bpm,
            time_signature: timeSignature,
            // Add instrument information
            instrument_id: track.instrumentId,
            instrument_name: track.instrumentName,
            instrument_storage_key: track.instrumentStorageKey,
            // Include the MIDI notes as JSON
            midi_notes_json: { notes: midiNotes }
          });
        } catch (error) {
          console.error(`Error processing MIDI data for track ${track.id}:`, error);
        }
      }
      
      let savedProject: Project | undefined;
      
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
        key_signature: keySignature,
        user_id: user.id
      };
      
      // Process sampler tracks
      const samplerTracks = tracks.filter(track => track.type === 'sampler');
      console.log(`Found ${samplerTracks.length} sampler tracks to process`);
      
      for (const track of samplerTracks) {
        // Skip if there's no sample file
        if (!track.sampleFile && !track.audioFile) {
          console.log(`Sampler track ${track.id} has no sample file, skipping upload`);
          continue;
        }
        
        // Get the audio sample file
        const audioFile = track.sampleFile || track.audioFile;
        console.log(`Processing sampler track ${track.id} with sample file: ${audioFile.name}`);
        
                  // Get MIDI notes directly from MidiManager
        const midiNotes = studioStore.getTrackNotes(track.id) || [];
        console.log(`Retrieved ${midiNotes.length} MIDI notes from MidiManager for track ${track.id}`);
        
        // If no MidiManager or no notes, log warning
        if (midiNotes.length === 0) {
          console.warn(`No MIDI notes found for track ${track.id}`);
        }
        
        // Add to sampler tracks to upload
        samplerTracksToUpload.push({
          id: track.id,
          audioFile: audioFile,
          x_position: track.position?.x || 0,
          y_position: track.position?.y || 0,
          trim_start_ticks: track.trimStartTicks || 0,
          trim_end_ticks: track.trimEndTicks || 0,
          volume: track.volume || 1,
          pan: track.pan || 0,
          is_muted: track.muted || false,
          name: track.name,
          baseMidiNote: track.baseMidiNote || 60,
          grainSize: track.grainSize || 0.1,
          overlap: track.overlap || 0.1,
          midi_notes_json: { notes: midiNotes }
        });
      }
      
      // If we have files to upload, use the special save function
      if (audioTracksToUpload.length > 0 || midiTracksToUpload.length > 0 || samplerTracksToUpload.length > 0) {
        console.log(`Saving project with ${audioTracksToUpload.length} audio tracks, ${midiTracksToUpload.length} MIDI tracks, and ${samplerTracksToUpload.length} sampler tracks to upload`);
        
        if (projectId) {
          // Update existing project with uploads
          savedProject = await saveProjectWithSounds(
            projectId, 
            projectData, 
            audioTracksToUpload,
            midiTracksToUpload,
            samplerTracksToUpload,
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
            midiTracksToUpload,
            samplerTracksToUpload,
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
      
      // After successful save/update, update URL and call onSaved
      if (savedProject && savedProject.id) {
        const newUrl = `/studio?projectId=${savedProject.id}`; // Update URL path
        window.history.replaceState({}, '', newUrl); // Use replaceState to update URL without navigation

        // Call the onSaved callback if provided
        if (onSaved) {
          onSaved(savedProject);
        }
      } else if (savedProject) {
         // Handle case where save seemed successful but ID is missing
         console.error("Save operation completed but no valid project ID was returned.");
         setSnackbar({
            open: true,
            message: 'Project saved, but failed to update session (missing ID).',
            severity: 'warning',
         });
         // Optionally call onSaved even without ID if appropriate
         // if (onSaved) {
         //   onSaved(savedProject);
         // }
      }
      // Note: Snackbar messages are set within the if/else blocks above for specific success contexts

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