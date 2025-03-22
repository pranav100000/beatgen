import { Box, Modal, IconButton, Typography, Grid } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PianoIcon from '@mui/icons-material/Piano';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import { SvgIconComponent } from '@mui/icons-material';

interface Instrument {
  id: string;
  name: string;
  icon: SvgIconComponent;
  color: string;
}

const instruments: Instrument[] = [
  {
    id: 'piano',
    name: 'Grand Piano',
    icon: PianoIcon,
    color: '#2ECC71'
  },
  {
    id: 'synth',
    name: 'Synth Lead',
    icon: MusicNoteIcon,
    color: '#3498DB'
  },
  {
    id: 'strings',
    name: 'Strings',
    icon: MusicNoteIcon,
    color: '#9B59B6'
  },
  {
    id: 'bass',
    name: 'Bass',
    icon: MusicNoteIcon,
    color: '#E67E22'
  },
  {
    id: 'organ',
    name: 'Electric Organ',
    icon: MusicNoteIcon,
    color: '#E74C3C'
  },
  {
    id: 'pad',
    name: 'Ambient Pad',
    icon: MusicNoteIcon,
    color: '#1ABC9C'
  }
];

export interface VirtualInstrumentsModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (instrumentId: string) => void;
}

export const VirtualInstrumentsModal = ({ open, onClose, onSelect }: VirtualInstrumentsModalProps) => {
  const handleSelect = (instrumentId: string) => {
    onSelect(instrumentId);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <Box
        sx={{
          bgcolor: '#1A1A1A',
          color: 'white',
          borderRadius: 2,
          p: 3,
          maxWidth: '900px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">Choose Virtual Instrument</Typography>
          <IconButton
            onClick={onClose}
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
        <Grid container spacing={2}>
          {instruments.map((instrument) => (
            <Grid item xs={12} sm={6} md={4} key={instrument.id}>
              <Box
                onClick={() => handleSelect(instrument.id)}
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 2,
                  p: 2,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                    transform: 'translateY(-2px)'
                  },
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2
                }}
              >
                <Box
                  sx={{
                    bgcolor: instrument.color,
                    borderRadius: 2,
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 64,
                    height: 64
                  }}
                >
                  <instrument.icon sx={{ fontSize: 32, color: 'white' }} />
                </Box>
                <Typography variant="subtitle1" align="center">
                  {instrument.name}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Modal>
  );
}; 