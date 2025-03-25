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
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import DeleteIcon from '@mui/icons-material/Delete';
import PanToolIcon from '@mui/icons-material/PanTool';
import { TrackState } from '../core/types/track';
import { getTrackColor, GRID_CONSTANTS } from '../constants/gridConstants';
import ControlKnob from './ControlKnob';

// Interface for the component props
interface TrackControlsSidebarProps {
  tracks: TrackState[];
  onVolumeChange: (trackId: string, volume: number) => void;
  onPanChange: (trackId: string, pan: number) => void;
  onMuteToggle: (trackId: string, muted: boolean) => void;
  onSoloToggle: (trackId: string, soloed: boolean) => void;
  onTrackDelete: (trackId: string) => void;
  onTrackNameChange?: (trackId: string, name: string) => void;
}

const TrackControlsSidebar: React.FC<TrackControlsSidebarProps> = ({
  tracks,
  onVolumeChange,
  onPanChange,
  onMuteToggle,
  onSoloToggle,
  onTrackDelete
}) => {
  if (tracks.length === 0) {
    return (
      <Box sx={{ 
        p: 2, 
        textAlign: 'center', 
        color: 'rgba(255, 255, 255, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%'
      }}>
        <Typography variant="body2">
          No tracks yet
        </Typography>
        <Typography variant="caption" sx={{ mt: 1 }}>
          Add tracks using the button above
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      width: '100%',
      height: '100%',
      overflow: 'auto'
    }}>
      {tracks.map((track, index) => (
        <TrackControls 
          key={track.id}
          track={track}
          index={index}
          onVolumeChange={onVolumeChange}
          onPanChange={onPanChange}
          onMuteToggle={onMuteToggle}
          onSoloToggle={onSoloToggle}
          onTrackDelete={onTrackDelete}
        />
      ))}
    </Box>
  );
};

interface TrackControlsProps {
  track: TrackState;
  index: number;
  onVolumeChange: (trackId: string, volume: number) => void;
  onPanChange: (trackId: string, pan: number) => void;
  onMuteToggle: (trackId: string, muted: boolean) => void;
  onSoloToggle: (trackId: string, soloed: boolean) => void;
  onTrackDelete: (trackId: string) => void;
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
          <Box sx={{ mb: 0.5, display: 'flex', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ 
              color: 'rgba(255,255,255,0.6)',
              fontSize: '9px',
              mr: 0.5,
              whiteSpace: 'nowrap'
            }}>
              Inst:
            </Typography>
            <Select
              size="small"
              value="synth"
              fullWidth
              sx={{ 
                fontSize: '10px',
                height: '22px',
                '.MuiSelect-select': { py: 0 },
                bgcolor: 'rgba(0,0,0,0.2)'
              }}
            >
              <MenuItem value="synth" sx={{ fontSize: '10px' }}>Synth</MenuItem>
              <MenuItem value="piano" sx={{ fontSize: '10px' }}>Piano</MenuItem>
              <MenuItem value="bass" sx={{ fontSize: '10px' }}>Bass</MenuItem>
            </Select>
          </Box>
        );
      
      case 'drum':
        return (
          <Box sx={{ mb: 0.5, display: 'flex', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ 
              color: 'rgba(255,255,255,0.6)',
              fontSize: '9px',
              mr: 0.5,
              whiteSpace: 'nowrap'
            }}>
              Kit:
            </Typography>
            <Select
              size="small"
              value="808"
              fullWidth
              sx={{ 
                fontSize: '10px',
                height: '22px',
                '.MuiSelect-select': { py: 0 },
                bgcolor: 'rgba(0,0,0,0.2)'
              }}
            >
              <MenuItem value="808" sx={{ fontSize: '10px' }}>808 Kit</MenuItem>
              <MenuItem value="acoustic" sx={{ fontSize: '10px' }}>Acoustic Kit</MenuItem>
              <MenuItem value="electronic" sx={{ fontSize: '10px' }}>Electronic Kit</MenuItem>
            </Select>
          </Box>
        );
        
      case 'audio':
        return (
          <Box sx={{ mb: 0.5, display: 'flex', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ 
              color: 'rgba(255,255,255,0.6)',
              fontSize: '9px',
              mr: 0.5,
              whiteSpace: 'nowrap'
            }}>
              File:
            </Typography>
            <Box sx={{ 
              fontSize: '10px',
              color: 'rgba(255,255,255,0.8)',
              bgcolor: 'rgba(0,0,0,0.2)',
              p: 0.5,
              borderRadius: 1,
              flexGrow: 1,
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
      p: 0.7,
      mb: 0.3,
      height: `${GRID_CONSTANTS.trackHeight}px`,
      boxSizing: 'border-box',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      borderLeft: `3px solid ${trackColor}`,
      bgcolor: 'rgba(30, 30, 30, 0.7)',
      '&:hover': {
        bgcolor: 'rgba(40, 40, 40, 0.9)',
      }
    }}>
      {/* Track Name and Delete Button */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        mb: 0.4
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
                fontSize: '12px',
                py: 0.3,
                px: 0.8
              }
            }}
          />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography 
              variant="subtitle2" 
              sx={{ 
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '12px',
                '&:hover': { textDecoration: 'underline' }
              }}
              onClick={() => setIsEditingName(true)}
            >
              {track.name}
            </Typography>
            
            {/* Track Type Tag */}
            <Box 
              sx={{ 
                bgcolor: track.type === 'audio' ? '#4caf50' : 
                      track.type === 'midi' ? '#2196f3' : 
                      track.type === 'drum' ? '#ff9800' : '#9c27b0', 
                borderRadius: '3px',
                px: 0.5,
                py: 0.1,
                fontSize: '8px',
                fontWeight: 'bold',
                color: 'white',
                ml: 0.8
              }}
            >
              {track.type.toUpperCase()}
            </Box>
          </Box>
        )}
        
        <Tooltip title="Delete track">
          <IconButton 
            size="small" 
            onClick={handleDelete}
            sx={{ 
              color: 'rgba(255, 255, 255, 0.7)',
              padding: '3px',
              '&:hover': { 
                color: '#ff5252',
                bgcolor: 'rgba(255, 82, 82, 0.1)'
              }
            }}
          >
            <DeleteIcon sx={{ fontSize: '16px' }} />
          </IconButton>
        </Tooltip>
      </Box>
      
      {/* Type-specific controls */}
      {renderTypeSpecificControls()}
      
      {/* Controls row - Mute, Solo, Volume, Pan */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        mb: 0.5
      }}>
        {/* Mute button */}
        <Tooltip title={track.muted ? "Unmute" : "Mute"}>
          <IconButton 
            size="small" 
            onClick={handleMuteToggle}
            sx={{ 
              color: track.muted ? 'rgba(255, 82, 82, 0.9)' : 'rgba(255, 255, 255, 0.7)',
              '&:hover': { color: track.muted ? '#ff5252' : 'white' },
              padding: '4px'
            }}
          >
            {track.muted ? <VolumeOffIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        
        {/* Solo Button */}
        <Tooltip title={track.soloed ? "Unsolo" : "Solo"}>
          <Box 
            onClick={handleSoloToggle}
            sx={{ 
              bgcolor: track.soloed ? '#ffc107' : 'rgba(255, 255, 255, 0.1)',
              color: track.soloed ? '#000' : 'rgba(255, 255, 255, 0.7)',
              borderRadius: '3px',
              px: 0.8,
              py: 0.2,
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
        
        {/* Volume Knob */}
        <ControlKnob
          value={localVolume}
          min={0}
          max={100}
          size={32}
          color={track.muted ? 'rgba(255, 255, 255, 0.3)' : trackColor}
          label="Vol"
          onChange={handleVolumeChange}
          onChangeCommitted={handleVolumeChangeCommitted}
          disabled={track.muted}
        />
        
        {/* Pan Knob */}
        <ControlKnob
          value={localPan}
          min={-100}
          max={100}
          size={32}
          color={trackColor}
          label="Pan"
          onChange={handlePanChange}
          onChangeCommitted={handlePanChangeCommitted}
        />
      </Box>
    </Box>
  );
};

export default TrackControlsSidebar;