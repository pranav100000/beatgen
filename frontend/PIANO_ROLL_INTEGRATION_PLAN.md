# Piano Roll Integration Plan

This document outlines the streamlined plan for replacing the existing piano roll implementation with the new self-contained PianoRoll2 component, eliminating the need for PianoRollContext.

## Overview

The current piano roll implementation uses multiple components and a React Context (PianoRollContext) as an intermediary layer. Since the new PianoRoll2 component is a complete window/modal component, we can significantly simplify our architecture by:

1. Using a minimal Zustand store to track open piano rolls
2. Connecting directly to MidiManager for data access
3. Creating note action utilities for history integration
4. Rendering PianoRoll2 components directly

## Implementation Plan

### Phase 1: Core Utilities (1 day)

#### 1. Create Piano Roll Store

```typescript
// src/studio/stores/usePianoRollStore.ts
import { create } from 'zustand';

interface PianoRollStore {
  openPianoRolls: Record<string, boolean>;
  openPianoRoll: (trackId: string) => void;
  closePianoRoll: (trackId: string) => void;
}

export const usePianoRollStore = create<PianoRollStore>((set) => ({
  openPianoRolls: {},
  openPianoRoll: (trackId) => set((state) => ({
    openPianoRolls: { ...state.openPianoRolls, [trackId]: true }
  })),
  closePianoRoll: (trackId) => set((state) => ({
    openPianoRolls: { ...state.openPianoRolls, [trackId]: false }
  }))
}));
```

#### 2. Create Note Format Conversion Utilities

```typescript
// src/studio/utils/noteConversion.ts
import { Note } from '../core/types/note';
import { NoteState } from '../components/piano-roll2/PianoRoll';

export const TICKS_PER_BEAT = 960; // Standard MIDI ticks per beat
export const TICKS_PER_STEP = TICKS_PER_BEAT / 4; // 240 ticks per step

export const convertToNoteState = (note: Note): NoteState => ({
  id: note.id,
  row: note.row,
  column: note.column * TICKS_PER_STEP,
  length: note.length * TICKS_PER_STEP,
});

export const convertFromNoteState = (note: NoteState, trackId: string): Note => ({
  id: note.id,
  row: note.row,
  column: Math.round(note.column / TICKS_PER_STEP),
  length: Math.round(note.length / TICKS_PER_STEP),
  trackId,
  velocity: note.velocity ?? 0.8,
});
```

#### 3. Create Note Diffing Utility

```typescript
// src/studio/utils/noteDiffing.ts
import { NoteState } from '../components/piano-roll2/PianoRoll';

export type NoteDiff = {
  type: 'add' | 'delete' | 'move' | 'resize';
  id: number;
  note: NoteState;
  oldNote?: NoteState;
};

export const diffNotes = (oldNotes: NoteState[], newNotes: NoteState[]): NoteDiff[] => {
  const diffs: NoteDiff[] = [];
  const oldMap = new Map(oldNotes.map(note => [note.id, note]));
  const newMap = new Map(newNotes.map(note => [note.id, note]));
  
  // Check for added notes
  for (const [id, note] of newMap.entries()) {
    if (!oldMap.has(id)) {
      diffs.push({ type: 'add', id, note });
    }
  }
  
  // Check for deleted notes
  for (const [id, oldNote] of oldMap.entries()) {
    if (!newMap.has(id)) {
      diffs.push({ type: 'delete', id, note: oldNote });
    }
  }
  
  // Check for modified notes
  for (const [id, newNote] of newMap.entries()) {
    const oldNote = oldMap.get(id);
    if (oldNote) {
      if (oldNote.row !== newNote.row || oldNote.column !== newNote.column) {
        diffs.push({ type: 'move', id, note: newNote, oldNote });
      } else if (oldNote.length !== newNote.length) {
        diffs.push({ type: 'resize', id, note: newNote, oldNote });
      }
    }
  }
  
  return diffs;
};
```

#### 4. Create Note Action Utilities

```typescript
// src/studio/utils/noteActions.ts
import { historyManager } from '../core/state/history/HistoryManager';
import { Actions } from '../core/state/history/actions';
import { Store } from '../core/state/store';
import { NoteState } from '../components/piano-roll2/PianoRoll';
import { convertFromNoteState } from './noteConversion';

// Create a note with history tracking
export const createNoteWithHistory = (
  store: Store, 
  trackId: string, 
  note: NoteState
): Promise<void> => {
  const convertedNote = convertFromNoteState(note, trackId);
  const action = new Actions.AddNote(
    store,
    trackId,
    note.id.toString(),
    convertedNote
  );
  
  return historyManager.executeAction(action);
};

// Delete a note with history tracking
export const deleteNoteWithHistory = (
  store: Store,
  trackId: string,
  noteId: number,
  originalNote: NoteState
): Promise<void> => {
  const convertedNote = convertFromNoteState(originalNote, trackId);
  const action = new Actions.DeleteNote(
    store,
    trackId,
    noteId.toString(),
    convertedNote
  );
  
  return historyManager.executeAction(action);
};

// Move a note with history tracking
export const moveNoteWithHistory = (
  store: Store,
  trackId: string,
  noteId: number,
  oldNote: NoteState,
  newNote: NoteState
): Promise<void> => {
  const convertedOldNote = convertFromNoteState(oldNote, trackId);
  
  const oldPosition = { 
    x: Math.round(oldNote.column / TICKS_PER_STEP), 
    y: oldNote.row 
  };
  
  const newPosition = { 
    x: Math.round(newNote.column / TICKS_PER_STEP), 
    y: newNote.row 
  };
  
  const action = new Actions.MoveNote(
    store,
    trackId,
    noteId.toString(),
    oldPosition,
    newPosition,
    convertedOldNote
  );
  
  return historyManager.executeAction(action);
};

// Resize a note with history tracking
export const resizeNoteWithHistory = (
  store: Store,
  trackId: string,
  noteId: number,
  oldNote: NoteState,
  newNote: NoteState
): Promise<void> => {
  const convertedOldNote = convertFromNoteState(oldNote, trackId);
  
  const oldLength = Math.round(oldNote.length / TICKS_PER_STEP);
  const newLength = Math.round(newNote.length / TICKS_PER_STEP);
  
  const action = new Actions.ResizeNote(
    store,
    trackId,
    noteId.toString(),
    oldLength,
    newLength,
    convertedOldNote
  );
  
  return historyManager.executeAction(action);
};
```

### Phase 2: Create PianoRollWindows Component (1 day)

```typescript
// src/studio/components/piano-roll-new/PianoRollWindows.tsx
import React, { useState, useCallback } from 'react';
import { usePianoRollStore } from '../../stores/usePianoRollStore';
import { useStudioStore } from '../../stores/useStudioStore';
import PianoRoll from '../piano-roll2/PianoRoll';
import { NoteState } from '../piano-roll2/PianoRoll';
import { convertToNoteState } from '../../utils/noteConversion';
import { diffNotes } from '../../utils/noteDiffing';
import {
  createNoteWithHistory,
  deleteNoteWithHistory,
  moveNoteWithHistory,
  resizeNoteWithHistory
} from '../../utils/noteActions';

const PianoRollWindows: React.FC = () => {
  const { openPianoRolls, closePianoRoll } = usePianoRollStore();
  const { store, tracks } = useStudioStore();
  
  // Track previous notes per track for diffing
  const [prevNotesByTrack, setPrevNotesByTrack] = useState<Record<string, NoteState[]>>({});
  
  // Get track IDs with open piano rolls
  const openTrackIds = Object.entries(openPianoRolls)
    .filter(([_, isOpen]) => isOpen)
    .map(([trackId]) => trackId);
  
  // Handle note changes with history integration
  const handleNotesChange = useCallback(async (trackId: string, newNotes: NoteState[]) => {
    if (!store) return;
    
    const prevNotes = prevNotesByTrack[trackId] || [];
    const changes = diffNotes(prevNotes, newNotes);
    
    // Apply changes through history actions
    for (const change of changes) {
      try {
        switch (change.type) {
          case 'add':
            await createNoteWithHistory(store, trackId, change.note);
            break;
          case 'delete':
            await deleteNoteWithHistory(store, trackId, change.id, change.note);
            break;
          case 'move':
            if (change.oldNote) {
              await moveNoteWithHistory(store, trackId, change.id, change.oldNote, change.note);
            }
            break;
          case 'resize':
            if (change.oldNote) {
              await resizeNoteWithHistory(store, trackId, change.id, change.oldNote, change.note);
            }
            break;
        }
      } catch (error) {
        console.error(`Error processing ${change.type} operation:`, error);
      }
    }
    
    // Update previous notes for this track
    setPrevNotesByTrack(prev => ({
      ...prev,
      [trackId]: newNotes
    }));
  }, [store, prevNotesByTrack]);
  
  // Handle note preview playback
  const handleNotePreview = useCallback((trackId: string, midiNote: number, isOn: boolean) => {
    if (!store) return;
    
    const track = tracks.find(t => t.id === trackId);
    const instrumentManager = store.getInstrumentManager();
    if (!instrumentManager) return;
    
    const instrumentId = track?.instrumentId || 'default';
    
    if (isOn) {
      instrumentManager.playNote(instrumentId, midiNote);
    } else {
      instrumentManager.stopNote(instrumentId, midiNote);
    }
  }, [store, tracks]);
  
  if (openTrackIds.length === 0) {
    return null;
  }
  
  return (
    <>
      {openTrackIds.map(trackId => {
        const track = tracks.find(t => t.id === trackId);
        const midiManager = store?.getMidiManager();
        const notes = midiManager?.getTrackNotes(trackId) || [];
        const pianoRollNotes = notes.map(convertToNoteState);
        
        // Keep track of current notes for diffing on next change
        if (!prevNotesByTrack[trackId]) {
          setPrevNotesByTrack(prev => ({
            ...prev,
            [trackId]: pianoRollNotes
          }));
        }
        
        return (
          <PianoRoll
            key={`piano-roll-${trackId}`}
            title={`Piano Roll - ${track?.name || 'Unknown Track'}`}
            initialNotes={pianoRollNotes}
            onNotesChange={(newNotes) => handleNotesChange(trackId, newNotes)}
            onClose={() => closePianoRoll(trackId)}
            onPreviewNote={(midiNote, isOn) => handleNotePreview(trackId, midiNote, isOn)}
            // Add any additional required props (scale, initial dimensions, etc.)
          />
        );
      })}
    </>
  );
};

export default PianoRollWindows;
```

### Phase 3: Update Track Components (Half day)

#### 1. Update Track Component

```typescript
// src/studio/components/track/Track.tsx
import React from 'react';
import { Box } from '@mui/material';
import { usePianoRollStore } from '../../stores/usePianoRollStore';
// Other imports...

function Track(props: TrackProps) {
  // Existing code...
  const { openPianoRoll } = usePianoRollStore();
  
  // Handle track click to open piano roll
  const handleTrackClick = (e: React.MouseEvent) => {
    if (type === 'midi' || type === 'drum' || type === 'sampler') {
      e.stopPropagation();
      openPianoRoll(id);
    }
  };
  
  // Rest of the component...
}
```

#### 2. Update Track Preview Components

```typescript
// src/studio/components/track/midi/MidiTrackPreview.tsx
import React, { useMemo } from 'react';
import { useStudioStore } from '../../../stores/useStudioStore';
// Other imports...

export const MidiTrackPreview: React.FC<TrackPreviewProps> = (props) => {
  // Existing code...
  const { store } = useStudioStore();
  
  // Get notes directly from MidiManager
  const midiManager = store?.getMidiManager();
  const trackNotes = midiManager?.getTrackNotes(track.id) || [];
  
  // Rest of the component...
};
```

Do the same for `DrumTrackPreview.tsx`.

### Phase 4: Update Studio Component (Half day)

```typescript
// src/studio/Studio.tsx
import React from 'react';
// Existing imports...
import PianoRollWindows from './components/piano-roll-new/PianoRollWindows';

function Studio({ projectId }: StudioProps) {
  // Existing code...
  
  return (
    <Box sx={{ 
      height: '100vh', 
      bgcolor: '#000000', 
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Existing components */}
      
      {/* Piano Roll Windows */}
      <PianoRollWindows />
    </Box>
  );
}

// Export without the PianoRollModule wrapper
export default Studio;
```

### Phase 5: Testing & Migration (1 day)

1. **Test with Feature Flag**

Add a temporary feature flag to toggle between implementations:

```typescript
// src/studio/stores/useStudioStore.ts
// Add to the store
useNewPianoRoll: boolean;
togglePianoRollImplementation: () => void;

// In the store initialization
useNewPianoRoll: true, // Default to new implementation
togglePianoRollImplementation: () => set(state => ({ 
  useNewPianoRoll: !state.useNewPianoRoll 
})),
```

Modify Studio.tsx to support both implementations during testing:

```typescript
// Inside Studio.tsx
if (useNewPianoRoll) {
  return (
    <Box>
      {/* Components */}
      <PianoRollWindows />
    </Box>
  );
} else {
  return (
    <PianoRollModule>
      <Box>
        {/* Components */}
      </Box>
      <OldPianoRollWindows />
    </PianoRollModule>
  );
}
```

2. **Test Key Functionality**
   - Opening and closing piano rolls
   - Creating, moving, resizing, and deleting notes
   - Undo/redo operations
   - Track preview visualization
   - Note preview playback

### Phase 6: Clean Up (Half day)

Once the new implementation is stable:

1. Remove PianoRollContext and old components
2. Remove feature flag
3. Update imports throughout the codebase
4. Clean up any temporary code

## Timeline

| Phase | Task | Duration | Dependencies |
|-------|------|----------|-------------|
| 1 | Core Utilities | 1 day | None |
| 2 | PianoRollWindows Component | 1 day | Phase 1 |
| 3 | Update Track Components | 0.5 day | Phase 1 |
| 4 | Update Studio Component | 0.5 day | Phase 2, 3 |
| 5 | Testing & Migration | 1 day | Phase 1-4 |
| 6 | Clean Up | 0.5 day | Phase 5 |
| **Total** | | **4.5 days** | |

## Benefits

This streamlined approach offers several advantages:

1. **Direct Integration**: No wrapper components needed
2. **Cleaner Architecture**: Direct connection between components and data
3. **Better Performance**: Fewer layers of state management
4. **Simplified Maintenance**: Less code to maintain
5. **Clear Data Flow**: More predictable data flow pattern

## Risks and Mitigations

1. **Note Format Compatibility**
   - Risk: Differences in note format cause issues
   - Mitigation: Thorough testing of conversion utilities

2. **History Integration**
   - Risk: Issues with undo/redo operations
   - Mitigation: Test all operations with history tracking

3. **Performance**
   - Risk: Performance degradation with many open piano rolls
   - Mitigation: Test with multiple open piano rolls and large note sets

4. **Regression**
   - Risk: Missing functionality from old implementation
   - Mitigation: Feature parity checklist before final deployment