import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import DraggableModal from '../../draggable-modals/DraggableModal';
import PianoRollCanvas from './PianoRollCanvas';
import DrumRoll from './DrumRoll';
import { usePianoRoll } from '../context/PianoRollContext';
import { useStudioStore } from '../../../stores/useStudioStore';
import { getTrackColor } from '../../../constants/gridConstants';
interface PianoRollWindowProps {
  trackId: string;
}

const PianoRollWindow: React.FC<PianoRollWindowProps> = ({ trackId }) => {
  // Get piano roll state
  const { openedPianoRolls, closePianoRoll } = usePianoRoll();
  const isOpen = openedPianoRolls[trackId] || false;
  
  // Get track details from studio store
  const { tracks } = useStudioStore();
  const track = tracks.find(t => t.id === trackId);
  
  // Calculate center position for the modal - IMPORTANT: Always call hooks at the top level
  const initialPosition = React.useMemo(() => {
    // Use window dimensions to center the modal
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const modalWidth = 840; // Same as initialSize.width
    const modalHeight = 500; // Same as initialSize.height
    
    return {
      x: Math.max(0, (windowWidth - modalWidth) / 2),
      y: Math.max(0, (windowHeight - modalHeight) / 3) // Position slightly above center
    };
  }, []);
  
  // Close handler
  const handleClose = () => {
    closePianoRoll(trackId);
  };
  
  if (!track) return null;
  
  // Determine if this is a drum track or regular MIDI track
  const isDrumTrack = track.type === 'drum';
  
  // Modal title based on track name and type
  const modalTitle = `${isDrumTrack ? 'Drum Editor' : 'Piano Roll'} - ${track.name}`;
  
  return (
    <DraggableModal
      isOpen={isOpen}
      onClose={handleClose}
      title={modalTitle}
      initialPosition={initialPosition}
      initialSize={{ width: 840, height: 500 }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Control toolbar */}
        <Box sx={{ 
          height: '40px', 
          bgcolor: '#222', 
          borderBottom: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          px: 1
        }}>
          <Typography variant="body2" sx={{ color: '#aaa', mr: 2 }}>
            Track: {track.name}
          </Typography>
          
          {/* Add toolbar controls here (undo/redo, tools, quantize, etc.) */}
        </Box>
        
        {/* Editor content - show either PianoRoll or DrumRoll based on track type */}
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          {isDrumTrack ? (
            <DrumRoll trackId={trackId} />
          ) : (
            <PianoRollCanvas trackId={trackId} color={getTrackColor(tracks.findIndex(t => t.id === trackId))} />
          )}
        </Box>
      </Box>
    </DraggableModal>
  );
};

export default PianoRollWindow;