import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  TextField, 
  IconButton, 
  CircularProgress,
  Chip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { 
  generateTracks, 
  editTrack,
  TrackData
} from '../../../platform/api/assistant';
import { CompositeAction } from '../../core/state/history/actions/AssistantActions';
import { historyManager } from '../../core/state/history/HistoryManager';
import { TrackAddAction } from '../../core/state/history/actions/StudioActions';
import { useStudioStore } from '../../stores/useStudioStore';
import ChatModeMenu from './ChatModeMenu';
import AddContextMenu from './AddContextMenu';
import MenuChip from './MenuChip';
import AddContextChip from './AddContextChip';
import AssistantChatBubble from './AssistantChatBubble';
import UserChatBubble from './UserChatBubble';
import { GRID_CONSTANTS } from '../../constants/gridConstants';
import { TrackState } from 'src/studio/core/types/track';

interface Message {
  text: string;
  isUser: boolean;
  mode?: string;
  selectedTrack?: {
    id: string;
    name: string;
  } | null;
  action?: string;
  actionData?: any;
}

interface ChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState('Generate');
  const [modeAnchorEl, setModeAnchorEl] = useState<null | HTMLElement>(null);
  const [contextAnchorEl, setContextAnchorEl] = useState<null | HTMLElement>(null);
  const [cursorPosition, setCursorPosition] = useState<number>(0);
  const [selectedTrack, setSelectedTrack] = useState<TrackState | null>(null);
  
  // Access the store for executing actions
  const { 
    setBpm, 
    handleAddTrack, 
    handleTrackVolumeChange,
    handleTrackMuteToggle,
    setTimeSignature,
    handleTrackPositionChange,
    tracks
  } = useStudioStore();
  
  // Add state to handle visibility after animation
  const [isVisible, setIsVisible] = useState(isOpen);
  
  // Handle visibility changes
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      // Wait for slide animation to complete before hiding
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 225); // Match the transition duration
      return () => clearTimeout(timer);
    }
  }, [isOpen]);
  
  // Initialize with welcome message when first opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        { 
          text: "Hi! I'm your AI assistant. How can I help with your music project today?", 
          isUser: false 
        }
      ]);
    }
  }, [isOpen, messages.length]);
  
  // Scroll to bottom of messages whenever messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Handle sending message to the AI
  const handleSend = async () => {
    setSelectedTrack(null);
    if (!prompt.trim()) return;
    
    // Add user message to chat with current mode and selected track
    const userMessage: Message = { 
      text: prompt, 
      isUser: true,
      mode: mode,  // Add mode to message
      selectedTrack: selectedTrack  // Add selected track to message
    };
    setMessages(prev => [...prev, userMessage]);
    
    // Clear input and set loading state
    setPrompt('');
    setIsLoading(true);
    
    try {
      // Get current project ID if available (placeholder for now)
      
      let result;
      
      // Call different API endpoints based on mode
      if (mode === 'Generate') {
        // Generate mode creates multiple tracks
        result = await generateTracks(prompt);
        
        // Add assistant response to chat
        const responseMessage = {
          text: result.response,
          isUser: false
        };
        
        // Add message first without actions
        setMessages(prev => [...prev, responseMessage]);
        
        // Process each action if present
        if (result.actions && result.actions.length > 0) {
          console.log('Processing actions:', result.actions);
          
          // We'll create action chips for each action
          result.actions.forEach(action => {
            setMessages(prev => [
              ...prev, 
              { 
                text: '', 
                isUser: false,
                action: action.type,
                actionData: action.data
              }
            ]);
          });
        }
        
        // We'll now process the tracks through the action system
        // No need to call addGeneratedTracks directly as it will be
        // handled through the handleAction function with the actions
        if (result.tracks && result.tracks.length > 0) {
          console.log('Generated tracks:', result.tracks);
          // Track data is still in the response, but we'll use actions to add them
        }
      } 
      else if (mode === 'Edit') {
        // Edit mode requires a track ID
        if (selectedTrack) {
          // Edit a specific track
          result = await editTrack(prompt, selectedTrack.id);
          
          // Add assistant response to chat
          const responseMessage = {
            text: result.response,
            isUser: false
          };
          
          // Add message first without actions
          setMessages(prev => [...prev, responseMessage]);
          
          // Process each action if present
          if (result.actions && result.actions.length > 0) {
            console.log('Processing edit actions:', result.actions);
            
            // We'll create action chips for each action
            result.actions.forEach(action => {
              setMessages(prev => [
                ...prev, 
                { 
                  text: '', 
                  isUser: false,
                  action: action.type,
                  actionData: action.data
                }
              ]);
            });
          }
          
          // Process edited track (placeholder)
          if (result.track) {
            console.log('Edited track:', result.track);
            // TODO: Update track in project
          }
        } else {
          // Fallback to chat if no track selected
          result = await editTrack(prompt, "");
          
          // Add assistant response to chat
          const responseMessage = {
            text: result.response,
            isUser: false
          };
          
          // Add message first without actions
          setMessages(prev => [...prev, responseMessage]);
          
          // Process each action if present
          if (result.actions && result.actions.length > 0) {
            console.log('Processing fallback edit actions:', result.actions);
            
            // We'll create action chips for each action
            result.actions.forEach(action => {
              setMessages(prev => [
                ...prev, 
                { 
                  text: '', 
                  isUser: false,
                  action: action.type,
                  actionData: action.data
                }
              ]);
            });
          }
        }
      } 
      // else {
      //   // Default to chat for any other mode
      //   result = await chatWithAssistant(prompt);
        
      //   // Add assistant response to chat
      //   setMessages(prev => [...prev, { 
      //     text: result.response, 
      //     isUser: false,
      //     action: result.actions?.[0]?.type,
      //     actionData: result.actions?.[0]?.data
      //   }]);
      // }
      
      // Process any actions
      if (result.actions && result.actions.length > 0) {
        // Log all actions
        console.log('Processing AI assistant actions:', result.actions);
        
        // Handle each action
        result.actions.forEach(action => {
          console.log(`Executing action: ${action.type}`);
          handleAction(action.type, action.data);
        });
      }
    } catch (error) {
      console.error('Error handling assistant response:', error);
      setMessages(prev => [...prev, { 
        text: "Sorry, I encountered an error processing your request.", 
        isUser: false 
      }]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleAction = async (action: string, actionData: any) => {
    const { store } = useStudioStore.getState();
    
    switch (action) {
      case 'change_bpm':
        if (typeof actionData?.value === 'number') {
          setBpm(actionData.value);
        }
        break;
      case 'add_track':
        if (actionData?.type) {
          handleAddTrack(
            actionData.type,
            actionData.instrumentId,
            actionData.instrumentName
          );
        }
        break;
      case 'add_generated_track':
        // New action type for adding an individual generated track with notes
        if (actionData?.storageKey && store) {
          try {
            const trackId = actionData.trackId;
            const instrumentName = actionData.instrumentName || 'AI Generated Track';
            const storageKey = actionData.storageKey;
            const hasNotes = actionData.hasNotes || false;
            
            console.log(`Adding generated track: ${instrumentName} with storageKey: ${storageKey}`);
            
            // Find the result object that contains the notes
            const generatedTracks = messages
              .filter(msg => !msg.isUser && msg.text)
              .flatMap(msg => {
                try {
                  // Try to extract tracks data from response text
                  const responseObj = JSON.parse(msg.text);
                  return responseObj.tracks || [];
                } catch (e) {
                  return [];
                }
              });
            
            // Find matching track data
            const trackData = generatedTracks.find(t => t.track_id === trackId) || 
                             { notes: [] };
            
            // Create a single action for this track
            const action = {
              execute: async () => {
                // Add track with the soundfont
                console.log(`Adding generated track with storage key: ${storageKey}`);
                const storageKeyParts = storageKey.split('/');
                const instrumentId = storageKeyParts[storageKeyParts.length - 2];
                const newTrack = await handleAddTrack('midi', instrumentId, instrumentName, storageKey);
                
                // Get notes directly from the action data if available
                const notesFromAction = actionData.notes || [];
                if (newTrack && notesFromAction && notesFromAction.length > 0) {
                  console.log(`Adding ${notesFromAction.length} notes directly from action data to track ${newTrack.id}`);
                  
                  // Get the midiManager from the store
                  const { store } = useStudioStore.getState();
                  if (store) {
                    try {
                      // Convert notes format as needed
                      const notes = notesFromAction.map(note => ({
                        id: Math.floor(Math.random() * 100000), // Use random IDs to avoid conflicts
                        row: note.pitch,
                        column: Math.round(note.start),
                        length: Math.round(note.duration),
                        velocity: note.velocity || 80 // Default velocity if missing
                      }));
                      
                      console.log('Converting notes with format:', notes[0]);
                      await store.getMidiManager().updateTrack(newTrack.id, notes);
                      console.log(`Successfully added ${notes.length} notes to track ${newTrack.id}`);
                    } catch (error) {
                      console.error("Failed to add notes to track:", error);
                    }
                  }
                } else if (newTrack && hasNotes && trackData.notes?.length > 0) {
                  // Fallback to trackData if needed
                  console.log(`Fallback: Adding ${trackData.notes.length} notes from track data to track ${newTrack.id}`);
                  
                  // Get the midiManager from the store
                  const { store } = useStudioStore.getState();
                  if (store) {
                    try {
                      // Convert notes format as needed
                      const notes = trackData.notes.map(note => ({
                        id: Math.floor(Math.random() * 100000),
                        row: note.pitch,
                        column: Math.round(note.time * 4),
                        length: Math.round(note.duration * 4),
                        velocity: note.velocity || 80
                      }));
                      
                      await store.getMidiManager().updateTrack(newTrack.id, notes);
                    } catch (error) {
                      console.warn("Failed to add notes to track using fallback method", error);
                    }
                  }
                } else {
                  console.warn(`No notes available for track ${newTrack.id}`);
                }
              },
              undo: async () => {
                // Find track by name
                const tracks = useStudioStore.getState().tracks;
                const trackToRemove = tracks.find(t => t.name === instrumentName);
                if (trackToRemove) {
                  console.log(`Removing AI-generated track: ${instrumentName}`);
                  const { handleTrackDelete } = useStudioStore.getState();
                  await handleTrackDelete(trackToRemove.id);
                }
              },
              type: 'ADD_GENERATED_TRACK'
            };
            
            // Execute the action
            await historyManager.executeAction(action);
            
            // Update history UI state
            useStudioStore.setState({
              canUndo: historyManager.canUndo(),
              canRedo: historyManager.canRedo()
            });
          } catch (error) {
            console.error('Failed to add AI generated track:', error);
          }
        }
        break;
      case 'add_tracks':
        // For generating multiple tracks, we want to use a composite action
        if (typeof actionData?.count === 'number' && store) {
          try {
            console.log(`Adding ${actionData.count} tracks from AI assistant`);
            
            // Store current track states (for undo)
            const existingTracks = useStudioStore.getState().tracks;
            const previousTrackStates = existingTracks.map(track => ({
              trackId: track.id,
              wasMuted: track.muted
            }));
            
            // Create an array of actions
            const actions = [];
            
            // First, create mute actions for existing tracks
            for (const track of existingTracks) {
              if (!track.muted) {
                actions.push({
                  execute: async () => {
                    console.log(`Muting existing track ${track.id}`);
                    store.getAudioEngine().setTrackMute(track.id, true);
                    useStudioStore.setState({
                      tracks: useStudioStore.getState().tracks.map(t => 
                        t.id === track.id ? { ...t, muted: true } : t
                      )
                    });
                  },
                  undo: async () => {
                    console.log(`Unmuting existing track ${track.id}`);
                    store.getAudioEngine().setTrackMute(track.id, false);
                    useStudioStore.setState({
                      tracks: useStudioStore.getState().tracks.map(t => 
                        t.id === track.id ? { ...t, muted: false } : t
                      )
                    });
                  },
                  type: 'MUTE_TRACK'
                });
              }
            }
            
            // Add track creation actions
            for (let i = 0; i < actionData.count; i++) {
              const trackName = `AI Generated Track ${i+1}`;
              actions.push({
                execute: async () => {
                  console.log(`Adding AI track: ${trackName}`);
                  await handleAddTrack('midi', undefined, trackName);
                },
                undo: async () => {
                  const tracks = useStudioStore.getState().tracks;
                  const trackToRemove = tracks.find(t => t.name === trackName);
                  if (trackToRemove) {
                    console.log(`Removing AI track: ${trackName}`);
                    const { handleTrackDelete } = useStudioStore.getState();
                    await handleTrackDelete(trackToRemove.id);
                  }
                },
                type: 'ADD_AI_TRACK'
              });
            }
            
            // Create and execute the composite action
            const compositeAction = new CompositeAction(actions, 'AI Assistant Generate');
            await historyManager.executeAction(compositeAction);
            
            // Update history UI state
            useStudioStore.setState({
              canUndo: historyManager.canUndo(),
              canRedo: historyManager.canRedo()
            });
          } catch (error) {
            console.error('Failed to add AI generated tracks:', error);
          }
        }
        break;
      case 'update_track':
        if (actionData?.trackId) {
          const track = tracks.find(t => t.id === actionData.trackId);
          if (track) {
            console.log(`Updating track ${track.name}`);
            // Using existing track update functionality
            // This will be handled by separate actions in the store
          } else {
            console.log(`Track ${actionData.trackId} not found`);
          }
        }
        break;
      case 'adjust_volume':
        if (actionData?.trackId && typeof actionData?.value === 'number') {
          handleTrackVolumeChange(actionData.trackId, actionData.value);
        }
        break;
      case 'toggle_mute':
        if (actionData?.trackId && typeof actionData?.muted === 'boolean') {
          handleTrackMuteToggle(actionData.trackId, actionData.muted);
        }
        break;
      case 'change_time_signature':
        if (typeof actionData?.numerator === 'number' && typeof actionData?.denominator === 'number') {
          setTimeSignature(actionData.numerator, actionData.denominator);
        }
        break;
      case 'move_track':
        console.log('Moving track:', actionData);
        if (actionData?.trackId && typeof actionData?.position?.x === 'number' && typeof actionData?.position?.y === 'number') {
          handleTrackPositionChange(actionData.trackId, {
            x: actionData.position.x,
            y: actionData.position.y
          }, true);
        }
        break;
      default:
        console.warn(`Unknown AI action type: ${action}`);
    }
  };
  
  // We've replaced the addGeneratedTracks function with the action-based approach
  // that handles one track at a time through handleAction with add_generated_track type
  
  // Update an existing track with AI-edited content
  const updateTrackWithAIEdit = (trackId: string, trackData: any) => {
    // This is a placeholder function that would integrate with your track updating system
    if (trackData.notes) {
      // Find track by ID
      const track = tracks.find(t => t.id === trackId);
      
      if (track) {
        // In a real implementation, you would:
        // 1. Update the track's notes from trackData.notes
        // 2. Update instrument if needed
        // 3. Handle any other track updates
        
        console.log(`Updated track ${track.name} with ${trackData.notes.length} notes`);
      } else {
        console.log(`Track ${trackId} not found`);
      }
    }
  };
  
  // Handle pressing Enter key in the input field
  const handleKeyPress = (e: React.KeyboardEvent) => {
    // Don't send message if context menu is open
    if (contextAnchorEl) return;
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleModeClick = (event: React.MouseEvent<HTMLDivElement>) => {
    setModeAnchorEl(event.currentTarget);
  };

  const handleModeClose = () => {
    setModeAnchorEl(null);
  };

  const handleModeSelect = (newMode: string) => {
    setMode(newMode.charAt(0).toUpperCase() + newMode.slice(1).toLowerCase());
  };

  const handleContextClick = (event: React.MouseEvent<HTMLDivElement>) => {
    setContextAnchorEl(event.currentTarget);
  };

  const handleContextClose = () => {
    setContextAnchorEl(null);
  };

  const handleContextSelect = (trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (track) {
      setSelectedTrack(track);
      
      // Find the position of the @ symbol
      const atSymbolPos = prompt.lastIndexOf('@', cursorPosition);
      if (atSymbolPos !== -1) {
        // Remove just the @ symbol
        const newText = 
          prompt.substring(0, atSymbolPos) + 
          prompt.substring(atSymbolPos + 1);  // Skip the @ character
        
        setPrompt(newText);
      }
    }
    setContextAnchorEl(null);
  };

  const handleRemoveContext = () => {
    setSelectedTrack(null);
  };

  const shouldShowContextMenu = (text: string, position: number): boolean => {
    if (position === 0 || mode != 'Edit') return false;
    return text[position - 1] === '@' && 
           (position === 1 || text[position - 2] === ' ');
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newPosition = e.target.selectionStart;
    
    setPrompt(newValue);
    setCursorPosition(newPosition);

    if (shouldShowContextMenu(newValue, newPosition)) {
      setContextAnchorEl(e.target);
    } else {
      setContextAnchorEl(null);
    }
  };

  // Also track cursor position on selection/click
  const handleSelectionChange = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    setCursorPosition(e.currentTarget.selectionStart);
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        right: 0,
        top: '50px',
        bottom: 0,
        pointerEvents: isVisible ? 'auto' : 'none',
        zIndex: 1200,
      }}
    >
      <Paper
        elevation={4}
        sx={{
          height: '100%',
          width: 350,
          bgcolor: 'rgba(22, 22, 22, 0.95)',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 225ms cubic-bezier(0, 0, 0.2, 1)',
          visibility: isVisible ? 'visible' : 'hidden'
        }}
      >
        {/* Header */}
        <Box sx={{ 
          height: GRID_CONSTANTS.headerHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 0,
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          bgcolor: 'rgba(0, 0, 0, 0.2)'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1 }}>
            <SmartToyIcon sx={{ fontSize: 20 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
              AI Assistant
            </Typography>
          </Box>
          
          <IconButton 
            size="small" 
            onClick={onClose} 
            sx={{ 
              color: 'white',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.1)'
              }
            }}
            aria-label="Close assistant"
          >
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>
        
        {/* Messages */}
        <Box sx={{ 
          flex: 1, 
          overflowY: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5
        }}>
          {messages.map((msg, index) => (
            msg.isUser ? (
              <UserChatBubble 
                key={index} 
                text={msg.text}
                mode={msg.mode}
                selectedTrack={msg.selectedTrack}
              />
            ) : (
              <AssistantChatBubble 
                key={index} 
                text={msg.text}
                action={msg.action}
                onActionClick={msg.action && msg.actionData ? 
                  () => handleAction(msg.action!, msg.actionData) : 
                  undefined}
              />
            )
          ))}
          {isLoading && (
            <Box sx={{ alignSelf: 'flex-start', p: 1 }}>
              <CircularProgress size={24} />
            </Box>
          )}
          <div ref={messagesEndRef} />
        </Box>

        {/* Input Area */}
        <Box sx={{ 
          p: 2, 
          display: 'flex', 
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          bgcolor: 'rgba(0, 0, 0, 0.2)'
        }}>
          <Box sx={{ position: 'relative', width: '100%' }}>
            {/* Chips Box */}
            <Box sx={{
              position: 'absolute',
              top: '4px',
              left: '8px',
              gap: 1,
              zIndex: 1,
              display: 'flex',
              mt: 0.5,
            }}>
              <MenuChip 
                label={mode}
                onClick={handleModeClick}
              />
              {mode === 'Edit' && !selectedTrack && (
                <MenuChip 
                  label="@"
                  onClick={handleContextClick}
                />
              )}
              {selectedTrack && (
                <AddContextChip 
                  trackName={selectedTrack.name}
                  onDelete={handleRemoveContext}
                />
              )}
              <ChatModeMenu
                anchorEl={modeAnchorEl}
                open={Boolean(modeAnchorEl)}
                onClose={handleModeClose}
                onSelect={handleModeSelect}
              />
              <AddContextMenu
                anchorEl={contextAnchorEl}
                open={Boolean(contextAnchorEl)}
                onClose={handleContextClose}
                onSelect={handleContextSelect}
                tracks={tracks}
              />
            </Box>

            {/* TextField */}
            <TextField
              fullWidth
              multiline
              placeholder="Ask me anything about your project..."
              value={prompt}
              onChange={handleTextChange}
              onKeyDown={(e) => {
                if (contextAnchorEl) {
                  return;
                }
                
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={isLoading}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: 'white',
                  bgcolor: 'rgba(30, 30, 30, 0.8)',
                  '& fieldset': {
                    borderColor: 'rgba(255, 255, 255, 0.2)'
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(255, 255, 255, 0.4)'
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'primary.secondary'
                  },
                  '& .MuiOutlinedInput-input': {
                    pt: '20px',
                    pb: '16px',
                    minHeight: '20px'
                  }
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  border: 'none'
                },
                '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  border: '1px solid',
                  borderColor: 'primary.secondary'
                }
              }}
            />

            {/* Bottom Box with Send Button */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                px: 1
              }}
            >
              <MenuChip 
                label="Send"
                onClick={handleSend}
                disabled={isLoading || !prompt.trim()}
                color={'primary'}
              />
            </Box>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default ChatWindow;