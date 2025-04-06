# Store Refactoring Plan

This document outlines the plan for refactoring the Beatgen frontend's state management system by consolidating `useStudioStore.ts` and `store.ts` into a single unified Zustand store.

## Current Architecture

Currently, the application uses a dual-state management approach:

1. **Class-based Store (`store.ts`)**: A traditional class-based store that provides core functionality:
   - Audio engine, transport and project management
   - Track creation and manipulation
   - MIDI and soundfont functionality
   - Event listener pattern for reactivity

2. **Zustand Store (`useStudioStore.ts`)**: A modern Zustand store that:
   - Wraps the class-based store
   - Provides React-friendly hooks and state management
   - Handles UI state like playback indicators, timeline, etc.
   - Often duplicates functionality from the class-based store

This dual approach creates redundancy, complexity, and potential state synchronization issues.

## Refactoring Goals

1. **Consolidate into a single Zustand store** in `useStore.ts` that will:
   - Serve as the single source of truth
   - Provide all functionality of both previous stores
   - Maintain a clean, consistent API

2. **Keep backward compatibility** by:
   - Maintaining the `Store` class as a thin wrapper over the Zustand store
   - Ensuring all existing components continue to work without major changes
   - Preserving all public methods and interfaces

3. **Improve performance and maintainability** by:
   - Eliminating duplicate state
   - Reducing unnecessary re-renders
   - Simplifying the codebase

## Files to Modify

### Primary Files to Refactor

- `/Users/pranavsharan/Developer/beatgen/frontend/src/studio/stores/useStore.ts` - Create/expand as main store
- `/Users/pranavsharan/Developer/beatgen/frontend/src/studio/stores/useStudioStore.ts` - To be deprecated
- `/Users/pranavsharan/Developer/beatgen/frontend/src/studio/core/state/store.ts` - To be replaced with compatibility layer

### Components Using `useStudioStore`

These components will need to be updated to use the new store:

- `/Users/pranavsharan/Developer/beatgen/frontend/src/studio/Studio.tsx`
- `/Users/pranavsharan/Developer/beatgen/frontend/src/studio/components/timeline/PlaybackCursor.tsx`
- `/Users/pranavsharan/Developer/beatgen/frontend/src/studio/components/piano-roll/context/PianoRollContext.tsx`
- `/Users/pranavsharan/Developer/beatgen/frontend/src/studio/components/ai-assistant/ChatWindow.tsx`
- `/Users/pranavsharan/Developer/beatgen/frontend/src/studio/components/piano-roll/components/PianoRollWindow.tsx`
- `/Users/pranavsharan/Developer/beatgen/frontend/src/studio/components/ai-assistant/StreamingChatWindow.tsx`
- `/Users/pranavsharan/Developer/beatgen/frontend/src/studio/components/track/Track.tsx`
- `/Users/pranavsharan/Developer/beatgen/frontend/src/studio/hooks/useHistorySync.ts`

### Files Using `Store` Class

These files use the class-based Store and will need to be updated to work with our compatibility layer:

- `/Users/pranavsharan/Developer/beatgen/frontend/src/studio/core/state/history/actions/BaseAction.ts`
- `/Users/pranavsharan/Developer/beatgen/frontend/src/studio/core/state/history/actions/TrackActions.ts`
- `/Users/pranavsharan/Developer/beatgen/frontend/src/studio/core/state/history/actions/ProjectActions.ts`
- `/Users/pranavsharan/Developer/beatgen/frontend/src/studio/core/state/history/actions/NoteActions.ts`
- `/Users/pranavsharan/Developer/beatgen/frontend/src/studio/core/soundfont/soundfontManager.ts`
- `/Users/pranavsharan/Developer/beatgen/frontend/src/studio/core/midi/MidiManagerNew.ts`
- `/Users/pranavsharan/Developer/beatgen/frontend/src/studio/core/db/dexie-client.ts`

### Files Using Direct Store Actions

Files that use direct state manipulation methods need special attention:
- Several files use `useStudioStore.setState()` in action files
- `/Users/pranavsharan/Developer/beatgen/frontend/src/studio/stores/useStudioStore.ts` for history actions

### Files Using Store Interfaces

- `/Users/pranavsharan/Developer/beatgen/frontend/src/studio/core/types/track.ts` (DrumPad)
- `/Users/pranavsharan/Developer/beatgen/frontend/src/studio/constants/gridConstants.ts` (DrumPad)

## Implementation Plan

### Phase 1: Create the Unified Store

1. Expand the existing `useStore.ts` to include all functionality from both stores
2. Create a compatibility `Store` class that forwards to the Zustand store
3. Implement all necessary methods and state

### Phase 2: Update Component Imports

1. Update all imports from `useStudioStore` to `useStore`
2. For components using `store.xxx` methods directly, adjust to use the new API

### Phase 3: Update History Actions

1. Modify history actions to work with the new store
2. Ensure all direct state mutations (like `setState()`) continue to work

### Phase 4: Testing and Validation

1. Test all core functionality
2. Verify no regressions in UI behavior
3. Check for performance improvements

## Migration Strategy

For each component:

1. Change the import statement from `useStudioStore` to `useStore`
2. Update state selectors and actions to match the new structure
3. Test component functionality

For action files:
1. Keep the same `Store` parameter type
2. The compatibility layer will ensure actions still work with minimal changes

## Compatibility Considerations

- The `Store` class should implement the `StoreInterface` for type safety
- All existing methods from the class-based store should be preserved in the compatibility layer
- The Zustand store should expose the same selectors and actions as `useStudioStore`

## Benefits After Refactoring

- Single source of truth for application state
- Reduced code complexity and better maintainability
- Improved performance by eliminating redundant state updates
- Better TypeScript support through consistent interfaces
- Simpler debugging with predictable state updates