# CLAUDE.md - Beat Generator DAW

## Build & Test Commands
- `npm start` - Run development server
- `npm test` - Run all tests
- `npm test -- --testPathPattern=src/components/piano-roll` - Run specific test(s)
- `npm run build` - Build for production
- `npm run lint` - Lint codebase (uses eslint-config-react-app preset)

## Code Style Guidelines
- **Components**: Use functional components with hooks, not class components
- **Directory Structure**: Follow `/src/components`, `/src/core`, `/src/api` organization
- **State Management**: Use Context API; history manager is action-based (not state-based)
- **Types**: Use TypeScript interfaces; strict type checking when possible
- **Naming**: PascalCase for components, camelCase for functions/variables, kebab-case for files
- **Imports**: Group imports by external libraries, then internal modules
- **Error Handling**: Use try/catch with appropriate user feedback
- **Testing**: Use React Testing Library with Jest

## Important Patterns
- History manager for undo/redo requires action-based state changes
- Timeline synchronization with audio/MIDI needs precise timing via Tone.js
- All UI interactions should be logged as actions via the history manager
- Piano roll integrates with MIDI manager for note input/editing

## Tone.js Best Practices
- When working with players positioned on the timeline, use the following pattern:
  - Unsync player before repositioning: `player.unsync()`
  - Then use `player.sync().start(0, offset)` with the correct offset value
  - Don't mix `sync()` with `seek()` - use `start()` with offset parameter instead
- For tracks that should start later, use Transport scheduling:
  ```javascript
  const eventId = Tone.Transport.schedule(time => {
    player.start(time, offset);
  }, delayTime);
  ```
- Always clear scheduled events when stopping/pausing/seeking:
  ```javascript
  scheduledEvents.forEach(id => Tone.Transport.clear(id));
  ```
- Handle track positions by converting pixel positions to time offsets
- Always track scheduled event IDs for proper cleanup