import { Box, Popover, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MicIcon from '@mui/icons-material/Mic';
import PianoIcon from '@mui/icons-material/Piano';
import GridOnIcon from '@mui/icons-material/GridOn';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { SvgIconComponent } from '@mui/icons-material';
import { VirtualInstrumentsModal } from '../modals';
import { useState } from 'react';
import { usePianoRoll } from './piano-roll/PianoRollWindow';

interface TrackType {
  id: string;
  title: string;
  description: string;
  icon: SvgIconComponent;
  color: string;
  isUpload?: boolean;
}

interface TrackOptionProps {
  id: string;
  title: string;
  description: string;
  icon: SvgIconComponent;
  color: string;
  onClick: (trackIdOrFile: string | File) => void;
  isUpload?: boolean;
}

const trackTypes = [
  {
    id: 'upload',
    title: 'Upload Sound',
    description: 'Import your own audio file',
    icon: CloudUploadIcon,
    color: '#34495E',
    isUpload: true
  },
  {
    id: 'voice',
    title: 'Voice/Audio',
    description: 'Record with AutoPitch + Fx',
    icon: MicIcon,
    color: '#E74C3C'
  },
  {
    id: 'virtual',
    title: 'Virtual instruments',
    description: 'Record kits, keys and more',
    icon: PianoIcon,
    color: '#2ECC71'
  },
  {
    id: 'drum',
    title: 'Drum Machine',
    description: 'Create beats in seconds',
    icon: GridOnIcon,
    color: '#F1C40F'
  },
  {
    id: 'sampler',
    title: 'Sampler',
    description: 'Turn any sound into an instrument',
    icon: GraphicEqIcon,
    color: '#9B59B6'
  }
];

const TrackOption: React.FC<TrackOptionProps> = ({ id, title, description, icon: Icon, color, onClick, isUpload }) => {
  const handleClick = (e: React.MouseEvent) => {
    if (isUpload) {
      // Create a hidden file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*';
      input.onchange = (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          onClick(file);
        }
      };
      input.click();
    } else {
      onClick(id);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        p: 2,
        cursor: 'pointer',
        '&:hover': {
          bgcolor: 'rgba(255, 255, 255, 0.05)'
        }
      }}
      onClick={handleClick}
    >
      <Box
        sx={{
          bgcolor: color,
          borderRadius: 1,
          p: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mr: 2,
          width: 48,
          height: 48
        }}
      >
        <Icon sx={{ color: 'white' }} />
      </Box>
      <Box>
        <Typography variant="subtitle1" sx={{ color: 'white' }}>
          {title}
        </Typography>
        <Typography variant="body2" sx={{ color: '#666' }}>
          {description}
        </Typography>
      </Box>
    </Box>
  );
};

interface AddTrackMenuProps {
  open: boolean;
  onClose: () => void;
  onSelectTrack: (trackIdOrFile: string | File) => void;
  anchorEl: HTMLElement | null;
}

function AddTrackMenu({ open, onClose, onSelectTrack, anchorEl }: AddTrackMenuProps) {
  const [isVirtualInstrumentsOpen, setIsVirtualInstrumentsOpen] = useState(false);
  const { openPianoRoll } = usePianoRoll();


  const handleTrackSelect = (trackIdOrFile: string | File) => {
    if (trackIdOrFile === 'virtual') {
      setIsVirtualInstrumentsOpen(true);
    } else {
      onSelectTrack(trackIdOrFile);
      onClose();
    }
  };

  const handleInstrumentSelect = (instrumentId: string) => {
    onClose();
    openPianoRoll();
  };

  return (
    <>
      <Popover
        open={open}
        onClose={onClose}
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        PaperProps={{
          sx: {
            bgcolor: '#1A1A1A',
            borderRadius: 2,
            width: 400,
            mt: 1
          }
        }}
      >
        <Box sx={{ position: 'relative', p: 2, pb: 0 }}>
          <Typography variant="h5" sx={{ color: 'white', mb: 2 }}>
            New Track
          </Typography>
          <IconButton
            onClick={onClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: 'white'
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        <Box sx={{ maxHeight: '70vh', overflow: 'auto' }}>
          {trackTypes.map((track) => (
            <TrackOption
              key={track.id}
              id={track.id}
              title={track.title}
              description={track.description}
              icon={track.icon}
              color={track.color}
              isUpload={track.isUpload}
              onClick={handleTrackSelect}
            />
          ))}
        </Box>
      </Popover>

      <VirtualInstrumentsModal
        open={isVirtualInstrumentsOpen}
        onClose={() => setIsVirtualInstrumentsOpen(false)}
        onSelect={handleInstrumentSelect}
      />
    </>
  );
}

export default AddTrackMenu; 