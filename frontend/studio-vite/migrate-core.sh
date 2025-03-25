#!/bin/bash
# Script to help migrate core modules from the main src to the Vite project

# Create necessary directories
mkdir -p src/core/audio-engine
mkdir -p src/core/midi
mkdir -p src/core/state
mkdir -p src/core/state/history
mkdir -p src/core/state/history/actions
mkdir -p src/core/db
mkdir -p src/core/types
mkdir -p src/core/instruments
mkdir -p src/components/Timeline
mkdir -p src/components/piano-roll
mkdir -p src/components/piano-roll/components
mkdir -p src/components/piano-roll/context
mkdir -p src/components/Sidebar
mkdir -p src/components/track-preview
mkdir -p src/components/track-sidebar-controls
mkdir -p src/constants

# Copy core files
echo "Copying core audio engine..."
cp ../src/core/audio-engine/audioEngine.ts src/core/audio-engine/

echo "Copying core state management..."
cp ../src/core/state/store.ts src/core/state/
cp ../src/core/state/StoreContext.tsx src/core/state/
cp ../src/core/state/project.ts src/core/state/
cp ../src/core/state/transport.ts src/core/state/

echo "Copying core history management..."
cp ../src/core/state/history/HistoryManager.ts src/core/state/history/
cp ../src/core/state/history/types.ts src/core/state/history/
cp ../src/core/state/history/actions/BPMActions.ts src/core/state/history/actions/
cp ../src/core/state/history/actions/TrackActions.ts src/core/state/history/actions/

echo "Copying core MIDI management..."
cp ../src/core/midi/MidiManager.ts src/core/midi/
cp ../src/core/midi/types.ts src/core/midi/

echo "Copying DB management..."
cp ../src/core/db/dexie-client.ts src/core/db/

echo "Copying types..."
cp ../src/core/types/track.ts src/core/types/
cp ../src/core/types/note.ts src/core/types/

echo "Copying instrument management..."
cp ../src/core/instruments/InstrumentManager.ts src/core/instruments/
cp ../src/core/instruments/types.ts src/core/instruments/

echo "Copying constants..."
cp ../src/constants/gridConstants.ts src/constants/

echo "Copying UI components..."
cp ../src/components/Timeline/Timeline.tsx src/components/Timeline/
cp ../src/components/Track.tsx src/components/
cp ../src/components/PlaybackCursor.tsx src/components/

echo "Migration script completed!"