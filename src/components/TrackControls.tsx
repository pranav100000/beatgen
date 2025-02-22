import { Box, IconButton, Slider } from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import MicIcon from '@mui/icons-material/Mic';
import DeleteIcon from '@mui/icons-material/Delete';
import { GRID_CONSTANTS } from '../constants/gridConstants';

interface TrackControlsProps {
  index: number;
  onDelete: (index: number) => void;
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  name: string;
  onVolumeChange: (volume: number) => void;
  onPanChange: (pan: number) => void;
  onMute: (muted: boolean) => void;
  onSolo: (soloed: boolean) => void;
  onNameChange: (name: string) => void;
}

function TrackControls({
  index,
  onDelete,
  volume,
  pan,
  muted,
  soloed,
  name,
  onVolumeChange,
  onPanChange,
  onMute,
  onSolo,
  onNameChange
}: TrackControlsProps) {
  return (
    <Box sx={{
      position: 'relative',
      '&:not(:last-child)': {
        borderBottom: `1px solid ${GRID_CONSTANTS.borderColor}`
      }
    }}>
      <Box sx={{ 
        display: 'flex',
        flexDirection: 'column',
        height: GRID_CONSTANTS.trackHeight,
        bgcolor: '#1A1A1A',
        p: 0.5,
        alignItems: 'center',
        boxSizing: 'border-box'
      }}>
        <Box sx={{ 
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          gap: 1
        }}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <input
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#666',
                width: '100%',
                fontSize: '0.85rem'
              }}
            />
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <IconButton 
                size="small" 
                sx={{ 
                  color: muted ? '#ff4444' : '#666',
                  padding: 0.5,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
                }}
                onClick={() => onMute(!muted)}
              >
                <VolumeUpIcon sx={{ fontSize: 'small' }} />
              </IconButton>
              <IconButton 
                size="small" 
                sx={{ 
                  color: soloed ? '#44ff44' : '#666',
                  padding: 0.5,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
                }}
                onClick={() => onSolo(!soloed)}
              >
                <MicIcon sx={{ fontSize: 'small' }} />
              </IconButton>
            <IconButton 
              size="small" 
              sx={{ 
                color: '#666',
                padding: 0.5,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
              }}
              onClick={() => onDelete(index)}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
            </Box>
          </Box>
          <Box sx={{ 
            display: 'flex',
            alignItems: 'center',
            gap: 3
          }}>
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Slider
                size="small"
                value={volume}
                onChange={(_, value) => onVolumeChange(value as number)}
                min={-60}
                max={6}
                sx={{ 
                  py: 0,
                  '& .MuiSlider-thumb': {
                    width: 12,
                    height: 12
                  }
                }}
              />
              <Slider
                size="small"
                value={pan}
                onChange={(_, value) => onPanChange(value as number)}
                min={-1}
                max={1}
                step={0.1}
                sx={{ 
                  py: 0,
                  '& .MuiSlider-thumb': {
                    width: 12,
                    height: 12
                  }
                }}
              />
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default TrackControls; 