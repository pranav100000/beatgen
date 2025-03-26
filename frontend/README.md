# BeatGen Studio - Vite Migration

This project is a Vite-based version of the BeatGen DAW studio, migrated from Create React App for improved performance.

## Setup

1. Install dependencies:
```
npm install
```

2. Run the development server:
```
npm run dev
```

## Migration Progress

Currently, this is a partial migration with:
- Basic UI components
- A simplified studio layout
- No audio engine integration yet

## Migration Process

The `migrate-core.sh` script will copy core files from the original project. Run it to copy the necessary files:

```
./migrate-core.sh
```

See `MIGRATION_PLAN.md` for detailed steps on how to continue the migration.

## Architecture

The project follows the same architecture as the original:
- `core/` - Contains the audio engine, MIDI, and state management
- `components/` - UI components
- `constants/` - Shared constants and utilities

## Development

After running the dev server, modify `Studio.tsx` to add functionality incrementally. We recommend:
1. First get the Timeline working
2. Add simple track rendering
3. Integrate audio playback
4. Add MIDI functionality
5. Implement the full studio