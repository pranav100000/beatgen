# Next Implementation Steps

## 1. Update PianoRollContext to use MidiManager as the source of truth

Modify PianoRollContext to:
- Remove internal notes state
- Subscribe to MidiManager updates 
- Redirect all note operations through MidiManager

```typescript
// Inside PianoRollContext.tsx
useEffect(() => {
  if (!store) return;
  
  const midiManager = store.getMidiManager();
  if (!midiManager) return;
  
  // Subscribe to ALL track updates
  const unsubscribe = midiManager.subscribeToAllUpdates((trackId, notes) => {
    // Trigger re-render when notes change
    // This replaces the notesByTrack state management
  });
  
  return () => unsubscribe();
}, [store]);

// Update note operations like this
const createNote = async (trackId: string, note: Note) => {
  if (!store) return;
  
  const midiManager = store.getMidiManager();
  if (!midiManager) return;
  
  // Create history action
  const action = new NoteCreateAction(
    store,
    async () => {
      await midiManager.addNoteToTrack(trackId, note);
    },
    trackId,
    note
  );
  
  // Execute the action
  await historyManager.executeAction(action);
};
```

## 2. Update SoundfontEngineController subscription handling

Modify SoundfontEngineController to:
- Ensure it creates tracks when they don't exist
- Properly validate note updates
- Add better error handling

```typescript
// In SoundfontEngineController.ts
registerTrackSubscription(trackId: string, midiManager: MidiManager): void {
  console.log(`Subscribing to updates for track ${trackId}`);
  
  // Unsubscribe from previous subscription
  if (this.trackSubscriptions.has(trackId)) {
    console.log(`Removing previous subscription for track ${trackId}`);
    const unsubscribe = this.trackSubscriptions.get(trackId);
    if (unsubscribe) unsubscribe();
    this.trackSubscriptions.delete(trackId);
  }
  
  // Subscribe to track updates with robust error handling
  const unsubscribe = midiManager.subscribeToTrack(trackId, async (trackId, notes) => {
    try {
      // Detailed logging
      console.log(`Notes updated for track ${trackId}, has ${notes.length} notes`);
      
      const existingTrack = this.midiPlayer.getTrack(trackId);
      if (existingTrack) {
        // Update existing track
        existingTrack.updateWithNotes(notes);
      } else {
        // Handle missing track case
        console.warn(`Track ${trackId} doesn't exist in player, needs initialization`);
        // ... initialization code ...
      }
    } catch (error) {
      console.error(`Failed to update playback for track ${trackId}:`, error);
    }
  });
  
  this.trackSubscriptions.set(trackId, unsubscribe);
}
```

## 3. Fix ChatWindow.tsx for AI-Generated Tracks

Update ChatWindow.tsx to:
- Properly use MidiManager for note handling
- Ensure note format conversion is accurate
- Add better error handling

```typescript
// In ChatWindow.tsx, inside the AI track handling:
if (newTrack && track.notes.length > 0) {
  // Get MidiManager directly
  const midiManager = store.getMidiManager();
  if (midiManager) {
    // Convert notes to the app format
    const notes = track.notes.map(note => ({
      id: Date.now() + Math.floor(Math.random() * 1000), // Unique ID
      row: note.pitch,                // MIDI note number
      column: note.time * 4,          // Convert beats to grid units
      length: note.duration * 4,      // Convert beats to grid units
      velocity: note.velocity || 100  // Default velocity if not specified
    }));
    
    // Update through MidiManager, which will notify all subscribers
    // including the SoundfontEngineController
    try {
      midiManager.updateTrack(newTrack.id, notes);
      console.log(`Added ${notes.length} notes to track ${newTrack.id}`);
    } catch (error) {
      console.error(`Error adding notes to track ${newTrack.id}:`, error);
    }
  }
}
```

## 4. Integration Plan

1. First, create the new MidiManager class ✅
2. Update the PianoRollContext to use it
3. Update SoundfontEngineController to handle notes properly
4. Fix ChatWindow.tsx for AI generation
5. Update store.ts to use the new MidiManager
6. Test each component in isolation
7. Test the full integration workflow