import React, { useState, useCallback, useEffect } from 'react';
import { usePianoRollStore } from '../../stores/usePianoRollStore';
import { useStudioStore } from '../../stores/useStudioStore';
import PianoRoll from '../piano-roll2/PianoRoll';
import { convertToNoteState, NoteState } from '../../utils/noteConversion';
import { diffNotes } from '../../utils/noteDiffing';
import {
  createNoteWithHistory,
  deleteNoteWithHistory,
  moveNoteWithHistory,
  resizeNoteWithHistory
} from '../../utils/noteActions';
import { getTrackColor } from '../../constants/gridConstants';

/**
 * Component that renders all open piano roll windows
 * Uses the new PianoRoll2 component directly
 */
const PianoRollWindows: React.FC = () => {
  const { openPianoRolls, closePianoRoll } = usePianoRollStore();
  const { store, tracks } = useStudioStore();
  
  // Track previous notes per track for diffing when changes occur
  const [prevNotesByTrack, setPrevNotesByTrack] = useState<Record<string, NoteState[]>>({});
  
  // Get track IDs with open piano rolls
  const openTrackIds = Object.entries(openPianoRolls)
    .filter(([_, isOpen]) => isOpen)
    .map(([trackId]) => trackId);
    
  // Debug logging
  console.log('Piano Roll Windows - Open Track IDs:', openTrackIds);
  console.log('Piano Roll Windows - All Open Piano Rolls:', openPianoRolls);
  
  // Handle note changes - apply through history actions
  const handleNotesChange = useCallback(async (trackId: string, newNotes: NoteState[]) => {
    if (!store) return;
    
    const prevNotes = prevNotesByTrack[trackId] || [];
    const changes = diffNotes(prevNotes, newNotes);
    
    // Process each change and apply the appropriate history action
    for (const change of changes) {
      try {
        switch (change.type) {
          case 'add':
            await createNoteWithHistory(store, trackId, change.note);
            break;
          case 'delete':
            await deleteNoteWithHistory(store, trackId, change.id, change.note);
            break;
          case 'move':
            if (change.oldNote) {
              await moveNoteWithHistory(store, trackId, change.id, change.oldNote, change.note);
            }
            break;
          case 'resize':
            if (change.oldNote) {
              await resizeNoteWithHistory(store, trackId, change.id, change.oldNote, change.note);
            }
            break;
        }
      } catch (error) {
        console.error(`Error processing ${change.type} operation:`, error);
      }
    }
    
    // Update previous notes for this track for next comparison
    setPrevNotesByTrack(prev => ({
      ...prev,
      [trackId]: [...newNotes] // Create a new array to avoid reference issues
    }));
  }, [store, prevNotesByTrack]);
  
  // Handle note preview playback
  const handleNotePreview = useCallback((trackId: string, midiNote: number, isOn: boolean) => {
    if (!store) return;
    
    const track = tracks.find(t => t.id === trackId);
    const instrumentManager = store.getInstrumentManager();
    if (!instrumentManager) return;
    
    const instrumentId = track?.instrumentId || 'default';
    
    if (isOn) {
      instrumentManager.playNote(instrumentId, midiNote);
    } else {
      instrumentManager.stopNote(instrumentId, midiNote);
    }
  }, [store, tracks]);
  
  // Reset track notes when MidiManager updates
  useEffect(() => {
    if (!store) return;
    
    const midiManager = store.getMidiManager();
    if (!midiManager) return;
    
    // Subscribe to updates from MidiManager
    const unsubscribe = midiManager.subscribeToAllUpdates((updatedTrackId, updatedNotes) => {
      // Convert notes to PianoRoll2 format
      const convertedNotes = updatedNotes.map(convertToNoteState);
      
      // Update the tracked notes for this track
      setPrevNotesByTrack(prev => ({
        ...prev,
        [updatedTrackId]: convertedNotes
      }));
    });
    
    return () => {
      unsubscribe();
    };
  }, [store]);
  
  if (openTrackIds.length === 0) {
    return null;
  }
  
  console.log('===== PianoRollWindows RENDER =====');
  console.log('openTrackIds:', openTrackIds);
  
  return (
    <>
      {openTrackIds.map(trackId => {
        console.log(`Rendering piano roll for track: ${trackId}`);
        
        const track = tracks.find(t => t.id === trackId);
        console.log('Found track:', track);
        
        const midiManager = store?.getMidiManager();
        const notes = midiManager?.getTrackNotes(trackId) || [];
        console.log(`Notes for track ${trackId}:`, notes.length);
        
        const pianoRollNotes = notes.map(convertToNoteState);
        console.log('Converted notes:', pianoRollNotes.length);
        
        // Initialize notes tracking if not already set
        if (!prevNotesByTrack[trackId]) {
          console.log('Initializing prevNotesByTrack for track:', trackId);
          setPrevNotesByTrack(prev => ({
            ...prev,
            [trackId]: pianoRollNotes
          }));
        }
        
        // Create an event handler for the window close button
        // Since PianoRoll2 doesn't provide a direct onClose callback,
        // we need to handle this manually when a window is closed by the user
        const handleCloseCallback = () => {
          console.log('Should close piano roll for track:', trackId);
          closePianoRoll(trackId);
        };
        
        // Note: ESC key handling is now moved to a top-level effect
        console.log('About to render PianoRoll component for track:', trackId);
        
        try {
          // Now that we know the component container works, let's try with the real PianoRoll
          // But with a div wrapper that ensures it's positioned correctly
          return (
            <div 
              key={`piano-roll-wrapper-${trackId}`}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 9999,
                pointerEvents: 'none' // Add this line to allow clicks to pass through
              }}
            >
              <PianoRoll
                key={`piano-roll-${trackId}`}
                title={`Piano Roll - ${track?.name || 'Unknown Track'}`}
                color={track?.index !== undefined ? getTrackColor(track.index) : getTrackColor(Math.abs(trackId.charCodeAt(0) % 9))}
                initialNotes={pianoRollNotes}
                onNotesChange={(newNotes) => handleNotesChange(trackId, newNotes)}
                // Position in the center of the screen
                initialX={Math.max(50, window.innerWidth / 2 - 420)}
                initialY={Math.max(50, window.innerHeight / 2 - 250)}
                initialWidth={840}
                initialHeight={500}
                contentWidth={5000}
                keyboardWidth={60}
                // Pass the scale notes if you have them
                scaleNotes={[0, 2, 4, 5, 7, 9, 11]} // C Major scale
                // Add the close handler
                onClose={() => closePianoRoll(trackId)}
              />
            </div>
          );
        } catch (error) {
          console.error('Error rendering PianoRoll:', error);
          return <div key={`piano-roll-error-${trackId}`}>Error rendering piano roll: {String(error)}</div>;
        }
      })}
    </>
  );
};

export default PianoRollWindows;