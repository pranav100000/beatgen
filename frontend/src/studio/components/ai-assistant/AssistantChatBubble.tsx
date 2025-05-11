import React, { useEffect } from 'react';
import { Box, Typography, useTheme } from '@mui/material'; // Keep using useTheme from MUI
import AssistantActionChip from './AssistantActionChip';
import ReactMarkdown from 'react-markdown';
// Remove the incorrect import
// import { useAppTheme } from '../../../platform/theme/ThemeContext';

// ... (keep keyframes)
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
  const theme = useTheme(); // Get the MUI theme object

  // Determine colors based on theme.palette.mode
  const bubbleBgColor = theme.palette.mode === 'light'
    ? '#e5e5ea' // iMessage light grey for light mode
    : theme.palette.grey[800]; // Darker grey for dark mode

  const bubbleTextColor = theme.palette.getContrastText(bubbleBgColor);

  const codeBgColor = theme.palette.mode === 'light'
    ? 'rgba(0, 0, 0, 0.08)'
    : 'rgba(255, 255, 255, 0.1)';

  const blockquoteBorderColor = theme.palette.mode === 'light'
    ? 'rgba(0, 0, 0, 0.2)'
    : 'rgba(255, 255, 255, 0.2)';

  const blockquoteTextColor = theme.palette.mode === 'light'
    ? 'rgba(0, 0, 0, 0.6)'
    : 'rgba(255, 255, 255, 0.7)';

  // ... (rest of the component remains the same, using the theme object correctly)
  // For action-only messages, we need a different style
  const isActionOnly = action && onActionClick && !text;
  
  // Add keyframes to the DOM when component mounts
  useEffect(() => {
    if (isStreaming) {
      const styleElement = document.createElement('style');
      styleElement.appendChild(document.createTextNode(cursorBlinkKeyframes));
      document.head.appendChild(styleElement);
      
      return () => {
        // Check if the element is still in the head before removing
        if (styleElement.parentNode === document.head) {
           document.head.removeChild(styleElement);
        }
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
        p: 1.5, // Slightly more padding like iMessage
        borderRadius: '16px', // More rounded corners like iMessage
        bgcolor: bubbleBgColor, // Use theme-aware background color
        color: bubbleTextColor, // Use theme-aware text color
        boxShadow: theme.shadows[1],
        wordBreak: 'break-word',
        position: 'relative', // For positioning the cursor
        '& code': {
          backgroundColor: codeBgColor, // Theme-aware code background
          padding: '2px 4px',
          borderRadius: '4px',
          fontFamily: 'monospace',
          fontSize: '0.9em',
          color: bubbleTextColor, // Ensure code text matches bubble text color
        },
        '& pre': {
          backgroundColor: codeBgColor, // Theme-aware pre background
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
          borderLeft: `3px solid ${blockquoteBorderColor}`, // Theme-aware border
          margin: '8px 0',
          paddingLeft: '12px',
          color: blockquoteTextColor, // Theme-aware text color
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
              fontSize: '1em', // Match text size
              lineHeight: 'inherit', // Match line height
              color: bubbleTextColor, // Match text color
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