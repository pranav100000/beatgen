# Sampler Track Type Implementation Requirements

## 1. Project Overview

### 1.1 Purpose
Implement a sampler track type that allows users to load audio samples and play them at different pitches using MIDI notes, enabling sample-based music production within the BeatGen DAW.

### 1.2 Background
BeatGen currently supports audio tracks (for recorded audio), MIDI tracks (for virtual instruments), and drum tracks (for percussion). The sampler track will extend functionality by allowing users to create pitched instruments from any audio sample.

### 1.3 Scope
This project focuses on implementing a complete sampler track system including the backend processing, frontend UI, and integration with existing track systems.

## 2. Functional Requirements

### 2.1 Sampler Track Core Features

#### 2.1.1 Sample Loading
- **FR-101:** Users must be able to load a single audio sample from their local filesystem
- **FR-102:** Support common audio formats: WAV, MP3, AIFF, FLAC, OGG
- **FR-103:** Provide feedback during sample loading process
- **FR-104:** Allow replacing the current sample with a new one
- **FR-105:** Store the sample file with the project for persistence

#### 2.1.2 Sample Playback
- **FR-201:** Play the sample at the original pitch when triggered
- **FR-202:** Shift the sample's pitch according to MIDI note input
- **FR-203:** Control sample playback using a piano roll interface
- **FR-204:** Respect note duration from the piano roll
- **FR-205:** Support velocity sensitivity for dynamic control
- **FR-206:** Allow sample playback without transport running (preview mode)
- **FR-207:** Schedule sample playback according to the transport's current position
- **FR-208:** Support multi-note playback (polyphony) with independent pitch shifting

#### 2.1.3 Sample Manipulation
- **FR-301:** Allow setting a root note (the pitch at which the sample plays unaltered)
- **FR-302:** Provide control over granular synthesis parameters:
  - Grain size (0.01-1.0 seconds)
  - Overlap amount (0.01-1.0)
- **FR-303:** Support adjustable playback range (minimum/maximum MIDI notes)

#### 2.1.4 Mixing Controls
- **FR-401:** Volume control (0-100)
- **FR-402:** Pan control (-100 to 100)
- **FR-403:** Mute and solo functionality
- **FR-404:** Visual volume meter display

### 2.2 Piano Roll Integration

- **FR-501:** Display and edit notes on the piano roll like MIDI tracks
- **FR-502:** Allow drawing, deleting, and editing notes
- **FR-503:** Visualize note velocity through color or size
- **FR-504:** Preview notes when selecting them in the piano roll
- **FR-505:** Support all standard piano roll operations (copy, paste, resize, etc.)

### 2.3 Timeline Integration

- **FR-601:** Display sampler tracks in the timeline view
- **FR-602:** Support drag operations for track positioning
- **FR-603:** Visual indication of track type (sampler icon)
- **FR-604:** Customizable track color

### 2.4 Project Management

- **FR-701:** Save sampler tracks with projects
- **FR-702:** Load sampler tracks from saved projects
- **FR-703:** Include sample file data in project exports
- **FR-704:** Support track duplication
- **FR-705:** Support track deletion with proper resource cleanup

## 3. Technical Requirements

### 3.1 Architecture

#### 3.1.1 Class Structure
- **TR-101:** Create a `SamplerController` class to manage sampler instances
- **TR-102:** Integrate with existing `Store` and `TransportController` classes
- **TR-103:** Create a `SamplerTrackState` interface extending `BaseTrackState`
- **TR-104:** Use the existing `MidiSampler` class for audio processing
- **TR-105:** Implement all required interfaces for track state management

#### 3.1.2 Data Flow
- **TR-201:** Feed MIDI note data from MidiManager to SamplerController
- **TR-202:** Route audio output through the AudioEngine mixer channels
- **TR-203:** Synchronize with Transport's timing system for playback
- **TR-204:** Register with history system for undo/redo operations

### 3.2 Sample Processing

- **TR-301:** Use Tone.js GrainPlayer for granular sample playback
- **TR-302:** Implement sample rate conversion if needed
- **TR-303:** Buffer audio data efficiently to prevent dropout
- **TR-304:** Implement clean resource disposal when tracks are removed
- **TR-305:** Handle errors gracefully during sample loading and playback
- **TR-306:** Use object URLs for sample loading to avoid memory issues

### 3.3 Performance Requirements

- **TR-401:** Support up to 16 concurrent sampler tracks
- **TR-402:** Handle samples up to 10 minutes in length
- **TR-403:** Support polyphony of at least 32 voices per track
- **TR-404:** Ensure sample loading does not block the UI thread
- **TR-405:** Memory usage should not exceed 100MB per loaded sample
- **TR-406:** Total system latency should not exceed 30ms

### 3.4 Integration Requirements

- **TR-501:** Update track type definitions to include 'sampler' type
- **TR-502:** Modify Store.createTrack to handle sampler tracks
- **TR-503:** Update the AddTrackMenu component to include sampler option
- **TR-504:** Integrate with piano roll for note editing
- **TR-505:** Connect with transport system for synchronized playback
- **TR-506:** Update project serialization to include sampler data
- **TR-507:** Add appropriate event listeners for MIDI data updates
- **TR-508:** Ensure compatibility with existing track controls (volume, pan, etc.)

## 4. User Interface Requirements

### 4.1 Track Creation

- **UI-101:** Add "Sampler" option to the track creation menu
- **UI-102:** Show file picker dialog when sampler track is created
- **UI-103:** Display clear loading indicators during sample import
- **UI-104:** Provide appropriate error messages if sample loading fails

### 4.2 Sampler Controls

- **UI-201:** Create a dedicated sampler track control panel including:
  - Sample name display
  - Sample replace button
  - Root note selector (MIDI note or musical notation)
  - Grain size control with numerical display
  - Overlap control with numerical display
  - Min/max note range controls
  - Playback mode selector (one-shot, loop)
- **UI-202:** Create visual sample waveform display
- **UI-203:** Indicate root note position on piano roll
- **UI-204:** Provide sample preview button

### 4.3 Visual Design

- **UI-301:** Use consistent design language with existing track types
- **UI-302:** Unique icon for sampler tracks (distinguish from audio tracks)
- **UI-303:** Visual indication of sample loading state
- **UI-304:** Responsive design for all controls
- **UI-305:** Consistent color scheme with existing interface

## 5. Implementation Tasks

### 5.1 Backend Implementation

#### 5.1.1 Track Type Definition
- Update `/frontend/src/studio/core/types/track.ts`:
  - Add 'sampler' to track type enum
  - Create SamplerTrackState interface
  - Update TrackState type

#### 5.1.2 SamplerController
- Create `/frontend/src/studio/core/audio-engine/samplerController.ts`:
  - Implement track registration methods
  - Implement sample loading methods
  - Implement note playback methods
  - Implement transport synchronization
  - Implement parameter change methods

#### 5.1.3 Store Integration
- Update `/frontend/src/studio/core/state/store.ts`:
  - Add SamplerController instance
  - Modify createTrack method to handle sampler type
  - Add loadSampleFile method
  - Add getSamplerController method

#### 5.1.4 Transport Integration
- Update `/frontend/src/studio/core/state/transport.ts`:
  - Add sampler track playback scheduling
  - Handle position changes for sampler tracks
  - Update seek behavior for sampler tracks

### 5.2 Frontend Implementation

#### 5.2.1 Track Creation UI
- Update `/frontend/src/studio/components/sidebar/AddTrackMenu.tsx`:
  - Add Sampler option
  - Handle file upload for sampler tracks

#### 5.2.2 Track Controls
- Create dedicated sampler controls component
- Implement UI for all sampler parameters
- Connect UI controls to sampler parameters

#### 5.2.3 Piano Roll Integration
- Ensure compatibility with existing piano roll for note editing
- Add root note indicator to piano roll
- Implement note preview for sampler tracks

### 5.3 Project Persistence

- Update project serialization to include sampler data
- Implement sample file storage in project data
- Enable loading sampler tracks from saved projects

## 6. Testing Requirements

### 6.1 Unit Tests

- **TEST-101:** SamplerController class methods
- **TEST-102:** Store integration for sampler tracks
- **TEST-103:** Sample loading and error handling
- **TEST-104:** Note triggering and pitch shifting
- **TEST-105:** Parameter change handling

### 6.2 Integration Tests

- **TEST-201:** Sampler integration with piano roll
- **TEST-202:** Sampler integration with transport
- **TEST-203:** Project save/load with sampler tracks
- **TEST-204:** MIDI data flow to sampler
- **TEST-205:** Audio routing through mixer channels

### 6.3 Performance Tests

- **TEST-301:** Multiple simultaneous sampler tracks
- **TEST-302:** High polyphony scenarios
- **TEST-303:** Large sample file handling
- **TEST-304:** Memory usage during extended operation
- **TEST-305:** CPU utilization during complex playback

### 6.4 User Acceptance Testing

- **TEST-401:** Sample loading workflow
- **TEST-402:** Piano roll note editing
- **TEST-403:** Parameter adjustment experience
- **TEST-404:** Playback quality assessment
- **TEST-405:** Overall user experience evaluation

## 7. Acceptance Criteria

### 7.1 Functional Acceptance

- Users can successfully create sampler tracks
- Audio samples can be loaded and played through the sampler
- Notes can be created and edited in the piano roll
- Samples play at the correct pitch according to MIDI note input
- All track controls (volume, pan, mute, solo) work correctly
- Projects with sampler tracks save and load correctly

### 7.2 Performance Acceptance

- Sampler tracks load within 3 seconds for samples under 50MB
- Playback has no audible glitches with 8+ sampler tracks
- UI remains responsive during sample loading and playback
- Memory usage stays within acceptable limits
- CPU usage remains below 40% during normal operation

### 7.3 UI/UX Acceptance

- All controls are intuitive and follow existing DAW conventions
- Visual feedback is clear and informative
- Error states are handled gracefully with useful messages
- Overall workflow feels natural and efficient

## 8. Implementation Milestones

### 8.1 Phase 1: Core Implementation
- Track type definitions and SamplerController
- Basic sample loading and playback
- Integration with Store and Transport

### 8.2 Phase 2: UI Implementation
- Track creation menu updates
- Basic track controls
- Piano roll integration

### 8.3 Phase 3: Advanced Features
- Granular synthesis parameter controls
- Advanced playback options
- Project persistence

### 8.4 Phase 4: Testing and Refinement
- Unit and integration testing
- Performance optimization
- Bug fixes and UX improvements

## 9. Dependencies and Constraints

### 9.1 Dependencies
- Tone.js for audio processing
- Existing MidiSampler class
- Store and Transport implementations
- Piano roll and timeline components

### 9.2 Constraints
- Must maintain compatibility with existing track types
- Must follow established design patterns and code style
- Must handle resource cleanup properly to prevent memory leaks
- Must support all project save/load operations

## 10. Future Enhancements (Post-MVP)

- Multi-sample support (different samples for different pitch ranges)
- Velocity layering (different samples for different velocity ranges)
- Sample start/end point adjustment
- Loop point setting for sustained sounds
- Time-stretching independent of pitch
- Basic effects (filter, reverb, delay)
- Sample visualization enhancements
- Sample editor with trim, normalize, and reverse functions