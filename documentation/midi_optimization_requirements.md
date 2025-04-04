# Project Requirements: MIDI Processing Optimization

## Project Overview

This project aims to optimize the MIDI processing workflow in BeatGen by eliminating redundant MIDI file serialization/deserialization operations. Currently, every note modification requires converting between in-memory note objects and MIDI file format, creating significant performance overhead. This optimization will allow direct processing of note data without file conversions during normal operations.

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
1. Create a direct path for note data to flow to the soundfont player without MIDI file conversion
2. Update the sequencer to work directly with Note objects
3. Maintain MIDI file serialization only for project saving/loading
4. Ensure full compatibility with existing features and UI
5. Improve performance during note editing operations

## Technical Requirements

### SequencerWrapper Enhancements

1. Add method to update sequencer directly with Note arrays:
   ```typescript
   updateWithNotes(notes: Note[]): void {
     // Convert notes directly to event instances
     this.noteEvents = this.convertNotesToEvents(notes);
     
     // Apply the tempo
     this.applyTempoToTimeScale();
     
     // If playing, reschedule events
     if (this._isPlaying) {
       this.scheduleEvents(this.currentLocalTick);
     }
   }
   ```

2. Add helper for converting Note arrays to events:
   ```typescript
   private convertNotesToEvents(notes: Note[], channel: number): EventInstance[] {
     const events: EventInstance[] = [];
     
     // Calculate ticks per second based on current BPM and PPQ
     const ticksPerSecond = (this.currentBpm * this.ppq) / 60;
     
     for (const note of notes) {
       // Convert grid position to time (in seconds), then to ticks
       const timeInSeconds = note.column / 4;
       const startTick = Math.round(timeInSeconds * ticksPerSecond);
       
       // Convert grid length to duration (in ms)
       const durationInSeconds = note.length / 4;
       const duration = Math.round(durationInSeconds * 1000);
       
       // Create note event
       events.push({
         tick: startTick,
         event: {
           type: 'note',
           channel,
           key: note.row,
           vel: note.velocity || 100,
           duration
         }
       });
     }
     
     return events;
   }
   ```

### SoundfontEngineController Changes

1. Update track subscription to use Note arrays directly:
   ```typescript
   private registerTrackSubscription(trackId: string, midiManager: MidiManager): void {
     // Remove previous subscription if exists
     if (this.trackSubscriptions.has(trackId)) {
       this.trackSubscriptions.get(trackId)!.unsubscribe();
     }
     
     // Subscribe to track updates
     const unsubscribe = midiManager.subscribeToTrack(trackId, (trackId, notes) => {
       try {
         // Get sequencer and update it directly with notes
         const sequencer = this.midiPlayer.getTrack(trackId);
         if (sequencer) {
           sequencer.updateWithNotes(notes);
           console.log(`Updated sequencer for track ${trackId} with ${notes.length} notes directly`);
         }
       } catch (error) {
         console.error(`Failed to update sequencer for track ${trackId}:`, error);
       }
     });
     
     // Store unsubscribe function
     this.trackSubscriptions.set(trackId, unsubscribe);
   }
   ```

2. Keep MIDI file conversion for initial setup only:
   ```typescript
   async connectTrackToSoundfont(trackId: string, instrumentId: string, midiManager: MidiManager): Promise<void> {
     // Get soundfont data as before
     
     // Get MIDI data from MidiManager - this is needed just for initial setup
     const midiBlob = await midiManager.exportMidiFileFromDB(trackId);
     if (!midiBlob) {
       throw new Error(`No MIDI data found for track ${trackId}`);
     }
     
     // Add track to player with soundfont
     await this.midiPlayer.addTrack(
       trackId,
       await midiBlob.arrayBuffer(),
       soundfontResult.data
     );
     
     // Subscribe to updates - this is where direct note processing happens
     this.registerTrackSubscription(trackId, midiManager);
   }
   ```

3. Update play method for direct note access:
   ```typescript
   async play(): Promise<void> {
     // For each track, ensure it has the latest notes
     const trackIds = this.midiPlayer.getTrackIds();
     
     for (const trackId of trackIds) {
       // Get direct access to notes
       const notes = this.midiManager.getNotesForTrack(trackId);
       const sequencer = this.midiPlayer.getTrack(trackId);
       
       if (sequencer && notes && notes.length > 0) {
         // Update with latest notes directly before playing
         sequencer.updateWithNotes(notes);
       }
     }
     
     // Start playback
     await this.midiPlayer.play();
   }
   ```

## Testing Requirements

1. Unit tests for new SequencerWrapper methods
   - Test `updateWithNotes()` correctly converts notes to events
   - Test `convertNotesToEvents()` properly calculates timing 

2. Integration tests
   - Test note creation flows through to sequencer without file conversion
   - Test note updates are immediately reflected in playback
   - Test MIDI file operations still work for project saving/loading

3. Performance tests
   - Measure time difference between current and optimized approach 
   - Test with large MIDI files (1000+ notes)
   - Test rapid sequence of note modifications

## Acceptance Criteria

1. All existing functionality continues to work without regression
2. No MIDI file serialization/deserialization occurs during normal note editing
3. MIDI data is still correctly persisted to IndexedDB for project saving
4. History system (undo/redo) works correctly with the optimized flow
5. Performance improvement is measurable (>50% reduction in processing time for note edits)
6. No new memory leaks are introduced

## Implementation Strategy

1. Phase 1: Add the direct note processing methods to SequencerWrapper
2. Phase 2: Update SoundfontEngineController to use direct note processing
3. Phase 3: Test full workflow with optimized path
4. Phase 4: Run performance tests and fix any issues

## Timeline

1. Phase 1: 1 day
2. Phase 2: 1 day
3. Phase 3: 1 day
4. Phase 4: 1 day

Total estimated time: 4 days

## Additional Considerations

1. This approach minimizes changes to the existing architecture
2. No new data structures are introduced, reducing risk
3. The optimization is focused on the most performance-critical path
4. Backward compatibility is maintained for all existing components

## Future Extensions

1. Consider extending the direct note processing approach to other areas of the application
2. Add optimization for drum tracks with similar direct access patterns
3. Explore optimizations for audio track playback using similar techniques