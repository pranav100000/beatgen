import React, { useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import AssistantActionChip from './AssistantActionChip';
import ReactMarkdown from 'react-markdown';

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
  //console.log('🎯 RENDERING CHAT BUBBLE:', { text, action, isStreaming });
  
  // Add keyframes to the DOM when component mounts
  useEffect(() => {
    if (isStreaming) {
      const styleElement = document.createElement('style');
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
        position: 'relative', // For positioning the cursor
        '& code': {
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          padding: '2px 4px',
          borderRadius: '4px',
          fontFamily: 'monospace',
          fontSize: '0.9em',
        },
        '& pre': {
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          padding: '8px',
          borderRadius: '4px',
          overflow: 'auto',
          '& code': {
            backgroundColor: 'transparent',
            padding: 0,
          }
        },
        '& p': {
          margin: '8px 0',
          '&:first-of-type': {
            marginTop: 0,
          },
          '&:last-child': {
            marginBottom: 0,
          }
        },
        '& ul, & ol': {
          marginTop: '8px',
          marginBottom: '8px',
          paddingLeft: '20px',
        },
        '& blockquote': {
          borderLeft: '3px solid rgba(255, 255, 255, 0.2)',
          margin: '8px 0',
          paddingLeft: '12px',
          color: 'rgba(255, 255, 255, 0.7)',
        }
      }}
    >
      <Typography 
        variant="body2" 
        component="div"
        sx={{
          '& > *:first-child': { mt: 0 },
          '& > *:last-child': { mb: 0 }
        }}
      >
        <ReactMarkdown>{text}</ReactMarkdown>
        {isStreaming && (
          <Box 
            component="span" 
            sx={{ 
              display: 'inline-block',
              marginLeft: '2px',
              animation: 'cursor-blink 1s step-end infinite',
              fontWeight: 'bold',
              fontSize: '20px',
              color: '#FFFFFF',
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