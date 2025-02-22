import React from 'react';
import TextField from '@mui/material/TextField';

interface BPMControlProps {
  bpm: number;
  onBpmChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const BPMControl: React.FC<BPMControlProps> = ({ bpm, onBpmChange }) => {
  return (
    <TextField
      value={bpm}
      onChange={onBpmChange}
      type="number"
      onFocus={(e) => e.target.select()}
      inputProps={{
        min: 1,
        max: 999,
        style: {
          padding: '0px',
          width: '28px',
          color: 'white',
          backgroundColor: 'transparent',
          border: 'none',
          textAlign: 'right',
          cursor: 'pointer',
        },
      }}
      sx={{
        '& input::selection': {
          backgroundColor: 'transparent',
        },
        '@keyframes gentleFlash': {
          '0%': { backgroundColor: '#333' },
          '50%': { backgroundColor: '#444' },
          '100%': { backgroundColor: '#333' },
        },
        '& .MuiInput-root': {
          fontSize: '1rem',
        },
        '& .MuiInput-root:before, & .MuiInput-root:after': {
          display: 'none',
        },
        '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
          display: 'none',
        },
        '& input:focus': {
          backgroundColor: '#333',
          outline: 'none',
          borderRadius: '2px',
          animation: 'gentleFlash 2s ease-in-out infinite',
        },
      }}
      variant="standard"
    />
  );
};

export default BPMControl; 