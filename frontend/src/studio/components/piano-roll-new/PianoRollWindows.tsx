import React, { useState, useCallback, useEffect, memo, useMemo } from 'react';
import { usePianoRollStore } from '../../stores/usePianoRollStore';
import { useStudioStore } from '../../stores/studioStore';
import PianoRoll from '../piano-roll2/PianoRoll';
import { convertToNoteState, NoteState } from '../../utils/noteConversion';
import { diffNotes } from '../../utils/noteDiffing';
import { getTrackColor } from '../../constants/gridConstants';
import { MidiTrack } from 'src/platform/types/track_models/midi_track';
import { CombinedTrack } from 'src/platform/types/project';
import { Store } from '../../core/state/store'; 

const PianoRollWindows: React.FC = memo(() => {
  const openPianoRolls = usePianoRollStore(state => state.openPianoRolls);
  const closePianoRoll = usePianoRollStore(state => state.closePianoRoll);
  
  const store = useStudioStore(state => state.store);
  const tracks = useStudioStore(state => state.tracks);
  const addMidiNote = useStudioStore(state => state.addMidiNote);
  const removeMidiNote = useStudioStore(state => state.removeMidiNote);
  const updateMidiNote = useStudioStore(state => state.updateMidiNote);
  const getKeyNotes = useStudioStore(state => state.getKeyNotes);
  
  const [prevNotesByTrack, setPrevNotesByTrack] = useState<Record<string, NoteState[]>>({});
  
  const openTrackIds = useMemo(() => 
      Object.entries(openPianoRolls)
          .filter(([_, isOpen]) => isOpen)
          .map(([trackId]) => trackId),
      [openPianoRolls]
  );
    
  console.log('Piano Roll Windows - Render (Individual Selectors) - Open IDs:', openTrackIds);

  const handleNotesChange = useCallback(async (trackId: string, newNotes: NoteState[]) => {
    const prevNotes = prevNotesByTrack[trackId] || [];
    const changes = diffNotes(prevNotes, newNotes);
    for (const change of changes) {
      try {
        switch (change.type) {
          case 'add': await addMidiNote(trackId, change.note); break;
          case 'delete': await removeMidiNote(trackId, change.id); break;
          case 'move':
          case 'resize': if (change.oldNote) { await updateMidiNote(trackId, change.note); } break;
        }
      } catch (error) { console.error(`Error processing ${change.type} op:`, error); }
    }
    setPrevNotesByTrack(prev => ({ ...prev, [trackId]: [...newNotes] }));
  }, [prevNotesByTrack, addMidiNote, removeMidiNote, updateMidiNote]);

  const handleNotePreview = useCallback((trackId: string, midiNote: number, isOn: boolean) => {
    const instrumentManager = store?.getInstrumentManager(); 
    if (!instrumentManager) return;
    const track = tracks.find(t => t.id === trackId);
    const instrumentId = (track?.track as MidiTrack)?.instrument_id || 'default';
    if (isOn) { instrumentManager.playNote(instrumentId, midiNote); }
    else { instrumentManager.stopNote(instrumentId, midiNote); }
  }, [store, tracks]);

  // Effect to initialize prevNotesByTrack for newly opened rolls
  useEffect(() => {
    const midiManager = store?.getMidiManager();
    if (!midiManager || openTrackIds.length === 0) return; // Exit if no manager or no open rolls

    let stateUpdateNeeded = false;
    const updates: Record<string, NoteState[]> = {};

    openTrackIds.forEach(trackId => {
      if (!prevNotesByTrack[trackId]) { // Check if state for this ID needs initialization
        const currentNotes = midiManager.getTrackNotes(trackId) || [];
        const pianoRollNotes = currentNotes.map(convertToNoteState);
        updates[trackId] = pianoRollNotes;
        stateUpdateNeeded = true;
        console.log(`Initializing prevNotesByTrack for new trackId: ${trackId}`);
      }
    });

    if (stateUpdateNeeded) {
      setPrevNotesByTrack(prev => ({ ...prev, ...updates }));
    }
  // Depend on the list of open IDs and the store instance
  }, [openTrackIds, store, prevNotesByTrack]); 

  // Keep MidiManager useEffect commented out
  /* useEffect(() => { ... }, [store]); */

  if (openTrackIds.length === 0) { return null; }
  
  return (
    <>
      {openTrackIds.map(trackId => {
        const track = tracks.find(t => t.id === trackId);
        const midiManager = store?.getMidiManager();
        const currentNotes = midiManager?.getTrackNotes(trackId) || [];
        const pianoRollNotes = currentNotes.map(convertToNoteState);

        if (!track) {
           console.warn(`PianoRollWindows: Track data for ID ${trackId} not found render.`);
           return null; 
        }

        const trackWithIndex = track as (CombinedTrack & { index?: number });
        const trackColor = getTrackColor(trackWithIndex?.index ?? 0); 

        return (
          <div 
            key={`piano-roll-wrapper-${trackId}`} 
            style={{ /* Necessary wrapper styles */ 
                position: 'fixed', 
                zIndex: 9999, // Ensure it's on top
                // Remove pointer-events: none if the wrapper shouldn't block interaction
                // pointerEvents: 'none' 
                // Position might be handled by PianoRoll component itself via initialX/Y
                // top: 0, left: 0, width: '100%', height: '100%' // Example covering screen
            }} 
          >
            <PianoRoll
              key={`piano-roll-${trackId}`}
              title={`Piano Roll - ${track?.name || 'Unknown Track'}`}
              color={trackColor} 
              initialNotes={pianoRollNotes} 
              onNotesChange={(newNotes) => handleNotesChange(trackId, newNotes)}
              // Restore necessary props
              initialX={Math.max(50, window.innerWidth / 2 - 420)}
              initialY={Math.max(50, window.innerHeight / 2 - 250)}
              initialWidth={840}
              initialHeight={500}
              contentWidth={5000} 
              keyboardWidth={60} 
              scaleNotes={[]} 
              onClose={() => closePianoRoll(trackId)}
            />
          </div>
        );
      })}
    </>
  );
});

export default PianoRollWindows;