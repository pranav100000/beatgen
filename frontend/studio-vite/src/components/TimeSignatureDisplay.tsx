import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';

interface TimeSignatureMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  selectedValue: number;
  options: number[];
  onSelect: (value: number) => void;
  showArrow?: boolean;
}

const TimeSignatureMenu: React.FC<TimeSignatureMenuProps> = ({
  anchorEl,
  open,
  onClose,
  selectedValue,
  options,
  onSelect,
}) => (
  <Menu
    anchorEl={anchorEl}
    open={open}
    onClose={onClose}
    anchorOrigin={{
      vertical: 'bottom',
      horizontal: 'center',
    }}
    transformOrigin={{
      vertical: -12,
      horizontal: 'center',
    }}
    slotProps={{
      paper: {
        elevation: 4,
        sx: {
          overflow: 'visible',
          filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
          bgcolor: '#1A1A1A',
          color: 'white',
          '&::before': {
            content: '""',
            display: 'block',
            position: 'absolute',
            top: 0,
            right: 14,
            width: 10,
            height: 10,
            bgcolor: '#1A1A1A',
            transform: 'translateY(-50%) rotate(45deg)',
            zIndex: 0,
          },
        }
      }
    }}
  >
    {options.map((num) => (
      <MenuItem
        key={num}
        onClick={() => onSelect(num)}
        selected={num === selectedValue}
        sx={{
          borderRadius: 1,
          mx: 0.5,
          mb: 0.5,

          '&:hover': {
            bgcolor: 'rgba(255, 255, 255, 0.1)',
          },
          '&.Mui-selected': {
            bgcolor: 'rgba(255, 255, 255, 0.2)',
          },
        }}
      >
        {num}
      </MenuItem>
    ))}
  </Menu>
);

interface TimeSignatureNumberProps {
  value: number;
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
}

const TimeSignatureNumber: React.FC<TimeSignatureNumberProps> = ({
  value,
  onClick,
}) => (
  <Box
    component="span"
    onClick={onClick}
    sx={{
      cursor: 'pointer',
      width: '16px',
      display: 'inline-block',
      textAlign: 'center',
      '&:hover': {
        color: '#888',
      },
      transition: 'color 0.2s',
    }}
  >
    {value}
  </Box>
);

interface TimeSignatureDisplayProps {
  topNumber: number;
  bottomNumber: number;
  onTopNumberChange?: (value: number) => void;
  onBottomNumberChange?: (value: number) => void;
}

export const TimeSignatureDisplay: React.FC<TimeSignatureDisplayProps> = ({
  topNumber,
  bottomNumber,
  onTopNumberChange,
  onBottomNumberChange,
}) => {
  const [topAnchorEl, setTopAnchorEl] = useState<null | HTMLElement>(null);
  const [bottomAnchorEl, setBottomAnchorEl] = useState<null | HTMLElement>(null);

  const handleTopClick = (event: React.MouseEvent<HTMLElement>) => {
    setTopAnchorEl(event.currentTarget);
  };

  const handleBottomClick = (event: React.MouseEvent<HTMLElement>) => {
    setBottomAnchorEl(event.currentTarget);
  };

  const handleTopClose = () => {
    setTopAnchorEl(null);
  };

  const handleBottomClose = () => {
    setBottomAnchorEl(null);
  };

  const handleTopSelect = (value: number) => {
    if (onTopNumberChange) {
      onTopNumberChange(value);
    }
    handleTopClose();
  };

  const handleBottomSelect = (value: number) => {
    if (onBottomNumberChange) {
      onBottomNumberChange(value);
    }
    handleBottomClose();
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        bgcolor: '#1E1E1E',
        borderRadius: 1,
        px: 2,
        py: 0.5,
        height: '24px',
      }}
    >
      <TimeSignatureNumber value={topNumber} onClick={handleTopClick} />
      <Box component="span" sx={{ mx: 1 }}>/</Box>
      <TimeSignatureNumber value={bottomNumber} onClick={handleBottomClick} />

      <TimeSignatureMenu
        anchorEl={topAnchorEl}
        open={Boolean(topAnchorEl)}
        onClose={handleTopClose}
        selectedValue={topNumber}
        options={[1, 2, 3, 4, 5, 6]}
        onSelect={handleTopSelect}
      />

      <TimeSignatureMenu
        anchorEl={bottomAnchorEl}
        open={Boolean(bottomAnchorEl)}
        onClose={handleBottomClose}
        selectedValue={bottomNumber}
        options={[1, 2, 4, 8]}
        onSelect={handleBottomSelect}
      />
    </Box>
  );
};

export default TimeSignatureDisplay;