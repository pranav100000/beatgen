# Project Requirements: MIDI Processing Optimization

## Project Overview

This project aims to optimize the MIDI processing workflow in BeatGen by eliminating redundant MIDI file serialization/deserialization operations. Currently, every note modification requires converting between in-memory note objects and MIDI file format, creating significant performance overhead. This optimization will allow direct access to MIDI data without file conversions during normal operation.

## Background

The BeatGen digital audio workstation (DAW) application uses MIDI data for note representation in the piano roll editor and for playback through the soundfont engine. The current architecture requires:

1. Serializing note data to MIDI files when notes are modified
2. Storing these files in IndexedDB
3. Reading and parsing these files when needed for playback
4. Re-serializing for any further modifications

This creates unnecessary overhead, especially during editing sessions where users frequently add, move, or delete notes.

## Goals and Objectives

### Primary Goal
Optimize MIDI data handling to eliminate redundant file conversions while maintaining all existing functionality.

### Specific Objectives
1. Maintain in-memory Tone.js `Midi` objects for all tracks
2. Update these objects directly when notes are modified
3. Provide these objects directly to the soundfont player
4. Preserve MIDI file serialization only for project saving/loading
5. Maintain full compatibility with existing history management
6. Ensure no regression in current functionality

## Technical Requirements

### MidiManager Enhancements

1. Add storage for Tone.js `Midi` objects in the MidiManager:
   ```typescript
   private midiObjects = new Map<string, Midi>();
   ```

2. Modify `updateTrack()` method to update the in-memory MIDI object when notes change:
   ```typescript
   updateTrack(trackId: string, notes: Note[]): void {
     // Update persistence as before
     this.persistNotesToDB(trackId, notes);
     
     // Also update MIDI object directly
     this.updateMidiObject(trackId, notes);
     
     // Dispatch events as before
     this.notifySubscribers(trackId, notes);
   }
   ```

3. Add method to update MIDI objects without file conversion:
   ```typescript
   private updateMidiObject(trackId: string, notes: Note[]): void {
     // Create or get MIDI object
     if (!this.midiObjects.has(trackId)) {
       const midi = new Midi();
       midi.header.setTempo(this.bpm);
       midi.header.timeSignatures = [{ 
         ticks: 0, 
         timeSignature: this.timeSignature
       }];
       this.midiObjects.set(trackId, midi);
     }
     
     const midi = this.midiObjects.get(trackId)!;
     
     // Update MIDI with notes
     midi.tracks = [];
     const track = midi.addTrack();
     
     notes.forEach(note => {
       track.addNote({
         midi: note.row,
         time: note.column / 4,
         duration: note.length / 4,
         velocity: note.velocity / 127
       });
     });
   }
   ```

4. Add accessor method for MIDI objects:
   ```typescript
   getMidiObject(trackId: string): Midi | undefined {
     return this.midiObjects.get(trackId);
   }
   ```

5. Optimize `exportMidiFileFromDB()` to use in-memory objects when available:
   ```typescript
   async exportMidiFileFromDB(trackId: string): Promise<Blob | null> {
     // Use cached object if available
     if (this.midiObjects.has(trackId)) {
       const midi = this.midiObjects.get(trackId)!;
       const buffer = midi.toArray();
       return new Blob([buffer], { type: 'audio/midi' });
     }
     
     // Otherwise use existing DB approach
     // ...existing code...
   }
   ```

6. Update track loading to populate MIDI objects:
   ```typescript
   async loadTrackFromDB(trackId: string): Promise<Note[]> {
     const notes = await this.db.getMidiTrackNotes(trackId);
     
     // Also update the MIDI object
     if (notes && notes.length > 0) {
       this.updateMidiObject(trackId, notes);
     }
     
     return notes;
   }
   ```

### SequencerWrapper Enhancements

1. Add method to update sequencer directly with Midi object:
   ```typescript
   updateWithMidiObject(midi: Midi): void {
     // Extract properties from MIDI
     if (midi.header) {
       this.ppq = midi.header.ppq;
       
       if (midi.header.tempos && midi.header.tempos.length > 0) {
         this.currentBpm = midi.header.tempos[0].bpm;
       }
     }
     
     // Get tracks with notes
     const track = midi.tracks.find(t => t.notes.length > 0) || midi.tracks[0];
     
     if (track) {
       // Convert to our event format
       this.noteEvents = this.convertMidiObjectToEvents(track, this.channel);
       this.applyTempoToTimeScale();
       
       // If playing, reschedule events
       if (this._isPlaying) {
         this.scheduleEvents(this.currentLocalTick);
       }
     }
   }
   ```

2. Add helper for converting Tone.js MIDI objects to events:
   ```typescript
   private convertMidiObjectToEvents(track: Track, channel: number): EventInstance[] {
     const events: EventInstance[] = [];
     const ticksPerSecond = (this.currentBpm * this.ppq) / 60;
     
     for (const note of track.notes) {
       const startTick = Math.round(note.time * ticksPerSecond);
       const duration = Math.round(note.duration * 1000); // ms
       
       events.push({
         tick: startTick,
         event: {
           type: 'note',
           channel: channel,
           key: note.midi,
           vel: Math.round(note.velocity * 127),
           duration: duration
         }
       });
     }
     
     return events;
   }
   ```

### SoundfontEngineController Changes

1. Modify `connectTrackToSoundfont()` to use MidiManager:
   ```typescript
   async connectTrackToSoundfont(trackId: string, instrumentId: string): Promise<void> {
     // Get soundfont data as before
     
     // Get MIDI data from MidiManager instead of file
     const midiObject = this.midiManager.getMidiObject(trackId);
     let midiArrayBuffer: ArrayBuffer;
     
     if (midiObject) {
       // Use in-memory object
       midiArrayBuffer = midiObject.toArray();
     } else {
       // Fall back to file export if needed
       const midiBlob = await this.midiManager.exportMidiFileFromDB(trackId);
       if (!midiBlob) {
         throw new Error(`No MIDI data found for track ${trackId}`);
       }
       midiArrayBuffer = await midiBlob.arrayBuffer();
     }
     
     // Add track to player with soundfont
     await this.midiPlayer.addTrack(
       trackId,
       midiArrayBuffer,
       soundfontResult.data
     );
     
     // Subscribe to updates
     this.registerTrackSubscription(trackId);
   }
   ```

2. Update track subscription to use MIDI objects:
   ```typescript
   private registerTrackSubscription(trackId: string): void {
     // Remove previous subscription if exists
     
     // Subscribe to track updates
     const unsubscribe = this.midiManager.subscribeToTrack(trackId, async () => {
       try {
         // Get updated MIDI object directly
         const midiObject = this.midiManager.getMidiObject(trackId);
         if (!midiObject) return;
         
         // Get sequencer and update it directly
         const sequencer = this.midiPlayer.getTrack(trackId);
         if (sequencer) {
           sequencer.updateWithMidiObject(midiObject);
         }
       } catch (error) {
         console.error(`Failed to update MIDI playback:`, error);
       }
     });
     
     // Store unsubscribe function
     this.trackSubscriptions.set(trackId, unsubscribe);
   }
   ```

3. Update play method to refresh all tracks before playback:
   ```typescript
   async play(): Promise<void> {
     console.log('Starting playback');
     
     // For each track, update with latest MIDI data before playing
     const trackIds = this.midiPlayer.getTrackIds();
     
     for (const trackId of trackIds) {
       const sequencer = this.midiPlayer.getTrack(trackId);
       const midiObject = this.midiManager.getMidiObject(trackId);
       
       if (sequencer && midiObject) {
         sequencer.updateWithMidiObject(midiObject);
       }
     }
     
     // Start playback
     await this.midiPlayer.play();
   }
   ```

## Testing Requirements

1. Unit tests for new MidiManager methods
   - Test `updateMidiObject()` correctly converts notes to MIDI
   - Test `getMidiObject()` returns expected object
   - Test modifications to `updateTrack()` still notify subscribers

2. Integration tests for the optimized workflow
   - Test note creation updates MIDI object correctly
   - Test MIDI object is used when exporting
   - Test SequencerWrapper handles MIDI objects correctly

3. Performance tests
   - Measure time difference between current and optimized approach 
   - Test with large MIDI files (1000+ notes)
   - Test rapid sequence of note modifications

## Acceptance Criteria

1. All existing functionality continues to work without regression
2. No MIDI file serialization/deserialization occurs during normal note editing
3. MIDI data is still correctly persisted to IndexedDB for project saving
4. History system (undo/redo) works correctly with in-memory MIDI objects
5. Performance improvement is measurable (>50% reduction in processing time for note edits)
6. No new memory leaks are introduced

## Implementation Strategy

1. Phase 1: Add MIDI object storage to MidiManager without changing existing code paths
2. Phase 2: Modify SequencerWrapper to accept MIDI objects directly
3. Phase 3: Update SoundfontEngineController to use MIDI objects when available
4. Phase 4: Optimize all note editing operations to use the new direct path
5. Phase 5: Run performance tests and fix any issues
6. Phase 6: Clean up any remaining file-based operations that can be optimized

## Timeline

1. Phase 1: 1 day
2. Phase 2: 1 day
3. Phase 3: 1 day
4. Phase 4: 2 days
5. Phase 5: 1 day
6. Phase 6: 1 day

Total estimated time: 7 days

## Additional Considerations

1. Memory usage should be monitored as we'll be keeping more data in memory
2. Edge cases like MIDI import/export need special attention
3. Backward compatibility should be maintained for all existing components
4. Complete documentation of the optimization should be provided

## Future Extensions

1. Consider adding a periodic persistence mechanism to save MIDI data during editing
2. Add optimization for drum tracks with similar direct access patterns
3. Explore optimizations for audio track playback using similar techniques