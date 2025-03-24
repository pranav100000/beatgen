import React, { useState } from 'react';
import { Box, Button, Popover, ToggleButton, ToggleButtonGroup } from '@mui/material';

interface KeySelectorProps {
  selectedKey: string;
  onKeyChange: (newKey: string) => void;
}

const DIATONIC_KEY_LIST = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const ACCIDENTAL_KEY_LIST = ['C♯/D♭', 'D♯/E♭', 'F♯/G♭', 'G♯/A♭', 'A♯/B♭'];

const KeySelector: React.FC<KeySelectorProps> = ({ selectedKey = 'C major', onKeyChange }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [mode, setMode] = useState<'major' | 'minor'>(
    selectedKey.toLowerCase().includes('minor') ? 'minor' : 'major'
  );

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleKeySelect = (key: string) => {
    onKeyChange(`${key} ${mode}`);
    handleClose();
  };

  const handleModeChange = (event: React.MouseEvent<HTMLElement>, newMode: 'major' | 'minor') => {
    if (newMode !== null) {
      setMode(newMode);
      // Update current key if needed
      if (selectedKey.includes('minor') && newMode === 'major') {
        onKeyChange(selectedKey.replace('minor', 'major'));
      } else if (selectedKey.includes('major') && newMode === 'minor') {
        onKeyChange(selectedKey.replace('major', 'minor'));
      }
    }
  };

  const open = Boolean(anchorEl);

  return (
    <Box sx={{ width: '130px' }}>
      <Button
        onClick={handleClick}
        sx={{
          bgcolor: '#1E1E1E',
          color: 'white',
          width: '100%',
          px: 2,
          py: 0.5,
          borderRadius: 1,
          textTransform: 'none',
          '&:hover': {
            bgcolor: '#2E2E2E'
          }
        }}
      >
        {selectedKey}
      </Button>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        PaperProps={{
          sx: {
            bgcolor: '#1A1A1A',
            color: 'white',
            mt: 1,
            width: 'auto',
            p: 1
          }
        }}
      >
        <Box sx={{ mb: 1 }}>
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={handleModeChange}
            sx={{
              bgcolor: '#111',
              '.MuiToggleButton-root': {
                color: '#666',
                textTransform: 'none',
                '&.Mui-selected': {
                  color: 'white',
                  bgcolor: '#333',
                  '&:hover': {
                    bgcolor: '#444'
                  }
                },
                '&:hover': {
                  bgcolor: '#222'
                }
              }
            }}
          >
            <ToggleButton value="major" sx={{ px: 2 }}>Major</ToggleButton>
            <ToggleButton value="minor" sx={{ px: 2 }}>Minor</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))',
            gap: 0.5,
          }}
        >
          {/* Diatonic Keys */}
          {DIATONIC_KEY_LIST.map((key) => (
            <Button
              key={key}
              onClick={() => handleKeySelect(key)}
              variant={selectedKey === `${key} ${mode}` ? 'contained' : 'text'}
              sx={{
                minWidth: 0,
                p: 1,
                textTransform: 'none',
                bgcolor: selectedKey === `${key} ${mode}` ? '#333' : 'transparent',
                color: selectedKey === `${key} ${mode}` ? 'white' : '#666',
                '&:hover': {
                  bgcolor: selectedKey === `${key} ${mode}` ? '#444' : '#222'
                }
              }}
            >
              {key}
            </Button>
          ))}
          {/* Accidental Keys */}
          {ACCIDENTAL_KEY_LIST.map((key) => (
            <Button
              key={key}
              onClick={() => handleKeySelect(key)}
              variant={selectedKey === `${key} ${mode}` ? 'contained' : 'text'}
              sx={{
                minWidth: 0,
                p: 1,
                textTransform: 'none',
                bgcolor: selectedKey === `${key} ${mode}` ? '#333' : 'transparent',
                color: selectedKey === `${key} ${mode}` ? 'white' : '#666',
                '&:hover': {
                  bgcolor: selectedKey === `${key} ${mode}` ? '#444' : '#222'
                }
              }}
            >
              {key}
            </Button>
          ))}
        </Box>
      </Popover>
    </Box>
  );
};

export default KeySelector; 