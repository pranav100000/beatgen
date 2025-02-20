import { Box, IconButton } from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import MicIcon from '@mui/icons-material/Mic';
import DeleteIcon from '@mui/icons-material/Delete';
import { GRID_CONSTANTS } from '../constants/gridConstants';

function TrackControls({ index, onDelete }) {
  return (
    <Box sx={{ 
      width: GRID_CONSTANTS.controlsWidth,
      height: GRID_CONSTANTS.trackHeight,
      display: 'flex',
      flexDirection: 'column',
      bgcolor: '#1A1A1A',
      borderRight: `${GRID_CONSTANTS.borderWidth} solid ${GRID_CONSTANTS.borderColor}`,
      borderBottom: `${GRID_CONSTANTS.borderWidth} solid ${GRID_CONSTANTS.borderColor}`,
      position: 'relative'
    }}>
      <Box sx={{ 
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        height: '100%'
      }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 1
        }}>
          <Box sx={{ color: '#666' }}>Track {index + 1}</Box>
          <IconButton 
            size="small" 
            sx={{ color: '#666' }}
            onClick={() => onDelete(index)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton size="small" sx={{ color: '#666' }}>
            <VolumeUpIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" sx={{ color: '#666' }}>
            <MicIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}

export default TrackControls; 