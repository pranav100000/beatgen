import React, { useState } from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import PianoIcon from '@mui/icons-material/Piano';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import { VirtualInstrumentsModal } from '../modals/VirtualInstrumentsModal';
import { DrumMachineModal } from '../modals/drum-machine/DrumMachineModal';
import { DrumSamplePublicRead } from 'src/platform/types/public_models/drum_samples';
// Import types from store types file
import { TrackType, AddTrackPayload, MidiTrackPayload, DrumTrackPayload } from '../../stores/types';

interface AddTrackMenuProps {
  isOpen: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  // Use imported types
  onAddTrack: (type: TrackType, payload?: AddTrackPayload) => void;
  // Keep onFileUpload for direct audio/sampler uploads for now
  onFileUpload?: (file: File, isSampler?: boolean) => void;
}

export const AddTrackMenu: React.FC<AddTrackMenuProps> = ({ 
  isOpen, 
  anchorEl, 
  onClose, 
  onAddTrack, 
  onFileUpload 
}) => {
  const [isVirtualInstrumentModalOpen, setIsVirtualInstrumentModalOpen] = useState(false);
  const [isDrumMachineModalOpen, setIsDrumMachineModalOpen] = useState(false);
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, isSampler: boolean = false) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      // Decide if we want to consolidate file uploads into onAddTrack or keep separate
      // Keeping separate for now based on original structure
      if (onFileUpload) {
          onFileUpload(file, isSampler);
      } else {
          // Or potentially call onAddTrack here if we refactor later
          // onAddTrack(isSampler ? 'sampler' : 'audio', { file });
      }
      onClose();
      console.log('File uploaded');
    }
  };
  
  return (
    <>
      <Menu
        open={isOpen}
        anchorEl={anchorEl}
        onClose={onClose}
        PaperProps={{
          sx: { bgcolor: '#222', color: 'white', minWidth: 180 }
        }}
      >
        <MenuItem onClick={() => {
          setIsVirtualInstrumentModalOpen(true);
          onClose();
        }}
          sx={{ 
            fontSize: '13px',
            py: 1,
            '&:hover': { 
              bgcolor: 'rgba(33, 150, 243, 0.2)' 
            }
          }}
        >
          <ListItemIcon><PianoIcon sx={{ color: '#2196f3' }} /></ListItemIcon>
          <ListItemText primary="Virtual Instrument" />
        </MenuItem>
        
        <MenuItem onClick={() => { 
          setIsDrumMachineModalOpen(true);
          onClose(); 
        }}
          sx={{ 
            fontSize: '13px',
            py: 1,
            '&:hover': { 
              bgcolor: 'rgba(255, 152, 0, 0.2)' 
            }
          }}
        >
          <ListItemIcon><GraphicEqIcon sx={{ color: '#ff9800' }} /></ListItemIcon>
          <ListItemText primary="Drum Machine" />
        </MenuItem>
        
        <MenuItem
          sx={{ 
            fontSize: '13px',
            py: 1,
            '&:hover': { 
              bgcolor: 'rgba(76, 175, 80, 0.2)' 
            }
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', width: '100%', cursor: 'pointer' }}>
            <ListItemIcon><AudioFileIcon sx={{ color: '#4caf50' }} /></ListItemIcon>
            <ListItemText primary="Import Audio" />
            <input 
              type="file" 
              accept="audio/*" 
              style={{ display: 'none' }} 
              onChange={(e) => handleFileUpload(e, false)}
            />
          </label>
        </MenuItem>
        <MenuItem
          sx={{ 
            fontSize: '13px',
            py: 1,
            '&:hover': { 
              bgcolor: 'rgba(156, 39, 176, 0.2)' 
            }
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', width: '100%', cursor: 'pointer' }}>
            <ListItemIcon><ContentCutIcon sx={{ color: '#9c27b0' }} /></ListItemIcon>
            <ListItemText primary="Sampler" />
            <input 
              type="file" 
              accept="audio/*" 
              style={{ display: 'none' }} 
              onChange={(e) => handleFileUpload(e, true)}
            />
          </label>
        </MenuItem>
      </Menu>

      <VirtualInstrumentsModal
        open={isVirtualInstrumentModalOpen}
        onClose={() => setIsVirtualInstrumentModalOpen(false)}
        onSelect={(instrumentId: string, instrumentName: string, instrumentStorageKey?: string) => {
          const payload: MidiTrackPayload = { instrumentId, instrumentName, instrumentStorageKey };
          onAddTrack('midi', payload);
          setIsVirtualInstrumentModalOpen(false);
        }}
      />
      <DrumMachineModal
        open={isDrumMachineModalOpen}
        onClose={() => setIsDrumMachineModalOpen(false)}
        onConfirmSelection={(selectedSamples: DrumSamplePublicRead[]) => {
          const payload: DrumTrackPayload = { samples: selectedSamples };
          onAddTrack('drum', payload);
          setIsDrumMachineModalOpen(false);
        }}
      />
    </>
  );
};

export default AddTrackMenu;