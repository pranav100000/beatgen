# MidiManager Refactoring Plan

## Core Responsibilities
1. **Source of Truth for Notes**: Store and manage note data for all tracks
2. **Subscriber Management**: Notify components when notes change
3. **MIDI Conversion**: Convert between app note format and MIDI formats
4. **Persistence**: Store/load notes to/from the database

## Essential Methods (Organized by Function)

### Track & Note Management
- `hasTrack(trackId)`: Check if track exists
- `getTrackNotes(trackId)`: Get notes (null if track doesn't exist)
- `createTrack(instrumentId, name)`: Create a track with empty notes
- `updateTrack(trackId, notes)`: Update notes for track (strict)
- `addNoteToTrack(trackId, note)`: Add a single note
- `removeNoteFromTrack(trackId, noteId)`: Remove a note
- `updateNote(trackId, updatedNote)`: Update a specific note
- `deleteTrackWithPersistence(trackId)`: Delete track and persistence

### Notifications
- `subscribeToTrack(trackId, callback)`: Subscribe to specific track changes
- `subscribeToAllUpdates(callback)`: Subscribe to all track changes
- `notifyTrackSubscribers(trackId, notes)`: Trigger notifications

### MIDI Conversion
- `loadMidiFile(id, file)`: Parse MIDI file into app format
- `createMidiFile(data)`: Create MIDI blob from notes
- `exportMidiFileFromDB(trackId)`: Get MIDI from DB

### Persistence
- `createTrackWithPersistence(instrumentId, name)`: Create with DB storage
- `loadTrackFromDB(trackId)`: Load notes from DB
- `debouncePersistence(trackId, notes)`: Queue persistence

## Redundancies and Issues

1. **Redundant Track Creation Methods**:
   - `createTrack()` already creates an empty notes array AND returns a track object 
   - `createTrackNotes()` does essentially the same thing but returns notes

2. **Redundant Note Access Methods**:
   - `getNotesForTrack()`: Returns empty array if track not found
   - `getTrackNotes()`: Returns null if track not found
   - These do almost the same thing with different error handling

3. **Double Notification** in `addNoteToTrack()`:
   ```javascript
   // Updates with new note
   this.updateTrack(trackId, updatedNotes);  // This notifies subscribers
   
   // Then notifies again
   this.notifyTrackSubscribers(trackId, updatedNotes);
   ```

4. **Unused/Legacy Code**:
   - `activePlayback` Map never seems to be used
   - Some methods might be legacy or unused

## Implementation Steps

1. ✅ Add improved note retrieval method `getTrackNotes()`
2. ✅ Enhance notification system to include global listeners
3. ✅ Update `updateTrack()` for strict validation and defensive copying
4. ✅ Fix double notification in note operations

## Next Steps

5. Fix `createTrackWithPersistence()` to ensure notifications happen
6. Update PianoRollContext to use MidiManager as source of truth
7. Update SoundfontEngineController subscription handling
8. Fix AI Generation code to properly use MidiManager

## Long-Term Simplification

- Consider removing `getNotesForTrack()` in favor of `getTrackNotes()`
- Evaluate if `activePlayback` map is needed
- Standardize error handling across all methods
- Improve debug logging for easier troubleshooting