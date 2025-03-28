# MIDI Player Integration Plan

## High-Level Integration Tasks

### 1. Enhance the Store Class
- [ ] Add MidiPlayer initialization in the constructor alongside AudioEngine
- [ ] Add methods to access the MidiPlayer instance
- [ ] Ensure proper lifecycle management (initialization/cleanup)

### 2. Update TransportController for MIDI Playback
- [ ] Extend play/pause/stop/seek methods to handle both audio and MIDI tracks
- [ ] Add logic to calculate correct timing offsets for MIDI tracks
- [ ] Ensure MIDI tracks respond to transport controls synchronously with audio tracks

### 3. Connect MidiManager with MidiPlayer
- [ ] When MIDI files are loaded via MidiManager, register them with MidiPlayer
- [ ] Load appropriate soundfonts when MIDI tracks are created
- [ ] Keep track data in sync between MidiManager and MidiPlayer

### 4. Implement Timeline Integration
- [ ] Handle MIDI track positioning on the timeline
- [ ] Ensure MIDI tracks start at the correct timeline position
- [ ] Support dragging/repositioning of MIDI tracks in the timeline

### 5. Handle Track Controls for MIDI Tracks
- [ ] Connect volume/pan/mute/solo controls to MidiPlayer
- [ ] Ensure instrument selection changes update the MidiPlayer
- [ ] Add visual feedback during soundfont loading

### 6. Add Error Handling and Fallbacks
- [ ] Handle missing soundfonts gracefully
- [ ] Provide meaningful error messages for users
- [ ] Implement fallback instruments when preferred soundfont is unavailable

## Notes and Learnings

- SoundfontMidiPlayer is currently working in isolation with manual testing
- The worklet_processor.min.js file needs to be available in the public directory
- Soundfont loading requires proper error handling to avoid breaking the application

## Implementation Progress

### Date: 2025-03-25
- Created test page for SoundfontMidiPlayer
- Successfully loaded and played a MIDI file with a soundfont
- Identified integration points in the existing codebase
- Created direct test for MidiPlayer class
- Added MidiPlayer to Store class (imported but not fully integrated)
- Added getMidiPlayer method to Store interface
- Created SimpleMidiTest using SoundfontMidiPlayer directly (bypassing the existing player infrastructure)
- Fixed import issues with spessasynth_lib in MidiPlayer
- Verified that SoundfontMidiPlayer works correctly with direct test

### Next Steps
- Focus on integrating SoundfontMidiPlayer rather than MidiPlayer for simplicity and reliability
- Use working SoundfontMidiPlayer as the basis for MIDI playback in TransportController
- Create a new MidiTrackPlayer class that wraps SoundfontMidiPlayer with the interfaces needed for the app