import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Slider, 
  IconButton, 
  Tooltip, 
  TextField,
  Select, 
  MenuItem,
  ButtonBase,
  useTheme
} from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import { IconTrash } from '@tabler/icons-react';
import { IconBackspace } from '@tabler/icons-react';
import { IconBackspaceFilled } from '@tabler/icons-react';
import PanToolIcon from '@mui/icons-material/PanTool';
import { CombinedTrack, AudioTrackRead, SamplerTrackRead } from '../../../platform/types/project';
import { getTrackColor, GRID_CONSTANTS } from '../../constants/gridConstants';
import ControlKnob from './track-sidebar-controls/ControlKnob';
import { alpha } from '@mui/material/styles';

// Interface for the component props
interface TrackControlsSidebarProps {
  tracks: CombinedTrack[];
  onVolumeChange: (trackId: string, volume: number) => void;
  onPanChange: (trackId: string, pan: number) => void;
  onMuteToggle: (trackId: string, muted: boolean) => void;
  onSoloToggle: (trackId: string, soloed: boolean) => void;
  onTrackDelete: (trackId: string) => void;
  onTrackNameChange?: (trackId: string, name: string) => void;
  onInstrumentChange?: (trackId: string, instrumentId: string, instrumentName: string, instrumentStorageKey?: string) => void;
  onLoadAudioFile?: (trackId: string) => void;
}

const TrackControlsSidebar: React.FC<TrackControlsSidebarProps> = ({
  tracks,
  onVolumeChange,
  onPanChange,
  onMuteToggle,
  onSoloToggle,
  onTrackDelete,
  onTrackNameChange,
  onInstrumentChange,
  onLoadAudioFile
}) => {
  const theme = useTheme();

  if (tracks.length === 0) {
    return (
      <Box sx={{ 
        p: 2, 
        textAlign: 'center', 
        color: 'text.disabled',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%'
      }}>
        <Typography variant="body2" color="inherit">
          No tracks yet
        </Typography>
        <Typography variant="caption" sx={{ mt: 1 }} color="inherit">
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
          onTrackNameChange={onTrackNameChange}
          onInstrumentChange={onInstrumentChange}
          onLoadAudioFile={onLoadAudioFile}
        />
      ))}
    </Box>
  );
};

interface TrackControlsProps {
  track: CombinedTrack;
  index: number;
  onVolumeChange: (trackId: string, volume: number) => void;
  onPanChange: (trackId: string, pan: number) => void;
  onMuteToggle: (trackId: string, muted: boolean) => void;
  onSoloToggle: (trackId: string, soloed: boolean) => void;
  onTrackDelete: (trackId: string) => void;
  onTrackNameChange?: (trackId: string, name: string) => void;
  onInstrumentChange?: (trackId: string, instrumentId: string, instrumentName: string) => void;
  onLoadAudioFile?: (trackId: string) => void;
}

const TrackControls: React.FC<TrackControlsProps> = ({
  track,
  index,
  onVolumeChange,
  onPanChange,
  onMuteToggle,
  onSoloToggle,
  onTrackDelete,
  onTrackNameChange,
  onInstrumentChange,
  onLoadAudioFile
}) => {
  const theme = useTheme();
  const trackColor = getTrackColor(index);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(track.name);
  const nameInputRef = useRef<HTMLInputElement>(null);
  
  // Local state for slider values during dragging
  const [localVolume, setLocalVolume] = useState(track.volume ?? 80);
  const [localPan, setLocalPan] = useState(track.pan ?? 0);
  
  // Update local state if track values change from elsewhere
  useEffect(() => {
    setLocalVolume(track.volume ?? 80);
  }, [track.volume]);
  
  useEffect(() => {
    setLocalPan(track.pan ?? 0);
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
    onMuteToggle(track.id, !(track.mute ?? false));
  };
  
  // Handler for solo toggling
  const handleSoloToggle = () => {
    console.warn('Solo toggle state location unclear on CombinedTrack');
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
  
  const handleLoadFileClick = () => {
    if (onLoadAudioFile) {
        onLoadAudioFile(track.id);
    }
  }
  
  // Render type-specific controls based on track type
  const renderTypeSpecificControls = () => {
    switch(track.type) {
      case 'midi':
        return (
          <Box sx={{ mb: 0.5, display: 'flex', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ 
              color: trackColor,
              fontSize: '9px',
              mr: 0.5,
              whiteSpace: 'nowrap',
              marginTop: '-20px',
            }}>
              Inst:
            </Typography>
            <Box sx={{ 
              fontSize: '10px',
              color: 'text.secondary',
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
              p: 0.5,
              borderRadius: 1,
              flexGrow: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {track.name}
            </Box>
          </Box>
        );
      
      case 'drum':
        return (
          <Box sx={{ mb: 0.5, display: 'flex', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ 
              color: trackColor,
              fontSize: '9px',
              mr: 0.5,
              whiteSpace: 'nowrap',
              marginTop: '-20px',
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
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
                color: 'text.primary'
              }}
            >
              <MenuItem value="808" sx={{ fontSize: '10px' }}>808 Kit</MenuItem>
              <MenuItem value="acoustic" sx={{ fontSize: '10px' }}>Acoustic Kit</MenuItem>
              <MenuItem value="electronic" sx={{ fontSize: '10px' }}>Electronic Kit</MenuItem>
            </Select>
          </Box>
        );
        
      case 'audio':
        // Cast track.track to AudioTrackRead
        const audioTrackData = track.track as AudioTrackRead;
        const audioFileName = audioTrackData.name;
        return (
          <Box sx={{ mb: 0.5, display: 'flex', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ 
              color: trackColor,
              fontSize: '9px',
              mr: 0.5,
              whiteSpace: 'nowrap',
              marginTop: '-20px',
            }}>
              File:
            </Typography>
            <Tooltip title="Click to load audio file">
              <ButtonBase
                onClick={handleLoadFileClick}
                sx={{
                  fontSize: '10px',
                  color: 'text.secondary',
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
                  p: 0.5,
                  borderRadius: 1,
                  flexGrow: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'left',
                  justifyContent: 'flex-start',
                  width: '100%',
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: theme.palette.action.hover,
                  }
                }}
                disabled={!onLoadAudioFile}
              >
                  {audioFileName || track.name}
              </ButtonBase>
            </Tooltip>
          </Box>
        );
        
      case 'sampler':
        // Cast track.track to SamplerTrackRead
        const samplerTrackData = track.track as SamplerTrackRead;
        const samplerFileName = samplerTrackData.audio_file_name;
        return (
          <Box sx={{ mb: 0.5, display: 'flex', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ 
              color: trackColor,
              fontSize: '9px',
              mr: 0.5,
              whiteSpace: 'nowrap',
              marginTop: '-20px',
            }}>
              File:
            </Typography>
            <Tooltip title="Click to load audio file">
              <ButtonBase
                onClick={handleLoadFileClick}
                sx={{
                  fontSize: '10px',
                  color: 'text.secondary',
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
                  p: 0.5,
                  borderRadius: 1,
                  flexGrow: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'left',
                  justifyContent: 'flex-start',
                  width: '100%',
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: theme.palette.action.hover,
                  }
                }}
                disabled={!onLoadAudioFile}
              >
                  {samplerFileName || track.name}
              </ButtonBase>
            </Tooltip>
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
      height: `${GRID_CONSTANTS.trackHeight - 2}px`,
      boxSizing: 'border-box',
      borderBottom: `1px solid ${theme.palette.divider}`,
      borderLeft: `3px solid ${trackColor}`,
      bgcolor: theme.palette.background.paper,
      '&:hover': {
        bgcolor: theme.palette.action.hover,
      }
    }}>
      {/* Track Name and Delete Button */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        mb: 0.4,
        width: '100%'
      }}>
        {/* Track name and type-specific controls */}
        <Box sx={{ flexGrow: 1, mr: 1, maxWidth: 146 }}>
          {renderTypeSpecificControls()}
        </Box>
        
        <Tooltip title="Delete track">
          <IconButton 
            size="small" 
            onClick={handleDelete}
            sx={{ 
              color: trackColor, 
              padding: '3px',
              mt: -0.3,
              mr: 0.9, 
              borderRadius: '8px',
              '&:hover': { 
                bgcolor: theme.palette.action.hover
              }
            }}
            disableRipple 
          >
            <IconBackspace size={18}/>
          </IconButton>
        </Tooltip>
      </Box>
      
      {/* Controls row - Modified for even spacing */}
      <Box sx={{ 
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        alignItems: 'center',
        gap: '8px',
        mb: 0.5
      }}>
        {/* Volume Knob */}
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <ControlKnob
            value={localVolume}
            min={0}
            max={100}
            size={32}
            color={track.mute ? theme.palette.action.disabled : trackColor}
            label="Vol"
            type="volume"
            onChange={handleVolumeChange}
            onChangeCommitted={handleVolumeChangeCommitted}
            disabled={track.mute ?? false}
            valueFormatter={(val) => `${val}%`}
          />
        </Box>
        
        {/* Pan Knob */}
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <ControlKnob
            value={localPan}
            min={-100}
            max={100}
            size={32}
            color={trackColor}
            label="Pan"
            type="pan"
            onChange={handlePanChange}
            onChangeCommitted={handlePanChangeCommitted}
          />
        </Box>

        {/* Mute button */}
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Tooltip title={track.mute ? "Unmute" : "Mute"}>
              <Box 
                onClick={handleMuteToggle}
                sx={{ 
                  bgcolor: track.mute ? theme.palette.warning.light : theme.palette.action.disabledBackground,
                  color: track.mute ? theme.palette.warning.contrastText : trackColor,
                  borderRadius: '3px',
                  px: 1.2,
                  py: 0.4,
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: track.mute ? theme.palette.warning.main : theme.palette.action.hover
                  }
                }}
              >
                M
              </Box>
            </Tooltip>
        </Box>
        
        {/* Solo Button */}
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Tooltip title={track.solo ? "Unsolo" : "Solo"}>
            <Box 
              onClick={handleSoloToggle}
              sx={{ 
                bgcolor: track.solo ? '#ffc107' : 'rgba(255, 255, 255, 0.1)',
                color: track.solo ? '#000' : trackColor,
                borderRadius: '3px',
                px: 1.2,
                py: 0.4,
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: track.solo ? '#e6ac00' : 'rgba(255, 255, 255, 0.15)'
                }
              }}
            >
              S
            </Box>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
};

export default TrackControlsSidebar;