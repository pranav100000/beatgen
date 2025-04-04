# DAW Performance Optimization Plan

## 1. PlaybackCursor Component Redesign
- Create refs for direct DOM manipulation of cursor position
- Implement imperative methods:
  - `play()`: Start animation frame loop, sync with transport
  - `pause()`: Cancel animations, keep position
  - `stop()/reset()`: Move cursor to start position, cancel animations
  - `seek(time)`: Jump cursor to specified position
- Set up independent requestAnimationFrame loop
- Add cleanup for animation frames on unmount
- Use React.memo with a custom equality function to prevent re-renders

## 2. TimeDisplay Component
- Create isolated component with its own DOM refs
- Implement independent animation frame loop
- Update display text directly via DOM manipulation
- Wrap with React.memo to prevent parent-triggered re-renders

## 3. Transport Control Handlers Modifications
- PlayHandler: Update playing state, call cursor.play()
- PauseHandler: Update playing state, call cursor.pause()
- StopHandler: Update playing state, set position to 0, call cursor.stop()
- SeekHandler: Call cursor.seek() without updating global position state

## 4. Studio Component Changes
- Remove requestAnimationFrame loop that updates global state 60x/second
- Replace with refs to cursor and time display components
- Only update global state for significant events (play/pause/stop)

## 5. Additional Considerations
- Handle resize events for proper cursor positioning
- Ensure proper cleanup on unmount
- Add debug mode for timing verification
- Maintain all existing functionality while eliminating unnecessary re-renders

This approach creates a clear separation between:
- Infrequent state updates (UI interactions)
- Continuous visual updates (direct DOM manipulation)