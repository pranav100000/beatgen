# MIGRATION PLAN: CRA to Vite Studio Component

## Current Status

We have successfully migrated the basic structure of the Studio component from Create React App to Vite. The current implementation includes:

- Basic Studio layout with Timeline and Sidebar
- Basic Track creation and rendering
- Playback controls for transport
- BPM and time signature controls
- Project title editing
- Track volume, pan, and mute/solo controls
- Zustand state management integration

## Feature Parity Tasks

### 1. Add Track Menu Implementation

The current implementation has a simplified "Add Track" dropdown that needs to be upgraded to match the original functionality:

- [ ] Implement full AddTrackMenu component with proper styling
- [ ] Add audio file upload capability with proper file handling
- [ ] Support track creation with default instruments for MIDI tracks
- [ ] Add proper icons and visual indicators for different track types
- [ ] Implement drag-and-drop file support for quick track creation

**Technical Details:**
- Create dedicated AddTrackMenu component that supports file upload dialog
- Implement file type detection (audio/MIDI)
- Connect to AudioEngine for proper file loading
- Add drag area for files with visual feedback

### 2. Track Dragging Implementation

The current implementation does not properly support track dragging in the timeline:

- [ ] Fix track dragging functionality in the Timeline component
- [ ] Implement snap-to-grid for precise positioning
- [ ] Add visual feedback during drag operations
- [ ] Ensure proper synchronization with audio engine during and after drag
- [ ] Add position markers and time indicators

**Technical Details:**
- Review and fix the drag implementation in TrackPreview component
- Add event handling for mousedown/mousemove/mouseup
- Implement proper position calculation based on grid
- Connect position changes to store and audio engine
- Add visual guides for alignment

### 3. Consistent Track Controls

The TrackControlsSidebar needs to be consistent across all track types:

- [ ] Standardize UI appearance across audio, MIDI and drum tracks
- [ ] Ensure all controls (volume, pan, mute/solo) work correctly for all track types
- [ ] Add track type specific controls where needed
- [ ] Implement track color coding consistently
- [ ] Add track renaming capability

**Technical Details:**
- Update TrackControlsSidebar component to handle all track types consistently
- Add specialized controls for MIDI/drum tracks while maintaining visual consistency
- Implement track color system based on type or user selection
- Add inline editing for track names

### 4. Audio File Upload Functionality

The current implementation doesn't properly support audio file uploads:

- [ ] Add file upload dialog and drag-drop support
- [ ] Implement proper audio file processing
- [ ] Add waveform visualization for audio tracks
- [ ] Support common audio formats (WAV, MP3, etc.)
- [ ] Add progress indicators for file loading

**Technical Details:**
- Implement file input and drag-drop handlers
- Connect to AudioEngine for proper loading and decoding
- Create waveform visualization component
- Add proper error handling for unsupported formats
- Implement loading state indicators

### 5. MIDI Track Implementation

The current implementation lacks full MIDI track support:

- [ ] Implement proper MIDI track creation
- [ ] Add instrument selection for MIDI tracks
- [ ] Connect MIDI tracks to sound generators
- [ ] Support MIDI editing capabilities
- [ ] Implement MIDI playback synchronization

**Technical Details:**
- Expand MIDIManager integration
- Add instrument selector component
- Connect to Tone.js instruments for playback
- Implement basic piano roll for MIDI editing
- Synchronize MIDI events with transport

### 6. UI Polish and Enhancements

The current implementation needs visual polish to match the original:

- [ ] Fix all styling inconsistencies
- [ ] Add proper icons and visual indicators
- [ ] Implement tooltips and help text
- [ ] Add keyboard shortcuts
- [ ] Ensure proper responsive behavior

**Technical Details:**
- Review and update all component styles
- Add consistent icon set
- Implement tooltip system
- Add keyboard shortcut handler
- Test on different screen sizes

## Implementation Order

1. Fix track dragging (highest priority for usability)
2. Implement audio file upload functionality
3. Standardize track controls appearance
4. Enhance Add Track menu functionality
5. Implement MIDI track capabilities
6. Apply UI polish and enhancements

## Technical Considerations

- Keep using Zustand for state management
- Ensure proper audio engine synchronization
- Maintain clean component structure
- Prioritize performance, especially for timeline rendering
- Add proper error handling throughout
- Ensure all audio processing happens in appropriate context

## Testing Strategy

- Manual testing of all features against original implementation
- Component-level testing for key functionality
- End-to-end testing of critical user flows

## Completion Criteria

The migration will be considered complete when:
- All features from the original implementation are working correctly
- Performance is equivalent or better than the original
- The codebase is well-structured and maintainable
- All identified bugs are fixed