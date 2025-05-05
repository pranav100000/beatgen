import { Store } from '../../core/state/store';
import { RootState, SetFn, GetFn, StoreSliceCreator, TrackOptions, TrackType, DrumTrackRead } from '../types';
import { CombinedTrack } from 'src/platform/types/project';
import { SamplerTrackBase, SamplerTrackRead } from 'src/platform/types/track_models/sampler_track'; // Added SamplerTrackRead
import { downloadAudioTrackFile } from '../../../platform/api/sounds'; // Adjust path as needed
import { DEFAULT_SAMPLER_CONFIG } from '../config';
// Import note types and conversion utility
import { Note } from '../../../types/note'; 
import { convertJsonToNotes } from '../../../types/note'; 
// Import Tone.js MIDI library
import { Midi } from '@tonejs/midi'; 
import { produce } from 'immer';

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

  // Refactored Helper using Immer
  const updateDrumTrackSamplers = (drumTrackId: string, operation: 'add' | 'remove', samplerIds: string[]): void => {
    set(produce((draft: RootState) => {
        const drumTrackIndex = draft.tracks.findIndex(t => t.id === drumTrackId && t.type === 'drum');
        if (drumTrackIndex === -1) {
          console.error(`Drum track ${drumTrackId} not found for sampler update.`);
          return; // Exit draft modification
        }
    
        // Ensure the track property exists and has samplerTrackIds (or initialize)
        const drumTrack = draft.tracks[drumTrackIndex];
        if (!drumTrack.track) {
            console.error(`Drum track ${drumTrackId} has no nested track data.`);
            return;
        }
        // Initialize if undefined
        if (!(drumTrack.track as DrumTrackRead).sampler_track_ids) {
            (drumTrack.track as DrumTrackRead).sampler_track_ids = [];
        }
        
        const currentSamplerIds = (drumTrack.track as DrumTrackRead).sampler_track_ids;
        let updatedSamplerIds: string[];

        if (operation === 'add') {
            // Create a set to efficiently handle potential duplicates
            const idSet = new Set([...currentSamplerIds, ...samplerIds]);
            updatedSamplerIds = Array.from(idSet);
        } else { // remove
            updatedSamplerIds = currentSamplerIds.filter(id => !samplerIds.includes(id));
        }
        
        // Mutate the draft directly
        // Use type assertion assuming samplerTrackIds exists after initialization
        (drumTrack.track as DrumTrackRead).sampler_track_ids = updatedSamplerIds; 

        console.log(`Updated drum track ${drumTrackId} samplers via Immer:`, updatedSamplerIds);
    })); // Removed action name argument
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
      updateDrumTrackSamplers(drumTrackId, 'add', [newSamplerTrack.id]);
      
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
      updateDrumTrackSamplers(drumTrackId, 'remove', [samplerTrackIdToDelete]);
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
      updateDrumTrackSamplers(drumTrackId, 'add', [samplerTrack.id]);
      
      // Check if linking failed (e.g., drum track was deleted concurrently? Unlikely but possible)
      // Re-fetch drum track state AFTER update attempt
      const updatedDrumTrackState = rootGet().tracks.find(t => t.id === drumTrackId);
      if (!updatedDrumTrackState || !(updatedDrumTrackState.track as DrumTrackRead).sampler_track_ids?.includes(samplerTrack.id)) {
          console.warn(`Drum track ${drumTrackId} link failed or track deleted. Rolling back sampler creation.`);
          await handleTrackDelete(samplerTrack.id);
          return null; 
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
                const notes = convertJsonToNotes(midiJson, trackId);
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
