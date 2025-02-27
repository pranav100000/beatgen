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