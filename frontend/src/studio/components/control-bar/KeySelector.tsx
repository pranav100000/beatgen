import React, { useState } from 'react';
import { Box, Button, Popover, ToggleButton, ToggleButtonGroup, useTheme } from '@mui/material';

interface KeySelectorProps {
  selectedKey: string;
  onKeyChange: (newKey: string) => void;
}

const DIATONIC_KEY_LIST = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const ACCIDENTAL_KEY_LIST = ['C♯/D♭', 'D♯/E♭', 'F♯/G♭', 'G♯/A♭', 'A♯/B♭'];

const KeySelector: React.FC<KeySelectorProps> = ({ selectedKey = 'C major', onKeyChange }) => {
  const theme = useTheme();
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
    <Box sx={{ width: '132px' }}>
      <Button
        onClick={handleClick}
        variant="contained"
        color="inherit"
        disableElevation
        sx={{
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
          color: 'text.primary',
          width: '100%',
          px: 2,
          py: 0.5,
          borderRadius: 1,
          textTransform: 'none',
          '&:hover': {
            bgcolor: theme.palette.action.hover
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
            bgcolor: 'background.paper',
            color: 'text.primary',
            mt: 1,
            width: 'auto',
            p: 1,
            boxShadow: theme.shadows[3]
          }
        }}
      >
        <Box sx={{ mb: 1 }}>
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={handleModeChange}
            size="small"
            sx={{
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
              borderRadius: 1,
              '.MuiToggleButton-root': {
                color: 'text.secondary',
                textTransform: 'none',
                border: 0,
                borderRadius: 'inherit',
                '&.Mui-selected': {
                  color: 'text.primary',
                  bgcolor: theme.palette.action.selected,
                  '&:hover': {
                    bgcolor: theme.palette.action.selected
                  }
                },
                '&:hover': {
                  bgcolor: theme.palette.action.hover
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
          {DIATONIC_KEY_LIST.map((key) => {
            const isSelected = selectedKey === `${key} ${mode}`;
            return (
              <Button
                key={key}
                onClick={() => handleKeySelect(key)}
                size="small"
                sx={{
                  minWidth: 0,
                  p: 1,
                  textTransform: 'none',
                  borderRadius: 1,
                  bgcolor: isSelected ? theme.palette.action.selected : 'transparent',
                  color: isSelected ? theme.palette.text.primary : theme.palette.text.secondary,
                  '&:hover': {
                    bgcolor: isSelected ? theme.palette.action.selected : theme.palette.action.hover
                  }
                }}
              >
                {key}
              </Button>
            );
          })}
          {/* Accidental Keys */}
          {ACCIDENTAL_KEY_LIST.map((key) => {
             const isSelected = selectedKey === `${key} ${mode}`;
             return (
              <Button
                key={key}
                onClick={() => handleKeySelect(key)}
                size="small"
                sx={{
                  minWidth: 0,
                  p: 1,
                  textTransform: 'none',
                  borderRadius: 1,
                  bgcolor: isSelected ? theme.palette.action.selected : 'transparent',
                  color: isSelected ? theme.palette.text.primary : theme.palette.text.secondary,
                  '&:hover': {
                    bgcolor: isSelected ? theme.palette.action.selected : theme.palette.action.hover
                  }
                }}
              >
                {key}
              </Button>
             );
          })}
        </Box>
      </Popover>
    </Box>
  );
};

export default KeySelector;