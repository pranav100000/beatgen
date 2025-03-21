import React, { useState, useRef, useEffect } from 'react';
import { Box, IconButton, Slide, TextField, Avatar } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';

interface ChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    // TODO: Add AI response logic here
    // For now, let's add a mock response
    setTimeout(() => {
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: "I'm an AI assistant. I can help you with your music production.",
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
    }, 1000);
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Slide
      direction="left"
      in={isOpen}
      mountOnEnter
      unmountOnExit
    >
      <Box
        sx={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '320px',
          backgroundColor: '#1A1A1A',
          borderLeft: '1px solid #333',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1200,
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid #333',
            backgroundColor: '#242424',
            height: '24px',
          }}
        >
          <Box sx={{ color: 'white', fontWeight: 500 }}>Chat</Box>
          <IconButton
            size="small"
            onClick={onClose}
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Messages Area */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            padding: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {messages.map((message) => (
            <Box
              key={message.id}
              sx={{
                display: 'flex',
                flexDirection: message.sender === 'user' ? 'row-reverse' : 'row',
                gap: 1,
                alignItems: 'flex-start',
              }}
            >
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: message.sender === 'user' ? '#2196f3' : '#1db954',
                }}
              >
                {message.sender === 'user' ? 'U' : 'AI'}
              </Avatar>
              <Box
                sx={{
                  backgroundColor: message.sender === 'user' ? '#2196f3' : '#333',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  maxWidth: '70%',
                  color: 'white',
                  fontSize: '0.9rem',
                }}
              >
                {message.text}
              </Box>
            </Box>
          ))}
          <div ref={messagesEndRef} />
        </Box>

        {/* Input Area */}
        <Box
          sx={{
            padding: 2,
            borderTop: '1px solid #333',
            backgroundColor: '#242424',
          }}
        >
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              variant="outlined"
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: 'white',
                  backgroundColor: '#1A1A1A',
                  borderRadius: '24px',
                  '& fieldset': {
                    borderColor: '#333',
                    borderRadius: '24px',
                  },
                  '&:hover fieldset': {
                    borderColor: '#444',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#2196f3',
                  },
                  '& .MuiOutlinedInput-input::placeholder': {
                    color: '#666',
                    opacity: 1,
                  },
                },
              }}
            />
            <IconButton 
              onClick={handleSendMessage}
              disabled={!inputValue.trim()}
              sx={{ 
                color: 'white',
                backgroundColor: '#2196f3',
                '&:hover': {
                  backgroundColor: '#1976d2',
                },
                '&.Mui-disabled': {
                  backgroundColor: '#333',
                  color: '#666',
                },
              }}
            >
              <SendIcon />
            </IconButton>
          </Box>
        </Box>
      </Box>
    </Slide>
  );
};

export default ChatWindow; 