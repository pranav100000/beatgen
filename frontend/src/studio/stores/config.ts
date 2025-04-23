import { Store } from '../core/state/store';
import { TrackType, GetFn, AudioTrackOptions, MidiTrackOptions, SamplerTrackOptions, TrackOptions } from './types';
import { calculateTrackWidth } from '../constants/gridConstants';
import { db } from '../core/db/dexie-client';
import SampleManager from '../core/samples/sampleManager';

// Default configuration for samplers
export const DEFAULT_SAMPLER_CONFIG = {
  baseMidiNote: 60,
  grainSize: 0.1,
  overlap: 0.1
};

// Track type-specific configurations with unified interface
// NOTE: This relies on the Store instance being available. 
// If slices need this config *before* the store is fully initialized in the RootState,
// this might need adjustment (e.g., passing store explicitly to initEngine calls).
export const TRACK_CONFIG: Record<TrackType, {
    getDefaultName: (count: number, instrumentName?: string) => string;
    initTrack: (id: string, file?: File) => Record<string, any>;
    initEngine: (store: Store, trackId: string, get: GetFn, options?: TrackOptions) => Promise<any>;
}> = {
  audio: {
    getDefaultName: (count: number, instrumentName?: string) => instrumentName || `Audio Track ${count}`,
    initTrack: (id: string, file?: File) => ({ type: 'audio' as const, audioFile: file }),
    initEngine: async (store: Store, trackId: string, get: GetFn, options?: TrackOptions) => {
      const file = options && (options as AudioTrackOptions).audioFile;
      if (!file) return Promise.resolve();
      
      console.log(`TRACK_CONFIG[audio].initEngine: Loading file for track ${trackId}...`);
      await store.loadAudioFile(trackId, file);
      console.log(`TRACK_CONFIG[audio].initEngine: File loaded for track ${trackId}. Fetching metadata...`);

      const engineTrack = store.getAudioEngine().getAllTracks().find(t => t.id === trackId);
      if (!engineTrack?.player?.buffer) {
        console.error(`Failed to get audio buffer after loading for track ${trackId}`);
        return;
      }

      const buffer = engineTrack.player.buffer;
      const duration = buffer.duration;
      const sampleRate = buffer.sampleRate;
      const format = file.type;
      const size = file.size;

      console.log(`TRACK_CONFIG[audio].initEngine: Metadata for ${trackId}:`, { duration, sampleRate, format, size });

      try {
        await db.addAudioFile(trackId, file, duration);
        console.log(`TRACK_CONFIG[audio].initEngine: Saved audio file to Dexie for track ${trackId}`);
      } catch (dbError) {
        console.error(`TRACK_CONFIG[audio].initEngine: Failed to save audio file to Dexie for track ${trackId}:`, dbError);
        return;
      }

      const { _updateNestedTrackData } = get(); 
      
      if (_updateNestedTrackData) {
        _updateNestedTrackData(trackId, {
          audio_file_duration: duration,
          audio_file_sample_rate: sampleRate,
          audio_file_format: format,
          audio_file_size: size,
          audio_file_name: file.name,
        });
        console.log(`TRACK_CONFIG[audio].initEngine: Dispatched nested state update for ${trackId}.`);
      } else {
        console.error(`TRACK_CONFIG[audio].initEngine: _updateNestedTrackData function not found!`);
      }
    },
  },
  midi: {
    getDefaultName: (count: number, instrumentName?: string) => instrumentName || `MIDI Track ${count}`,
    initTrack: (id: string) => ({ type: 'midi' as const }),
    initEngine: async (store: Store, trackId: string, get: GetFn, options?: TrackOptions) => {
      const instrumentId = options && (options as MidiTrackOptions).instrumentId;
      return instrumentId ? store.connectTrackToSoundfont(trackId, instrumentId) : Promise.resolve();
    },
  },
  drum: {
    getDefaultName: (count: number, instrumentName?: string) => instrumentName || `Drum Sequencer ${count}`,
    initTrack: (id: string) => ({ 
      type: 'drum' as const, 
      drumPattern: Array(4).fill(null).map(() => Array(64).fill(false)) 
    }),
    initEngine: async (store: Store, trackId: string, get: GetFn, options?: TrackOptions) => Promise.resolve(),
  },
  sampler: {
    getDefaultName: (count: number, instrumentName?: string) => instrumentName || `Sampler ${count}`,
    initTrack: (id: string, file?: File) => ({ 
      type: 'sampler' as const, 
      baseMidiNote: DEFAULT_SAMPLER_CONFIG.baseMidiNote,
      grainSize: DEFAULT_SAMPLER_CONFIG.grainSize,
      overlap: DEFAULT_SAMPLER_CONFIG.overlap
    }),
    initEngine: async (store: Store, trackId: string, get: GetFn, options?: SamplerTrackOptions) => {
      const sampleManager = store.getSampleManager();
      if (!sampleManager) {
        console.error(`SampleManager not available on Store instance for sampler initEngine (track: ${trackId})`);
        return Promise.resolve();
      }

      const storageKey = options?.storage_key;
      const trackName = options?.name;

      if (!storageKey) {
          console.warn(`TRACK_CONFIG[sampler].initEngine: No storage_key provided in options for track ${trackId}. Cannot load sample.`);
          const existingBlob = await sampleManager.getSampleBlob(trackId, '', 'sample');
          if (!existingBlob) {
              console.error(`Failed to get blob via ID ${trackId} either.`);
              return Promise.resolve();
          }
          console.log(`Found cached blob for ID ${trackId} despite missing storageKey in options.`);
      }
      
      console.log(`TRACK_CONFIG[sampler].initEngine: Getting sample blob for track ${trackId} (storageKey: ${storageKey})`);
      const sampleFile = await sampleManager.getSampleBlob(trackId, storageKey!, 'sample', trackName);

      if (!sampleFile) {
        console.error(`TRACK_CONFIG[sampler].initEngine: Failed to get sample blob for track ${trackId} using storageKey ${storageKey}`);
        return Promise.resolve();
      }

      const samplerController = store.getTransport().getSamplerController();
      const midiManager = store.getMidiManager();
      if (!samplerController || !midiManager) {
        console.warn('SamplerController or MidiManager not available for sampler initEngine');
        return Promise.resolve();
      }
      
      const trackData = get().findTrackById(trackId);
      const baseMidiNote = options?.baseMidiNote ?? (trackData?.track as any)?.baseMidiNote ?? DEFAULT_SAMPLER_CONFIG.baseMidiNote;
      const grainSize = options?.grainSize ?? (trackData?.track as any)?.grainSize ?? DEFAULT_SAMPLER_CONFIG.grainSize;
      const overlap = options?.overlap ?? (trackData?.track as any)?.overlap ?? DEFAULT_SAMPLER_CONFIG.overlap;

      try {
        console.log(`Connecting sampler ${trackId} to controller using retrieved blob`);
        const file = new File([sampleFile.data], trackName || sampleFile.name, { type: sampleFile.type });
        await samplerController.connectTrackToSampler(
          trackId,
          file,
          midiManager,
          baseMidiNote,
          grainSize,
          overlap
        );
        samplerController.registerTrackSubscription(trackId, midiManager);
      } catch (connectError) {
        console.error(`Error connecting sampler track ${trackId} in initEngine:`, connectError);
      }
      return Promise.resolve();
    },
  }
};
