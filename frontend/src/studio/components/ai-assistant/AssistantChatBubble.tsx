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
  // These are no longer bubble-specific, adjust for panel style
  const codeBgColor = theme.palette.mode === 'light'
    ? 'rgba(0, 0, 0, 0.05)' // Lighter code background for panel
    : 'rgba(255, 255, 255, 0.08)'; // Slightly adjusted dark mode code bg

  const blockquoteBorderColor = theme.palette.mode === 'light'
    ? theme.palette.grey[300]
    : theme.palette.grey[700];

  const blockquoteTextColor = theme.palette.mode === 'light'
    ? theme.palette.grey[700]
    : theme.palette.grey[400];
  
  const textColor = theme.palette.text.primary; // General text color

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
          // alignSelf: 'flex-start', // Removed for panel style
          maxWidth: '100%', // Allow full width within the panel
          p: 0.5, // Keep padding for action chip
          // borderRadius: 2, // Removed
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
        // alignSelf: 'flex-start', // Removed for panel style
        maxWidth: '100%', // Allow full width within the panel
        p: theme.spacing(1, 0), // Padding top/bottom, no side padding
        // borderRadius: '16px', // Removed
        // bgcolor: bubbleBgColor, // Removed
        color: textColor, // Use general text color
        // boxShadow: theme.shadows[1], // Removed
        wordBreak: 'break-word',
        position: 'relative', // For positioning the cursor
        '& code': {
          backgroundColor: codeBgColor, // Theme-aware code background
          padding: '2px 4px',
          borderRadius: '4px',
          fontFamily: 'monospace',
          fontSize: '0.9em',
          color: textColor, // Ensure code text matches bubble text color
        },
        '& pre': {
          backgroundColor: codeBgColor, // Theme-aware pre background
          padding: '8px',
          borderRadius: '4px',
          overflow: 'auto',
          '& code': {
            backgroundColor: 'transparent', // Code within pre has no extra bg
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
              color: textColor, // Match text color
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