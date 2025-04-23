import { Store } from '../../core/state/store';
import { RootState, SetFn, GetFn, StoreSliceCreator, TrackOptions, TrackType } from '../types';
import { CombinedTrack } from 'src/platform/types/project';
import { SamplerTrackBase, SamplerTrackRead } from 'src/platform/types/track_models/sampler_track'; // Added SamplerTrackRead
import { downloadAudioTrackFile } from '../../../platform/api/sounds'; // Adjust path as needed
import { DEFAULT_SAMPLER_CONFIG } from '../config';
// Import note types and conversion utility
import { Note } from '../../../types/note'; 
import { convertJsonToNotes } from '../../../types/note'; 
// Import Tone.js MIDI library
import { Midi } from '@tonejs/midi'; 

// Define the actions for this slice
export interface SamplerSlice {
  // Actions linking samplers to drum tracks
  addSamplerToDrumTrack: (drumTrackId: string, file: File) => Promise<CombinedTrack | null>; 
  removeSamplerFromDrumTrack: (drumTrackId: string, samplerTrackIdToDelete: string) => Promise<void>;
  addEmptySamplerToDrumTrack: (drumTrackId: string, newSamplerName?: string) => Promise<string | null>;
  
  // Standalone sampler actions
  downloadSamplerTrack: (trackId: string) => Promise<{audioBlob?: Blob, midiBlob?: Blob, trackName: string} | null>;
  // createSamplerTrack is likely handled by tracksSlice.createTrackAndRegisterWithHistory('sampler', ...)
  // replaceTrackAudioFile might also be handled generically by tracksSlice?
}

// Fix: Implement the placeholder function using @tonejs/midi
const convertNotesToMidiBlob = async (notes: Note[], trackName: string): Promise<Blob | null> => {
    console.log(`Attempting to convert ${notes.length} notes to MIDI blob for ${trackName}`);
    if (!notes || notes.length === 0) return null;

    try {
        const midi = new Midi();
        const track = midi.addTrack();
        track.name = trackName;

        notes.forEach(note => {
            // Fix: Map Note properties to @tonejs/midi properties
            // Check for existence of assumed properties
            if (note.column === undefined || note.length === undefined || note.row === undefined) {
                console.warn('Skipping note due to missing properties (col/len/row):', note);
                return; 
            }
            track.addNote({
                midi: note.row, // Map row to midi note number
                ticks: note.column, // Map column to start tick
                durationTicks: note.length, // Map length to duration ticks
                velocity: note.velocity !== undefined ? note.velocity / 127 : 0.8 
            });
        });

        const midiArray = midi.toArray();
        const midiBlob = new Blob([midiArray], { type: 'audio/midi' });
        console.log(`Successfully generated MIDI blob (size: ${midiBlob.size})`);
        return midiBlob;
    } catch (error) {
        console.error('Error converting notes to MIDI blob:', error);
        return null;
    }
};

// Create the slice function
export const createSamplerSlice: StoreSliceCreator<SamplerSlice> = (set, get) => {
  const rootGet = get as GetFn; // Helper for root state access

  // Helper for updating a drum track's sampler references
  // This directly modifies the tracks array via updateRootState
  const updateDrumTrackSamplers = (drumTrackId: string, operation: 'add' | 'remove', samplerIds: string[]): CombinedTrack | null => {
    const { tracks, _updateState } = rootGet(); // Use _updateState instead of updateTrackState
    
    // Ensure the utility function exists
    if (!_updateState) {
        console.error("_updateState utility is not available in updateDrumTrackSamplers");
        return null;
    }

    const drumTrackIndex = tracks.findIndex(t => t.id === drumTrackId && t.type === 'drum');
    
    if (drumTrackIndex === -1) {
      console.error(`Drum track ${drumTrackId} not found for sampler update.`);
      return null;
    }

    const drumTrack = tracks[drumTrackIndex];
    const currentSamplerIds = (drumTrack as any).samplerTrackIds || [];
    if (!Array.isArray(currentSamplerIds)) {
        console.error(`Drum track ${drumTrackId} has invalid samplerTrackIds property.`);
        return null;
    } 

    const updatedSamplerIds = operation === 'add'
      ? [...currentSamplerIds, ...samplerIds.filter(id => !currentSamplerIds.includes(id))] 
      : currentSamplerIds.filter(id => !samplerIds.includes(id));
    
    // Fix: Directly update the tracks array using updateRootState
    let updatedDrumTrack: CombinedTrack | null = null;
    _updateState('tracks', (currentTracks) => 
      currentTracks.map((track, index) => {
        if (index === drumTrackIndex) {
          updatedDrumTrack = {
            ...track,
            samplerTrackIds: updatedSamplerIds, 
          } as CombinedTrack;
          return updatedDrumTrack;
        }
        return track;
      })
    );

    return updatedDrumTrack; // Return the modified track object
  };

  // Action to add a new sampler (from file) to a drum track
  const addSamplerToDrumTrack = async (drumTrackId: string, file: File): Promise<CombinedTrack | null> => {
    const { uploadAudioFile, _withErrorHandling } = rootGet(); // Needs track creation action

    if (!uploadAudioFile || !_withErrorHandling) {
      console.error("Required actions (_withErrorHandling, uploadAudioFile) not available for addSamplerToDrumTrack");
      return null;
    }

    const addLogic = async (): Promise<CombinedTrack | null> => {
      // 1. Create the sampler track from the audio file
      // uploadAudioFile should handle history registration
      const newSamplerTrack = await uploadAudioFile(file, true); // true indicates it's for a sampler
      if (!newSamplerTrack) {
        throw new Error("Failed to create sampler track from audio file");
      }
      
      // 2. Add reference to the drum track
      const updatedDrumTrack = updateDrumTrackSamplers(drumTrackId, 'add', [newSamplerTrack.id]);
      if (!updatedDrumTrack) {
        console.warn(`Drum track ${drumTrackId} not found or invalid. Sampler ${newSamplerTrack.id} created but not linked.`);
        // Potentially delete the orphaned sampler track here? Depends on desired behavior.
        // await rootGet().handleTrackDelete(newSamplerTrack.id);
        // throw new Error(`Drum track ${drumTrackId} not found or invalid.`);
      }
      
      console.log(`Added sampler ${newSamplerTrack.id} to drum track ${drumTrackId}`);
      return newSamplerTrack; // Return the newly created sampler track
    };
    
    return _withErrorHandling(addLogic, 'addSamplerToDrumTrack')();
  };

  // Action to remove a sampler from a drum track
  const removeSamplerFromDrumTrack = async (drumTrackId: string, samplerTrackIdToDelete: string): Promise<void> => {
    const { handleTrackDelete, _withErrorHandling } = rootGet(); // Needs track deletion action

    if (!handleTrackDelete || !_withErrorHandling) {
       console.error("Required actions (_withErrorHandling, handleTrackDelete) not available for removeSamplerFromDrumTrack");
       return;
    }

    const removeLogic = async (): Promise<void> => {
      // 1. Delete the actual sampler track (this handles engine removal & history)
      await handleTrackDelete(samplerTrackIdToDelete);
      
      // 2. Remove reference from the drum track
      const updatedDrumTrack = updateDrumTrackSamplers(drumTrackId, 'remove', [samplerTrackIdToDelete]);
      if (!updatedDrumTrack) {
        console.warn(`Drum track ${drumTrackId} not found or invalid after removing sampler ${samplerTrackIdToDelete}. Cannot unlink.`);
      }
      console.log(`Removed sampler ${samplerTrackIdToDelete} from drum track ${drumTrackId}`);
    };
    
    await _withErrorHandling(removeLogic, 'removeSamplerFromDrumTrack')();
  };

  // Action to add an empty sampler to a drum track
  const addEmptySamplerToDrumTrack = async (drumTrackId: string, newSamplerName?: string): Promise<string | null> => {
    const { tracks, createTrackAndRegisterWithHistory, handleTrackDelete, _withErrorHandling } = rootGet();

    if (!createTrackAndRegisterWithHistory || !handleTrackDelete || !_withErrorHandling) {
      console.error("Required actions not available for addEmptySamplerToDrumTrack");
      return null;
    }

    const addEmptyLogic = async (): Promise<string | null> => {
      // Determine default name
      const samplerCount = tracks.filter(t => t.type === 'sampler').length;
      const defaultName = newSamplerName || `Sampler ${samplerCount + 1}`;
      
      // 1. Create an empty sampler track (handles history registration)
      const samplerTrackOptions: TrackOptions = {
          name: defaultName,
          // Ensure sampler defaults are applied if createTrack doesn't handle them
          baseMidiNote: DEFAULT_SAMPLER_CONFIG.baseMidiNote,
          grainSize: DEFAULT_SAMPLER_CONFIG.grainSize,
          overlap: DEFAULT_SAMPLER_CONFIG.overlap,
      };
      const samplerTrack = await createTrackAndRegisterWithHistory('sampler', defaultName, samplerTrackOptions);
      if (!samplerTrack) {
        throw new Error("Failed to create empty sampler track");
      }
      
      // 2. Add reference to the drum track
      const updatedDrumTrack = updateDrumTrackSamplers(drumTrackId, 'add', [samplerTrack.id]);
      if (!updatedDrumTrack) {
        console.warn(`Drum track ${drumTrackId} not found or invalid. Rolling back sampler creation.`);
        // Rollback: Delete the created sampler if linking failed
        await handleTrackDelete(samplerTrack.id);
        return null; // Indicate failure
      }
      
      console.log(`Added empty sampler ${samplerTrack.id} to drum track ${drumTrackId}`);
      return samplerTrack.id; // Return the new sampler track ID
    };

    return _withErrorHandling(addEmptyLogic, 'addEmptySamplerToDrumTrack')();
  };

  // Action to download the audio associated with a sampler track
  const downloadSamplerTrack = async (trackId: string): Promise<{audioBlob?: Blob, midiBlob?: Blob, trackName: string} | null> => {
    const { findTrackById, _withErrorHandling } = rootGet();

    if (!_withErrorHandling) {
        console.error("_withErrorHandling not available for downloadSamplerTrack");
        return null;
    }

    const downloadLogic = async (): Promise<{audioBlob?: Blob, midiBlob?: Blob, trackName: string} | null> => {
        const track = findTrackById(trackId);
        
        // Validate track exists and is a sampler
        if (!track || track.type !== 'sampler') {
          throw new Error(`Track ${trackId} is not a valid sampler track`);
        }
        
        // Use more specific type if possible, or keep assertion
        const samplerTrackData = track.track as SamplerTrackRead | undefined; 
        const trackName = track.name || "Sampler Track";
        let audioBlob: Blob | undefined;
        let midiBlob: Blob | undefined;
        
        // Download Audio
        const audioStorageKey = samplerTrackData?.audio_storage_key;
        if (audioStorageKey) {
          console.log(`Attempting download for sampler ${trackId} using key ${audioStorageKey}`);
          try {
            audioBlob = await downloadAudioTrackFile(audioStorageKey);
            console.log(`Downloaded audio for sampler ${trackId}`);
          } catch (error) {
            console.error(`Failed to download audio for sampler track ${trackId}:`, error);
            // Don't throw here, return null blob but valid name
          }
        } else {
             console.warn(`Sampler track ${trackId} has no audioStorageKey for download.`);
        }
        
        // Process and Download MIDI
        const midiJson = samplerTrackData?.midi_notes_json;
        if (midiJson) {
            console.log(`Processing MIDI notes for sampler track ${trackId}`);
            try {
                // Revert: Cast midiJson to string first, pass trackId second
                const notes = convertJsonToNotes(trackId, midiJson);
                if (notes && notes.length > 0) {
                    midiBlob = await convertNotesToMidiBlob(notes, trackName) || undefined;
                    if (midiBlob) {
                        console.log(`Generated MIDI blob for sampler track ${trackId}`);
                    } else {
                        console.warn(`Failed to generate MIDI blob for sampler track ${trackId}`);
                    }
                }
            } catch(error) {
                console.error(`Error processing MIDI for sampler track ${trackId}:`, error);
            }
        }

        return { audioBlob, midiBlob, trackName };
    };

    return _withErrorHandling(downloadLogic, 'downloadSamplerTrack')();
  };

  return {
    // Actions
    addSamplerToDrumTrack,
    removeSamplerFromDrumTrack,
    addEmptySamplerToDrumTrack,
    downloadSamplerTrack,
  };
};
