# Revised Implementation Plan for MidiSoundfontPlayer Integration

## Design Decision: Transport-Centered Architecture

After careful analysis of the codebase, we've decided to refine our architectural approach. The initial implementation had the SoundfontController owned by the Store, but this created awkward circular dependencies. Instead, we're moving to a transport-centered architecture where:

1. **TransportController owns SoundfontController**: This aligns better with our architecture since transport is responsible for all playback coordination.
2. **SoundfontController just delegates to MidiSoundfontPlayer**: Provides clean integration with the existing codebase.
3. **Store acts as coordinator**: Store continues its role as the central coordinator.

## Implementation Steps

### 1. Update TransportController

```typescript
// In TransportController

// Add property
private soundfontController: SoundfontEngineController;

// Initialize in constructor
constructor() {
    this.audioEngine = AudioEngine.getInstance();
    Tone.getTransport().bpm.value = 120;
    this.soundfontController = new SoundfontEngineController();
    // Will be initialized later with audio context
}

// Add initialization method
async initializeSoundfont(audioContext: AudioContext): Promise<void> {
    try {
        console.log('TransportController: Initializing SoundfontController');
        await this.soundfontController.initialize(audioContext);
        console.log('TransportController: SoundfontController initialized successfully');
    } catch (error) {
        console.error('TransportController: Failed to initialize SoundfontController:', error);
        throw error;
    }
}

// Add connection method
async connectTrackToSoundfont(trackId: string, instrumentId: string, midiManager: MidiManager): Promise<void> {
    try {
        console.log(`TransportController: Connecting track ${trackId} to soundfont ${instrumentId}`);
        await this.soundfontController.connectTrackToSoundfont(trackId, instrumentId, midiManager);
        console.log(`TransportController: Successfully connected track ${trackId} to soundfont ${instrumentId}`);
    } catch (error) {
        console.error(`TransportController: Failed to connect track ${trackId} to soundfont ${instrumentId}:`, error);
        throw error;
    }
}

// Update existing methods to coordinate with SoundfontController
public setTempo(bpm: number): void {
    const validBpm = Math.max(20, Math.min(bpm, 300));
    Tone.getTransport().bpm.value = validBpm;
    
    // Also update tempo in SoundfontController
    this.soundfontController.setGlobalBPM(validBpm);
}

// Add access method
public getSoundfontController(): SoundfontEngineController {
    return this.soundfontController;
}
```

### 2. Update Store Integration

```typescript
// In Store

// Update initializeAudio method
public async initializeAudio(): Promise<void> {
    if (this.initialized) return;
    
    try {
        // Initialize audio engine
        await this.audioEngine.initialize();
        
        // Create a proper AudioContext
        const audioContext = new AudioContext({
            latencyHint: 'interactive',
            sampleRate: 44100
        });
        
        // Initialize soundfont controller in the transport
        await this.transportController.initializeSoundfont(audioContext);
        
        this.initialized = true;
        this.syncTracksFromProjectManager();
    } catch (error) {
        console.error('Store: Audio initialization failed:', error);
        throw error;
    }
}

// Update connectTrackToSoundfont to delegate to transport
public async connectTrackToSoundfont(trackId: string, instrumentId: string): Promise<void> {
    if (!this.initialized) {
        throw new Error('Store must be initialized before connecting tracks to soundfonts');
    }
    
    try {
        console.log(`Store: Connecting track ${trackId} to soundfont ${instrumentId}`);
        await this.transportController.connectTrackToSoundfont(trackId, instrumentId, this.midiManager);
        console.log(`Store: Successfully connected track ${trackId} to soundfont ${instrumentId}`);
    } catch (error) {
        console.error(`Store: Failed to connect track ${trackId} to soundfont ${instrumentId}:`, error);
        throw error;
    }
}
```

### 3. Update useStudioStore to Connect Tracks

```typescript
// In handleInstrumentChange in useStudioStore.ts
handleInstrumentChange: async (trackId, instrumentId, instrumentName) => {
    const { store, tracks } = get();
    if (!store) return;
    
    console.log(`Changing instrument for track ${trackId} to ${instrumentName} (${instrumentId})`);
    
    // Update local state
    const updatedTracks = tracks.map(t => 
        t.id === trackId ? { ...t, instrumentId, instrumentName } : t
    );
    
    set({ tracks: updatedTracks });
    
    // Connect track to soundfont
    try {
        await store.connectTrackToSoundfont(trackId, instrumentId);
    } catch (error) {
        console.error(`Failed to connect track ${trackId} to soundfont:`, error);
    }
},

// In handleAddTrack in useStudioStore.ts
// After creating the track:
if ((type === 'midi' || type === 'drum') && instrumentId) {
    try {
        await store.connectTrackToSoundfont(trackData.id, instrumentId);
    } catch (error) {
        console.error(`Failed to connect new track to soundfont:`, error);
    }
}
```

### 4. Ensure SoundfontEngineController Has Proper Methods

Verify that SoundfontEngineController has these methods properly implemented:
- `initialize(audioContext: AudioContext)`
- `connectTrackToSoundfont(trackId, instrumentId, midiManager)`
- `play()`, `pause()`, `stop()`, `seek()`
- `muteTrack()`, `setTrackVolume()`, `setTrackOffset()`
- `setGlobalBPM()`

### 5. Test Integration

1. Initialize the audio system
2. Add a MIDI track with an instrument
3. Verify track is connected to soundfont
4. Test playback controls
5. Test seeking
6. Test track controls
7. Test adding/updating notes

### Troubleshooting

If you encounter issues with the audio context initialization, ensure:
1. The audio context is properly created with appropriate options
2. All necessary files (js-synthesizer.worklet.js and libfluidsynth-2.3.0.js) are in the correct location

For MIDI/soundfont loading issues:
1. Verify soundfont files can be loaded from database
2. Check MIDI file export from MidiManager
3. Make sure all MIDI events are properly translated to sequencer events

For playback issues:
1. Trace through soundfont player logging
2. Verify soundfont is initialized and connected
3. Ensure track subscriptions for MIDI updates are working

The revised architecture is cleaner, avoids circular dependencies, and aligns logically with the responsibility of each component in the system.