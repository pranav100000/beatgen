import React from 'react';
import { Box, Typography } from '@mui/material';
import MenuChip from './MenuChip';
import AddContextChip from './AddContextChip';

interface UserChatBubbleProps {
  text: string;
  mode?: string;
  selectedTrack?: {
    id: string;
    name: string;
  } | null;
}

const UserChatBubble: React.FC<UserChatBubbleProps> = ({ text, mode, selectedTrack }) => {
  return (
    <Box
      sx={{
        alignSelf: 'flex-end',
        maxWidth: '85%',
        p: 1,
        borderRadius: '16px',
        bgcolor: 'rgba(44, 151, 251, 0.8)',
        boxShadow: 1,
        wordBreak: 'break-word'
      }}
    >
        <Typography variant="body2">
        {text}
      </Typography>
      {/* Chips container */}
      {(mode || selectedTrack) && (
        <Box sx={{ 
            mt: 0.5,
          display: 'flex', 
          gap: 1,
          justifyContent: 'flex-end'  // Add this to align chips to the right
        }}>
          {mode && (
            <MenuChip 
              label={mode}
              onClick={() => {}}  // Empty function since it's disabled
              disabled={true}
              filled={true}
            />
          )}
          {selectedTrack && (
            <MenuChip 
              label={selectedTrack.name}
              onClick={() => {}}  // Empty function since it's disabled
              disabled={true}
              filled={true}
            />
          )}
        </Box>
      )}
    </Box>
  );
};

export default UserChatBubble; 