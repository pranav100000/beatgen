import React from 'react';
import { PianoRollProvider, usePianoRoll } from './context/PianoRollContext';
import PianoRollWindow from './components/PianoRollWindow';
import MidiNotesPreview from './components/MidiNotesPreview';

// Re-export components and hooks for external use
export { usePianoRoll } from './context/PianoRollContext';
export { default as MidiNotesPreview } from './components/MidiNotesPreview';

interface PianoRollModuleProps {
  children: React.ReactNode;
}

// Main module wrapper with context provider
const PianoRollModule: React.FC<PianoRollModuleProps> = ({ children }) => {
  return (
    <PianoRollProvider>
      {children}
    </PianoRollProvider>
  );
};

// Component to render all open piano roll windows
export const PianoRollWindows: React.FC = () => {
  return null;
  const { openedPianoRolls } = usePianoRoll();
  
  console.log('Rendering PianoRollWindows with state:', openedPianoRolls);
  
  // Filter to only include open piano rolls
  const openPianoRolls = Object.entries(openedPianoRolls).filter(([_, isOpen]) => isOpen);
  
  if (openPianoRolls.length === 0) {
    return null;
  }
  
  // Create a piano roll window for each open track
  return (
    <>
      {openPianoRolls.map(([trackId, _]) => (
        <PianoRollWindow key={`piano-roll-${trackId}`} trackId={trackId} />
      ))}
    </>
  );
};

export default PianoRollModule;