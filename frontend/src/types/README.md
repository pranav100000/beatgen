# BeatGen Unified Type System

This directory contains the unified type system for the BeatGen application. The goal is to provide a single source of truth for all types used throughout the application.

## Core Design Principles

1. **Unified Types**: One definition for each core concept (Track, Project, etc.)
2. **Separation of Concerns**: 
   - Core types for data models (persistence)
   - State types for runtime/UI information
   - Clear adapters between API and internal types
3. **Type Safety**: Using discriminated unions and type guards
4. **Single Import Path**: Import all types from '../types' for simplicity

## Key Type Hierarchies

### Track Hierarchy

```
Track (core model)
  ├── AudioTrack
  ├── MidiTrack
  ├── DrumTrack
  └── SamplerTrack

TrackState (runtime model)
  ├── AudioTrack
  ├── MidiTrack
  ├── DrumTrack
  └── SamplerTrack
```

### Project Hierarchy

```
Project (core model)
  └── ProjectState (runtime model)
```

## Usage Examples

### Creating and Working with Tracks

```typescript
import { Track, isAudioTrack, isMidiTrack } from '../types';

// Creating a track
const track: Track = {
  id: '123',
  name: 'My Track',
  type: 'audio',
  volume: 80,
  pan: 0,
  muted: false,
  soloed: false
};

// Type guards for safe access to type-specific properties
if (isAudioTrack(track)) {
  // AudioTrack specific properties are now type-safe
  console.log(track.audioFile);
} else if (isMidiTrack(track)) {
  // MidiTrack specific properties are now type-safe
  console.log(track.instrumentId);
}
```

### Converting Between API and Internal Types

```typescript
import { apiProjectToProject, projectToApiProjectUpdate } from '../types';

// When loading from API
const apiProject = await api.getProject(id);
const project = apiProjectToProject(apiProject);

// When saving to API
const apiUpdateData = projectToApiProjectUpdate(project);
await api.updateProject(id, apiUpdateData);
```

## Migrating to the New Type System

When migrating existing code to use the unified type system:

1. Replace imports from `studio/core/types/track` with imports from `types`
2. Replace `TrackState` with `Track` or `TrackState` from the unified system
3. Use type guards instead of manual type checking
4. Use the adapter functions for API interactions