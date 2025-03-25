import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Slider, 
  IconButton, 
  Tooltip, 
  TextField,
  Select, 
  MenuItem
} from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import PanToolIcon from '@mui/icons-material/PanTool';
import DeleteIcon from '@mui/icons-material/Delete';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import { TrackState } from '../../core/types/track';
import { getTrackColor } from '../../constants/gridConstants';

interface TrackControlsProps {
  track: TrackState;
  index: number;
  onVolumeChange: (trackId: string, volume: number) => void;
  onPanChange: (trackId: string, pan: number) => void;
  onMuteToggle: (trackId: string, muted: boolean) => void;
  onSoloToggle: (trackId: string, soloed: boolean) => void;
  onTrackDelete: (trackId: string) => void;
  onOpenPianoRoll?: (trackId: string) => void;
  onTrackNameChange?: (trackId: string, name: string) => void;
}

const TrackControls: React.FC<TrackControlsProps> = ({
  track,
  index,
  onVolumeChange,
  onPanChange,
  onMuteToggle,
  onSoloToggle,
  onTrackDelete,
  onOpenPianoRoll,
  onTrackNameChange
}) => {
  const trackColor = getTrackColor(index);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(track.name);
  const nameInputRef = useRef<HTMLInputElement>(null);
  
  // Local state for slider values during dragging
  const [localVolume, setLocalVolume] = useState(track.volume);
  const [localPan, setLocalPan] = useState(track.pan);
  
  // Update local state if track values change from elsewhere
  useEffect(() => {
    setLocalVolume(track.volume);
  }, [track.volume]);
  
  useEffect(() => {
    setLocalPan(track.pan);
  }, [track.pan]);
  
  // Handler for volume changes during dragging (updates local state only)
  const handleVolumeChange = (event: Event, newValue: number | number[]) => {
    // Just update local component state, no store updates
    setLocalVolume(newValue as number);
  };
  
  // Handler for volume changes when drag completes (updates store)
  const handleVolumeChangeCommitted = (event: React.SyntheticEvent | Event, newValue: number | number[]) => {
    onVolumeChange(track.id, newValue as number);
  };
  
  // Handler for pan changes during dragging (updates local state only)
  const handlePanChange = (event: Event, newValue: number | number[]) => {
    // Just update local component state, no store updates
    setLocalPan(newValue as number);
  };
  
  // Handler for pan changes when drag completes (updates store)
  const handlePanChangeCommitted = (event: React.SyntheticEvent | Event, newValue: number | number[]) => {
    onPanChange(track.id, newValue as number);
  };
  
  // Handler for mute toggling
  const handleMuteToggle = () => {
    onMuteToggle(track.id, !track.muted);
  };
  
  // Handler for solo toggling
  const handleSoloToggle = () => {
    onSoloToggle(track.id, !track.soloed);
  };
  
  // Handler for track deletion
  const handleDelete = () => {
    onTrackDelete(track.id);
  };
  
  // Handler for opening piano roll
  const handleOpenPianoRoll = () => {
    if (onOpenPianoRoll && (track.type === 'midi' || track.type === 'drum')) {
      onOpenPianoRoll(track.id);
    }
  };
  
  // Handler for track name editing
  const handleNameChange = () => {
    if (editedName.trim() !== '' && onTrackNameChange) {
      onTrackNameChange(track.id, editedName);
    }
    setIsEditingName(false);
  };
  
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isEditingName]);
  
  // Render type-specific controls based on track type
  const renderTypeSpecificControls = () => {
    switch(track.type) {
      case 'midi':
        return (
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              Instrument
            </Typography>
            <Select
              size="small"
              value="synth"
              fullWidth
              sx={{ 
                mt: 0.5,
                fontSize: '12px',
                '.MuiSelect-select': { py: 0.5 },
                bgcolor: 'rgba(0,0,0,0.2)'
              }}
            >
              <MenuItem value="synth">Synth</MenuItem>
              <MenuItem value="piano">Piano</MenuItem>
              <MenuItem value="bass">Bass</MenuItem>
            </Select>
          </Box>
        );
      
      case 'drum':
        return (
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              Drum Kit
            </Typography>
            <Select
              size="small"
              value="808"
              fullWidth
              sx={{ 
                mt: 0.5,
                fontSize: '12px',
                '.MuiSelect-select': { py: 0.5 },
                bgcolor: 'rgba(0,0,0,0.2)'
              }}
            >
              <MenuItem value="808">808 Kit</MenuItem>
              <MenuItem value="acoustic">Acoustic Kit</MenuItem>
              <MenuItem value="electronic">Electronic Kit</MenuItem>
            </Select>
          </Box>
        );
        
      case 'audio':
        return (
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              Audio File
            </Typography>
            <Box sx={{ 
              mt: 0.5,
              fontSize: '12px',
              color: 'rgba(255,255,255,0.8)',
              bgcolor: 'rgba(0,0,0,0.2)',
              p: 0.5,
              borderRadius: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {track.audioFile?.name || 'No file loaded'}
            </Box>
          </Box>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <Box sx={{
      p: 1,
      mb: 0.5,
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      borderLeft: `4px solid ${trackColor}`,
      bgcolor: 'rgba(30, 30, 30, 0.7)',
      '&:hover': {
        bgcolor: 'rgba(40, 40, 40, 0.9)',
      },
    }}>
      {/* Track Name and Type Indicator */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        mb: 1
      }}>
        {isEditingName ? (
          <TextField
            inputRef={nameInputRef}
            size="small"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleNameChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameChange();
              if (e.key === 'Escape') {
                setEditedName(track.name);
                setIsEditingName(false);
              }
            }}
            sx={{
              minWidth: '120px',
              '.MuiInputBase-input': {
                color: 'white',
                fontSize: '13px',
                py: 0.5,
                px: 1
              }
            }}
          />
        ) : (
          <Typography 
            variant="subtitle2" 
            sx={{ 
              fontWeight: 'bold',
              cursor: 'pointer',
              '&:hover': { textDecoration: 'underline' }
            }}
            onClick={() => setIsEditingName(true)}
          >
            {track.name}
          </Typography>
        )}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {(track.type === 'midi' || track.type === 'drum') && (
            <Tooltip title="Open piano roll">
              <IconButton 
                size="small" 
                onClick={handleOpenPianoRoll}
                sx={{ 
                  color: 'rgba(255, 255, 255, 0.7)',
                  '&:hover': { 
                    color: trackColor,
                    bgcolor: `${trackColor}10`
                  }
                }}
              >
                <MusicNoteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Delete track">
            <IconButton 
              size="small" 
              onClick={handleDelete}
              sx={{ 
                color: 'rgba(255, 255, 255, 0.7)',
                '&:hover': { 
                  color: '#ff5252',
                  bgcolor: 'rgba(255, 82, 82, 0.1)'
                }
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      
      {/* Track Type Indicator */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 0.5 }}>
        <Box 
          sx={{ 
            bgcolor: track.type === 'audio' ? '#4caf50' : 
                   track.type === 'midi' ? '#2196f3' : 
                   track.type === 'drum' ? '#ff9800' : '#9c27b0', 
            borderRadius: '3px',
            px: 0.7,
            py: 0.2,
            fontSize: '10px',
            fontWeight: 'bold',
            color: 'white'
          }}
        >
          {track.type.toUpperCase()}
        </Box>
        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
          {track.type === 'audio' ? 'Audio Track' : 
           track.type === 'midi' ? 'MIDI Instrument' : 
           track.type === 'drum' ? 'Drum Machine' : 'Video Track'}
        </Typography>
      </Box>
      
      {/* Type-specific controls */}
      {renderTypeSpecificControls()}
      
      {/* Volume Control */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Tooltip title={track.muted ? "Unmute" : "Mute"}>
          <IconButton 
            size="small" 
            onClick={handleMuteToggle}
            sx={{ 
              color: track.muted ? 'rgba(255, 82, 82, 0.9)' : 'rgba(255, 255, 255, 0.7)',
              '&:hover': { color: track.muted ? '#ff5252' : 'white' }
            }}
          >
            {track.muted ? <VolumeOffIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <Slider
          size="small"
          value={localVolume}
          onChange={handleVolumeChange}
          onChangeCommitted={handleVolumeChangeCommitted}
          aria-label="Volume"
          min={0}
          max={100}
          sx={{ 
            mx: 1,
            color: track.muted ? 'rgba(255, 255, 255, 0.3)' : trackColor,
            opacity: track.muted ? 0.5 : 1,
            '& .MuiSlider-thumb': {
              width: 12,
              height: 12,
              '&:hover, &.Mui-focusVisible': {
                boxShadow: `0px 0px 0px 8px ${trackColor}20`
              }
            }
          }}
        />
        <Typography variant="caption" sx={{ 
          minWidth: '30px', 
          textAlign: 'right',
          color: track.muted ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.8)'
        }}>
          {localVolume}%
        </Typography>
      </Box>
      
      {/* Pan Control */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Tooltip title="Pan">
          <PanToolIcon 
            fontSize="small" 
            sx={{ 
              color: 'rgba(255, 255, 255, 0.7)',
              transform: 'rotate(90deg)',
              fontSize: 18,
              mx: 0.5
            }} 
          />
        </Tooltip>
        <Slider
          size="small"
          value={localPan}
          onChange={handlePanChange}
          onChangeCommitted={handlePanChangeCommitted}
          aria-label="Pan"
          min={-100}
          max={100}
          sx={{ 
            mx: 1,
            color: trackColor,
            '& .MuiSlider-thumb': {
              width: 12,
              height: 12,
              '&:hover, &.Mui-focusVisible': {
                boxShadow: `0px 0px 0px 8px ${trackColor}20`
              }
            },
            '& .MuiSlider-track': {
              // Makes the track always grow from center for pan
              '&::before': {
                content: '""',
                position: 'absolute',
                height: '100%',
                width: '2px',
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                left: '50%',
                transform: 'translateX(-50%)'
              }
            }
          }}
          marks={[
            { value: -100, label: 'L' },
            { value: 0, label: 'C' },
            { value: 100, label: 'R' }
          ]}
        />
        <Typography variant="caption" sx={{ 
          minWidth: '36px', 
          textAlign: 'right',
          color: 'rgba(255, 255, 255, 0.8)'
        }}>
          {localPan === 0 ? 'C' : 
           localPan < 0 ? `L${Math.abs(localPan)}` : 
           `R${localPan}`}
        </Typography>
      </Box>
      
      {/* Solo Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Tooltip title={track.soloed ? "Unsolo" : "Solo"}>
          <Box 
            onClick={handleSoloToggle}
            sx={{ 
              bgcolor: track.soloed ? '#ffc107' : 'rgba(255, 255, 255, 0.1)',
              color: track.soloed ? '#000' : 'rgba(255, 255, 255, 0.7)',
              borderRadius: '3px',
              px: 1,
              py: 0.3,
              fontSize: '10px',
              fontWeight: 'bold',
              cursor: 'pointer',
              '&:hover': {
                bgcolor: track.soloed ? '#e6ac00' : 'rgba(255, 255, 255, 0.15)'
              }
            }}
          >
            S
          </Box>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default TrackControls;