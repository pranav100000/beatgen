import React, { useRef } from 'react';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';

interface BPMControlProps {
  bpm: number;
  onBpmChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const BPMControl: React.FC<BPMControlProps> = ({ bpm, onBpmChange }) => {
  const theme = useTheme();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      inputRef.current?.blur();
    }
  };

  const handleSelect = () => {
    inputRef.current?.select();
  };

  // Calculate width based on number of digits
  const getInputWidth = (value: number) => {
    const numDigits = value.toString().length;
    return `${numDigits * 10}px`; // Approximately 10px per digit
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Box sx={{ width: '28px', textAlign: 'right' }}>
        <TextField
          value={bpm}
          onChange={onBpmChange}
          onKeyDown={handleKeyDown}
          type="number"
          onFocus={handleSelect}
          onClick={handleSelect}
          inputRef={inputRef}
          inputProps={{
            min: 1,
            max: 999,
            style: {
              padding: '0px 0px',
              width: getInputWidth(bpm),
              color: theme.palette.text.primary,
              backgroundColor: 'transparent',
              border: 'none',
              textAlign: 'center',
              cursor: 'pointer',
              caretColor: 'transparent',
            },
          }}
          sx={{
            '& input::selection': {
              backgroundColor: theme.palette.action.selected,
            },
            '@keyframes gentleFlash': {
              '0%': { backgroundColor: theme.palette.action.focus },
              '50%': { backgroundColor: alpha(theme.palette.action.focus, 0.7) },
              '100%': { backgroundColor: theme.palette.action.focus },
            },
            '& .MuiInput-root': {
              fontSize: '1rem',
              width: 'auto',
            },
            '& .MuiInput-root:before, & .MuiInput-root:after': {
              display: 'none',
            },
            '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
              display: 'none',
            },
            '& input:focus': {
              backgroundColor: theme.palette.action.focus,
              outline: 'none',
              borderRadius: '2px',
              animation: 'gentleFlash 2s ease-in-out infinite',
            },
          }}
          variant="standard"
        />
      </Box>
      <Box sx={{ 
        color: 'text.secondary', 
        ml: 1 
      }}>
        bpm
      </Box>
    </Box>
  );
};

export default BPMControl;