import React, { useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import AssistantActionChip from './AssistantActionChip';

// Add keyframes for cursor blink animation
const cursorBlinkKeyframes = `
@keyframes cursor-blink {
  from, to { opacity: 1; }
  50% { opacity: 0; }
}
`;

interface AssistantChatBubbleProps {
  text: string;
  action?: string;
  onActionClick?: () => void;
  isStreaming?: boolean; // Flag indicating if this message is being streamed
}

const AssistantChatBubble: React.FC<AssistantChatBubbleProps> = ({ text, action, onActionClick, isStreaming }) => {
  // For action-only messages, we need a different style
  const isActionOnly = action && onActionClick && !text;
  
  // Debug log for rendering
  console.log('🎯 RENDERING CHAT BUBBLE:', { text, action, isStreaming });
  
  // Add keyframes to the DOM when component mounts
  useEffect(() => {
    console.log('💥 STREAMING STATUS CHANGE in AssistantChatBubble:', isStreaming);
    
    if (isStreaming) {
      const styleElement = document.createElement('style');
      styleElement.type = 'text/css';
      styleElement.appendChild(document.createTextNode(cursorBlinkKeyframes));
      document.head.appendChild(styleElement);
      
      return () => {
        document.head.removeChild(styleElement);
      };
    }
  }, [isStreaming]);
  
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
        wordBreak: 'break-word',
        position: 'relative' // For positioning the cursor
      }}
    >
      <Typography variant="body2" component="div">
        {text}
        {isStreaming && (
          <Box 
            component="span" 
            sx={{ 
              display: 'inline-block',
              marginLeft: '2px',
              animation: 'cursor-blink 1s step-end infinite',
              fontWeight: 'bold',
              fontSize: '20px',
              color: '#FFFFFF', // Bright red for high visibility
            }}
          >
            |
          </Box>
        )}
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