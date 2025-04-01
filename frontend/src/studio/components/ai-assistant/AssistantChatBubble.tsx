import React from 'react';
import { Box, Typography } from '@mui/material';
import AssistantActionChip from './AssistantActionChip';

interface AssistantChatBubbleProps {
  text: string;
  action?: string;
  onActionClick?: () => void;
}

const AssistantChatBubble: React.FC<AssistantChatBubbleProps> = ({ text, action, onActionClick }) => {
  // For action-only messages, we need a different style
  const isActionOnly = action && onActionClick && !text;
  
  if (isActionOnly) {
    return (
      <Box
        sx={{
          alignSelf: 'flex-start',
          maxWidth: '85%',
          p: 0.5,
          borderRadius: 2,
        }}
      >
        <AssistantActionChip 
          action={action} 
          onClick={onActionClick}
        />
      </Box>
    );
  }
  
  return (
    <Box
      sx={{
        alignSelf: 'flex-start',
        maxWidth: '85%',
        p: 1,
        borderRadius: 2,
        bgcolor: 'rgba(60, 60, 60, 0.8)',
        boxShadow: 1,
        wordBreak: 'break-word'
      }}
    >
      <Typography variant="body2">
        {text}
      </Typography>
      {action && onActionClick && (
        <Box sx={{mt: 0.5}}>
          <AssistantActionChip 
            action={action} 
            onClick={onActionClick}
          />
        </Box>
      )}
    </Box>
  );
};

export default AssistantChatBubble; 