import React from 'react';
import { Box, IconButton, Slider } from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import MicIcon from '@mui/icons-material/Mic';
import DeleteIcon from '@mui/icons-material/Delete';
import { KnobControl } from '../common';
import { GRID_CONSTANTS } from '../../constants/gridConstants';

export interface BaseTrackSidebarControlsProps {
  index: number;
  trackId: string;
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
  renderAdditionalControls?: () => React.ReactNode;
  sliderColor?: string; // New prop for customizing slider color
}

const BaseTrackSidebarControls: React.FC<BaseTrackSidebarControlsProps> = ({
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
  onNameChange,
  renderAdditionalControls,
  sliderColor = '#1976d2' // Default MUI primary color
}) => {
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
        height: GRID_CONSTANTS.trackHeight - 1,
        bgcolor: '#1A1A1A',
        p: 0.5,
        boxSizing: 'border-box'
      }}>
        {/* Top box - controls */}
        <Box sx={{ 
          display: 'flex',
          width: '100%',
          height: '50%',
          justifyContent: 'space-between',
          px: 0,
          mx: 0,
        }}>
          <IconButton 
            size="small" 
            sx={{ 
              color: '#666',
              padding: 0.5,
              backgroundColor: 'transparent',
              transition: 'all 0.2s ease',
              '&:hover': { 
                color: '#FFF',
                transform: 'translateY(-2px)',
                bgcolor: 'transparent'
              }
            }}
            onClick={() => onDelete(index)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
          <IconButton 
            size="small" 
            sx={{ 
              color: muted ? '#ff4444' : '#666',
              padding: 0.5,
              backgroundColor: 'transparent',
              transition: 'all 0.2s ease',
              '&:hover': { 
                color: muted ? '#ff6666' : '#FFF',
                transform: 'translateY(-2px)',
                bgcolor: 'transparent'
              }
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
              backgroundColor: 'transparent',
              transition: 'all 0.2s ease',
              '&:hover': { 
                color: soloed ? '#66ff66' : '#FFF',
                transform: 'translateY(-2px)',
                bgcolor: 'transparent'
              }
            }}
            onClick={() => onSolo(!soloed)}
          >
            <MicIcon sx={{ fontSize: 'small' }} />
          </IconButton>

          <KnobControl 
            value={volume}
            onChange={onVolumeChange}
            min={0}
            max={100}
            color={sliderColor}
            size={25}
            label="Vol"
            type="volume"
            valueFormatter={(val) => `${Math.round(val)}`}
          />
          
          <KnobControl 
            value={pan}
            onChange={onPanChange}
            min={-100}
            max={100}
            step={1}
            color={sliderColor}
            size={25}
            label="Pan"
            type="pan"
            valueFormatter={(val) => val === 0 
              ? 'C' 
              : val < 0 
                ? `${Math.abs(val)}L` 
                : `${val}R`
            }
          />
        </Box>

        {/* Bottom box - track name */}
        <Box sx={{ 
          width: '100%',
          height: '50%',
          display: 'flex',
          alignItems: 'center'
        }}>
          <textarea
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            spellCheck={false}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#666',
              width: '100%',
              fontSize: '0.85rem',
              resize: 'none',
              overflow: 'hidden',
              height: '2.4em',
              lineHeight: '1.2em',
              padding: 0,
              margin: 0,
              fontFamily: 'inherit'
            }}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default BaseTrackSidebarControls;