import * as Tone from 'tone';
import { Store } from '../../core/state/store';
import { ProjectWithTracks, CombinedTrack, AudioTrackRead, MidiTrackRead, SamplerTrackRead, DrumTrackRead } from 'src/platform/types/project';
import { getProject } from '../../../platform/api/projects';
import { downloadFile } from '../../../platform/api/sounds';
import { Actions } from '../../core/state/history/actions';
import { DEFAULT_SAMPLER_CONFIG, TRACK_CONFIG } from '../config';
import { 
  RootState, 
  SetFn, 
  GetFn, 
  StoreSliceCreator, 
  ProjectParam, 
  TrackType
} from '../types';
import { GRID_CONSTANTS } from '../../constants/gridConstants';
import { convertJsonToNotes, Note } from '../../../types/note';
import { db } from '../../core/db/dexie-client'; // Import db instance

// Define the state properties for this slice
export interface ProjectSlice {
  projectTitle: string;
  bpm: number;
  timeSignature: [number, number];
  keySignature: string;
  setProjectTitle: (title: string) => void;
  setBpm: (bpm: number) => void;
  setTimeSignature: (numerator: number, denominator: number) => void;
  setKeySignature: (keySignature: string) => void;
  loadProject: (projectId: string) => Promise<ProjectWithTracks | null>;
}

// Create the slice function
export const createProjectSlice: StoreSliceCreator<ProjectSlice> = (set, get) => {
  const setProjectState = (partial: Partial<ProjectSlice> | ((state: ProjectSlice) => Partial<ProjectSlice>)) => set(partial);
  const rootGet = get as GetFn; // Define rootGet once for convenience

  // Helper to handle project parameter changes (extracted from original store)
  const handleProjectParamChange = (param: ProjectParam, value: any) => {
    const { store, bpm: oldBpm, timeSignature: oldTimeSignature, keySignature: oldKeySignature, executeHistoryAction, _withStore } = rootGet();

    if (!store) {
      console.warn("Store not available in handleProjectParamChange");
      return;
    }

    const oldValue = rootGet()[param];
    if (oldValue === value) return;

    // Update local slice state
    setProjectState({ [param]: value } as any);

    // Update core engine state and history based on parameter type
    switch (param) {
      case 'projectTitle':
        if (store.projectManager.getCurrentProject()) {
          store.projectManager.setProjectName(value as string);
        }
        break;
      case 'bpm':
        const bpmValue = value as number;
        store.projectManager.setTempo(bpmValue);
        Tone.Transport.bpm.value = bpmValue;
        store.getTransport().setTempo(bpmValue);
        
        const bpmAction = new Actions.BPMChange(get, oldValue as number, bpmValue, rootGet().timeSignature);
        executeHistoryAction(bpmAction);
        break;
      case 'timeSignature':
        const [numerator, denominator] = value as [number, number];
        store.projectManager.setTimeSignature(numerator, denominator);
        Tone.Transport.timeSignature = value as [number, number];
        
        const timeAction = new Actions.TimeSignature(get, oldValue as [number, number], value as [number, number], rootGet().bpm);
        executeHistoryAction(timeAction);
        break;
      case 'keySignature':
        const keySigValue = value as string;
        const keyAction = new Actions.KeySignature(get, oldValue as string, keySigValue);
        executeHistoryAction(keyAction);
        break;
    }
  };

  // Helper to fetch data (extracted)
  const fetchProjectData = async (projectId: string): Promise<ProjectWithTracks | null> => {
    const { _withErrorHandling } = rootGet();
    const fetchData = async (): Promise<ProjectWithTracks | null> => {
      const projectData = await getProject(projectId); 
      console.log('Project data loaded:', projectData);
      return projectData as ProjectWithTracks || null; 
    };
    if (!_withErrorHandling) return null;
    return _withErrorHandling(fetchData, 'fetchProjectData')();
  };

  // Helper to initialize project settings (extracted)
  const initializeProjectSettings = async (projectData: ProjectWithTracks) => {
     const { _withStore, store } = rootGet();
     const initSettings = (store: Store, projectData: ProjectWithTracks) => {
        setProjectState({
          projectTitle: projectData.name,
          bpm: projectData.bpm,
          timeSignature: [
            projectData.time_signature_numerator,
            projectData.time_signature_denominator
          ],
          keySignature: projectData.key_signature
        });
        
        const currentProject = store.projectManager.getCurrentProject();
        const projectToUse = currentProject && projectData.id && currentProject.id === projectData.id 
                             ? currentProject 
                             : store.projectManager.createProject(projectData.name);

        store.projectManager.setTempo(projectData.bpm);
        store.projectManager.setTimeSignature(
          projectData.time_signature_numerator,
          projectData.time_signature_denominator
        );
        
        Tone.Transport.bpm.value = projectData.bpm;
        Tone.Transport.timeSignature = [
          projectData.time_signature_numerator,
          projectData.time_signature_denominator
        ];
        
        return projectToUse;
     }
     if (!_withStore) return null;
     return _withStore(initSettings)(projectData); 
  };

  // Refined processTrack for loading state (no history)
  const processTrack = async (apiTrack: any, index: number): Promise<CombinedTrack | null> => {
      console.log(`Processing loaded track ${index}: ${apiTrack.name} (${apiTrack.id})`);
      const { store, _withStore, _withErrorHandling } = rootGet(); 

      if (!_withStore || !_withErrorHandling) {
        console.error("_withStore or _withErrorHandling not available in processTrack");
        return null;
      }

      const processLogic = async (store: Store): Promise<CombinedTrack | null> => {
          const trackType = apiTrack.type as TrackType;
          if (!TRACK_CONFIG[trackType]) { 
            console.error("Invalid track type from API:", trackType);
            return null;
          }
          const position = {
              x: apiTrack.x_position ?? 0,
              y: apiTrack.y_position ?? (index * GRID_CONSTANTS.trackHeight)
          };

          const combinedTrackData: Omit<CombinedTrack, 'track'> & { track?: any } = {
              id: apiTrack.id,
              name: apiTrack.name,
              type: trackType,
              volume: apiTrack.volume ?? 80,
              pan: apiTrack.pan ?? 0,
              mute: apiTrack.mute ?? false,
              x_position: position.x,
              y_position: position.y,
              trim_start_ticks: apiTrack.trim_start_ticks ?? 0,
              trim_end_ticks: apiTrack.trim_end_ticks ?? null, 
              duration_ticks: apiTrack.duration_ticks ?? 0,
          };

          // 2. Populate the nested .track property based on type
          let nestedTrackData: any = { type: trackType, id: apiTrack.id, name: apiTrack.name }; // Base
          const apiTrackData = apiTrack.track; // Assuming the specific data is here

          if (apiTrackData) {
              switch (trackType) {
                  case 'audio':
                      nestedTrackData = { ...nestedTrackData, ...(apiTrackData as AudioTrackRead) };
                      // Ensure necessary fields like audio_file_storage_key are present
                      break;
                  case 'midi':
                      nestedTrackData = { ...nestedTrackData, ...(apiTrackData as MidiTrackRead) };
                      if ((apiTrackData as MidiTrackRead).midi_notes_json) {
                          try {
                              // Cast to unknown then to string
                              const jsonString = (apiTrackData as MidiTrackRead).midi_notes_json as unknown as string;
                              nestedTrackData.notes = convertJsonToNotes(jsonString, apiTrack.id); 
                              console.log(`Parsed ${nestedTrackData.notes?.length} MIDI notes for track ${apiTrack.id}`);
                          } catch (e) {
                              console.error(`Failed to parse midiNotesJson for MIDI track ${apiTrack.id}:`, e);
                              nestedTrackData.notes = []; 
                          }
                      } else {
                          nestedTrackData.notes = []; 
                      }
                      break;
                  case 'drum':
                       nestedTrackData = { ...nestedTrackData, ...(apiTrackData as DrumTrackRead) };
                       // Ensure essential drum properties exist
                       nestedTrackData.drumPattern = (apiTrackData as any).drumPattern || Array(4).fill(null).map(() => Array(64).fill(false)); 
                       nestedTrackData.samplerTrackIds = (apiTrackData as any).samplerTrackIds || [];
                       break;
                  case 'sampler':
                      nestedTrackData = { ...nestedTrackData, ...(apiTrackData as SamplerTrackRead) };
                      nestedTrackData.baseMidiNote = (apiTrackData as any).base_midi_note ?? DEFAULT_SAMPLER_CONFIG.baseMidiNote;
                      nestedTrackData.grainSize = (apiTrackData as any).grain_size ?? DEFAULT_SAMPLER_CONFIG.grainSize;
                      nestedTrackData.overlap = (apiTrackData as any).overlap ?? DEFAULT_SAMPLER_CONFIG.overlap;
                      // Process midiNotesJson for sampler if it exists
                      if ((apiTrackData as SamplerTrackRead).midi_notes_json) {
                           console.log(`Processing midiNotesJson for sampler track ${apiTrack.id}`);
                           try {
                              // Cast to unknown then to string
                              const jsonString = (apiTrackData as SamplerTrackRead).midi_notes_json as unknown as string;
                              nestedTrackData.notes = convertJsonToNotes(jsonString, apiTrack.id); 
                              console.log(`Parsed ${nestedTrackData.notes?.length} MIDI notes for sampler track ${apiTrack.id}`);
                          } catch (e) {
                              console.error(`Failed to parse midiNotesJson for sampler track ${apiTrack.id}:`, e);
                              nestedTrackData.notes = []; 
                          }
                      } else {
                           nestedTrackData.notes = []; 
                      }
                     break;
              }
          }
          
          const finalCombinedTrack = { ...combinedTrackData, track: nestedTrackData } as CombinedTrack;

          // 3. Perform necessary ENGINE setup (NO HISTORY)
          const audioEngine = store.getAudioEngine();
          await audioEngine.createTrack(finalCombinedTrack.id, finalCombinedTrack.name);
          audioEngine.setTrackVolume(finalCombinedTrack.id, finalCombinedTrack.volume);
          audioEngine.setTrackPan(finalCombinedTrack.id, finalCombinedTrack.pan);
          audioEngine.setTrackMute(finalCombinedTrack.id, finalCombinedTrack.mute);
          audioEngine.setTrackPosition(finalCombinedTrack.id, finalCombinedTrack.x_position, finalCombinedTrack.y_position);
          
          // Load audio file specifically for audio tracks during initial processing
          if (trackType === 'audio' && finalCombinedTrack.track && 'audio_file_storage_key' in finalCombinedTrack.track) {
              const storageKey = finalCombinedTrack.track.audio_file_storage_key;
              if (storageKey) {
                  console.log(`Attempting to load audio for track ${finalCombinedTrack.id} from key ${storageKey}...`);
                  try {
                      const audioBlob = await downloadFile(storageKey);
                      if (audioBlob) {
                          const audioFile = new File([audioBlob], finalCombinedTrack.name || 'audio_track', { type: audioBlob.type });
                          await store.loadAudioFile(finalCombinedTrack.id, audioFile);
                          console.log(`Called store.loadAudioFile for track ${finalCombinedTrack.id}`);
                      } else {
                          console.warn(`Downloaded audio blob was null or undefined for track ${finalCombinedTrack.id}`);
                      }
                  } catch (error) {
                      console.error(`Failed to download or load audio for track ${finalCombinedTrack.id} (key: ${storageKey}):`, error);
                  }
              } else {
                   console.warn(`Audio track ${finalCombinedTrack.id} has no audio_file_storage_key.`);
              }
          }
          
          return finalCombinedTrack;
      };
      
      return _withErrorHandling(async () => _withStore(processLogic)(), `processTrack: ${apiTrack.id}`)();
  };

  // Modified connectTracksToEngines
  const connectTracksToEngines = async (loadedTracks: CombinedTrack[]) => {
      console.log(`Connecting ${loadedTracks.length} tracks to engines...`);
      const { store, _withStore, _withErrorHandling } = rootGet(); 
      if (!_withStore || !_withErrorHandling) { return; }

      const connectLogic = async (store: Store, tracks: CombinedTrack[]) => {
        const samplerController = store.getTransport().getSamplerController();
        const midiManager = store.getMidiManager();

        for (const track of tracks) {
          console.log(`Connecting track ${track.id} (type: ${track.type})`);
          try {
              // --- MIDI Connection --- 
              if (track.type === 'midi' && track.track && 'instrument_file' in track.track) {
                  const instrumentId = track.track.instrument_file?.id;
                  if (instrumentId) {
                      await store.connectTrackToSoundfont(track.id, instrumentId);
                      console.log(`Connected MIDI track ${track.id} to soundfont ${instrumentId}`);
                  } else { console.warn(`MIDI track ${track.id} missing instrumentId`); }
                  const convertedNotes = convertJsonToNotes(track.id, track.track.midi_notes_json);
                  midiManager.updateTrack(track.id, convertedNotes);
              }
              
              // --- Audio Connection --- 
              else if (track.type === 'audio') {
                  console.log(`Attempting to connect audio track ${track.id}... checking Dexie.`);
                  const fileFromDb = await db.getAudioFile(track.id);
                  if (fileFromDb?.data) {
                      console.log(`Found audio for track ${track.id} in Dexie. Loading into engine...`);
                      // Fix: Convert Blob from Dexie back to a File object
                      const audioFile = new File(
                          [fileFromDb.data],
                          fileFromDb.name || track.name || `${track.id}_audio`, // Use name from DB or track
                          { type: fileFromDb.data.type } // Use blob's type
                      );
                      await store.loadAudioFile(track.id, audioFile);
                  } else {
                      console.warn(`Audio file for track ${track.id} not found in Dexie cache.`);
                  }
              }

              // --- Sampler Connection --- 
              else if (track.type === 'sampler') {
                  if (!samplerController || !midiManager) {
                      console.warn(`SamplerController/MidiManager missing for sampler track ${track.id}`);
                      continue;
                  }
                  const samplerTrackData = track.track as SamplerTrackRead | undefined;
                  const baseMidiNote = samplerTrackData?.base_midi_note ?? DEFAULT_SAMPLER_CONFIG.baseMidiNote;
                  const grainSize = samplerTrackData?.grain_size ?? DEFAULT_SAMPLER_CONFIG.grainSize;
                  const overlap = samplerTrackData?.overlap ?? DEFAULT_SAMPLER_CONFIG.overlap;
                  let sampleFile: Blob | undefined = undefined; // Expect Blob from Dexie

                  console.log(`Attempting to connect sampler track ${track.id}... checking Dexie.`);
                  const fileFromDb = await db.getAudioFile(track.id);
                  if (fileFromDb?.data) {
                       console.log(`Found audio for sampler ${track.id} in Dexie.`);
                       sampleFile = fileFromDb.data; 
                  } else {
                      console.warn(`Audio file for sampler track ${track.id} not found in Dexie cache.`);
                  }

                  if (sampleFile) {
                      // Convert Blob to File if necessary for connectTrackToSampler
                      const fileToConnect = new File([sampleFile], track.name || 'sampler_audio', { type: sampleFile.type });
                      console.log(`Connecting sampler ${track.id} with cached file...`);
                      await samplerController.connectTrackToSampler(
                          track.id, fileToConnect, midiManager, baseMidiNote, grainSize, overlap
                      );
                  } else {
                      console.log(`Initializing empty sampler for ${track.id}...`);
                      await samplerController.initializeSampler(
                          track.id, undefined, baseMidiNote, grainSize, overlap
                      );
                  }
                  const convertedNotes = convertJsonToNotes(track.id, samplerTrackData?.midi_notes_json);
                  console.log(`Converted ${convertedNotes.length} notes for sampler track ${track.id}: ${JSON.stringify(convertedNotes)}`);
                  midiManager.updateTrack(track.id, convertedNotes);
                  samplerController.registerTrackSubscription(track.id, midiManager);
              }
          } catch (error) {
               console.error(`Error connecting track ${track.id} (type: ${track.type}):`, error);
          }
        }
      }
      await _withErrorHandling(async () => _withStore(connectLogic)(loadedTracks), 'connectTracksToEngines')();
      console.log('Finished connecting tracks to engines.');
  };

  // Download and cache audio files if they aren't in Dexie
  const downloadAndCacheAudioFiles = async (tracks: CombinedTrack[]): Promise<void> => {
    console.log('Starting audio file download and cache process...');
    const downloadPromises = tracks.map(async (track) => {
      let storageKey: string | undefined | null = null;
      let fileType: string = 'audio'; // Default or determine based on track type

      if (track.type === 'audio' && track.track && 'audio_file_storage_key' in track.track) {
        storageKey = track.track.audio_file_storage_key;
        fileType = track.track.audio_file_format || fileType;
      } else if (track.type === 'sampler' && track.track && 'audio_storage_key' in track.track) {
        storageKey = track.track.audio_storage_key;
        fileType = track.track.audio_file_format || fileType; // Distinguish sampler audio if needed
      }

      if (!storageKey) {
        // No key associated with this track
        return { trackId: track.id, status: 'skipped', reason: 'No storage key' };
      }

      try {
        const existingFile = await db.getAudioFile(track.id);
        if (existingFile) {
          // File already in Dexie
          console.log(`Cache hit for track ${track.id}`);
          return { trackId: track.id, status: 'cached' };
        }
        
        // File not in Dexie, download it
        console.log(`Cache miss for track ${track.id}, downloading key ${storageKey}...`);
        const downloadedBlob = await downloadFile(storageKey);
        
        if (downloadedBlob) {
          // Convert Blob to File for metadata (name primarily)
          // Use track name or generate one if unavailable
          const fileName = track.name || `${track.id}_${fileType}`;
          // Infer type from blob or use a default if necessary
          const fileObject = new File([downloadedBlob], fileName, { type: downloadedBlob.type || 'audio/mpeg' }); 
          
          // Add to Dexie using track.id as the key, duration is initially unknown
          await db.addAudioFile(track.id, fileObject, undefined); 
          console.log(`Successfully downloaded and cached audio for track ${track.id}`);
          return { trackId: track.id, status: 'downloaded' };
        } else {
          console.warn(`Download returned null/undefined for track ${track.id}, key ${storageKey}`);
          return { trackId: track.id, status: 'failed', reason: 'Download empty' };
        }
      } catch (error) {
        console.error(`Error during download/cache for track ${track.id} (key: ${storageKey}):`, error);
        return { trackId: track.id, status: 'failed', reason: error };
      }
    });

    // Wait for all downloads/checks to complete (or fail)
    const results = await Promise.allSettled(downloadPromises);
    console.log('Audio file download and cache process completed.', results);
    // Optionally handle failed downloads here (e.g., notify user, retry)
  };

  // Optimized project loading flow
  const loadProject = async (projectId: string): Promise<ProjectWithTracks | null> => {
    const { _withErrorHandling } = rootGet();
    if (!_withErrorHandling) return null;

    const loadLogic = async (): Promise<ProjectWithTracks | null> => {
        if (!get().isInitialized) { await get().initializeAudio(); }
        
        // 1. Fetch project data (includes track list with storage keys)
        const projectDataWithTracks = await fetchProjectData(projectId);
        if (!projectDataWithTracks?.tracks) { // Ensure tracks array exists
            console.warn('Project data loaded but contains no tracks array.');
            // Initialize settings even if no tracks?
            if(projectDataWithTracks) await initializeProjectSettings(projectDataWithTracks);
            return projectDataWithTracks || null;
        }
        const tracksToProcess = projectDataWithTracks.tracks || [];

        // 2. Download and Cache Audio Files (NEW STEP)
        await downloadAndCacheAudioFiles(tracksToProcess);

        // 3. Initialize project settings
        await initializeProjectSettings(projectDataWithTracks);
        
        // 4. Process tracks (create state objects, basic engine setup)
        const trackProcessingPromises = tracksToProcess.map((apiTrack, index) => 
            processTrack(apiTrack, index) // processTrack should NOT load files anymore
        );
        const trackStates = (await Promise.all(trackProcessingPromises)).filter(Boolean) as CombinedTrack[];
        
        // 5. Update Zustand state with initial track data
        get().updateTracks(trackStates);
        
        // 6. Connect tracks to engines (will load audio from Dexie)
        await connectTracksToEngines(trackStates);
                
        return projectDataWithTracks; 
    }
    return _withErrorHandling(loadLogic, 'loadProject')();
  };

  return {
    projectTitle: "Untitled Project",
    bpm: 120,
    timeSignature: [4, 4],
    keySignature: "C major",
    setProjectTitle: (title) => handleProjectParamChange('projectTitle', title),
    setBpm: (bpm) => handleProjectParamChange('bpm', bpm),
    setTimeSignature: (numerator, denominator) => handleProjectParamChange('timeSignature', [numerator, denominator]),
    setKeySignature: (key) => handleProjectParamChange('keySignature', key),
    loadProject,
  };
};
