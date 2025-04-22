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
  editTrackStream,
  streamAssistant,
  interactWithAssistant,
  cancelAssistantRequest,
  EditStreamCallbacks,
  StreamCallbacks,
  TrackData
} from '../../../platform/api/assistant';
import { historyManager } from '../../core/state/history/HistoryManager';
import { useStudioStore } from '../../stores/studioStore';
import ChatModeMenu from './ChatModeMenu';
import AddContextMenu from './AddContextMenu';
import MenuChip from './MenuChip';
import AddContextChip from './AddContextChip';
import AssistantChatBubble from './AssistantChatBubble';
import UserChatBubble from './UserChatBubble';
import { GRID_CONSTANTS } from '../../constants/gridConstants';
import { CombinedTrack } from '../../../platform/types/project';
import ReactMarkdown from 'react-markdown'

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
  isStreaming?: boolean; // Flag to indicate this message is currently streaming
  messageId?: string; // Unique identifier for the message
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
  const [selectedTrack, setSelectedTrack] = useState<CombinedTrack | null>(null);
  
  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);
  const [streamConnection, setStreamConnection] = useState<{ close: () => void } | null>(null);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  
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
  
  // Cleanup resources when component unmounts
  useEffect(() => {
    return () => {
      // Close any active connection
      if (streamConnection) {
        streamConnection.close();
      }
      
      // Cancel any active request on the server
      if (currentRequestId) {
        cancelAssistantRequest(currentRequestId).catch(err => {
          console.error('Error cancelling request during cleanup:', err);
        });
      }
    };
  }, [streamConnection, currentRequestId]);
  
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
  
  // Debug log for streaming state changes
  useEffect(() => {
    console.log('🔄 STREAMING STATE CHANGED:', { 
      isStreaming, 
      streamingText, 
      currentMessageId,
      isLoading,
      messagesCount: messages.length,
      lastMessage: messages.length > 0 ? messages[messages.length - 1] : null
    });
  }, [isStreaming, streamingText, currentMessageId, isLoading, messages]);
  
  // Scroll to bottom of messages whenever messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Set up callbacks for streaming
  const setupStreamCallbacks = (): StreamCallbacks => {
    return {
      onConnected: () => {
        console.log('Streaming connection established');
        // Update status but don't add a message yet
        setIsStreaming(true);
        setStreamingText('');
        setCurrentMessageId(null);
      },
      
      onStage: (stage) => {
        console.log('Stream stage update:', stage);
        // Could show stage information in the UI if desired
      },
      
      onStatus: (status) => {
        console.log('Status update:', status);
        // Could display status updates in the UI if desired
      },
      
      onToolCall: (toolCall) => {
        console.log('Tool call:', toolCall);
        // Could display tool calls in the UI if desired
      },
      
      onAction: (action) => {
        console.log('Action received:', action);
        // Process the action right away
        handleAction(action.type, action.data);
        
        // Add action message
        setMessages(prev => [
          ...prev, 
          { 
            text: '', 
            isUser: false,
            action: action.type,
            actionData: action.data
          }
        ]);
      },
      
      // New handlers for streaming text
      onEvent: (eventType, data) => {
        console.log(`⭐⭐⭐ RECEIVED CUSTOM EVENT: ${eventType}`, data);
        
        // Handle response streaming events
        if (eventType === 'response_start') {
          console.log('🔴 STREAMING START - Starting response stream', data);
          
          // Create a message ID for this streaming session
          const messageId = data.message_id;
          setCurrentMessageId(messageId);
          setIsStreaming(true);
          
          // Only add a message if we don't have any assistant messages yet
          setMessages(prev => {
            // Check if we already have any non-user messages at the end
            const lastIndex = prev.length - 1;
            if (lastIndex >= 0 && !prev[lastIndex].isUser) {
              // Just update the existing message to be streaming
              return prev.map((msg, i) => 
                i === lastIndex ? { ...msg, isStreaming: true, messageId } : msg
              );
            }
            
            // Add a new message if needed
            return [
              ...prev,
              { 
                text: '',
                isUser: false,
                isStreaming: true,
                messageId
              }
            ];
          });
        }
        else if (eventType === 'response_chunk') {
          console.log('🟡 STREAMING CHUNK - Received chunk:', { 
            chunk: data.chunk, 
            messageId: data.message_id
          });
          
          // Add the new chunk directly to the last streaming message, with more debugging
          setMessages(prev => {
            // Copy the messages array to avoid mutation
            const updatedMessages = [...prev];
            const lastMessageIndex = updatedMessages.length - 1;
            
            console.log('🟡 Current messages state:', { 
              messagesCount: updatedMessages.length,
              lastMessage: lastMessageIndex >= 0 ? updatedMessages[lastMessageIndex] : null
            });
            
            // Check if the last message is a streaming message
            if (lastMessageIndex >= 0 && updatedMessages[lastMessageIndex].isStreaming) {
              console.log('🟢 Found streaming message at index:', lastMessageIndex);
              
              // Add the chunk to the existing text
              const existingText = updatedMessages[lastMessageIndex].text || '';
              const newText = existingText + data.chunk;
              
              console.log('🟢 Updating text:', { 
                oldText: existingText, 
                chunk: data.chunk, 
                newText 
              });
              
              // Create a new message object to ensure React detects the change
              updatedMessages[lastMessageIndex] = {
                ...updatedMessages[lastMessageIndex],
                text: newText
              };
              
              // Also update streamingText state separately
              setStreamingText(newText);
            } else {
              console.warn('⚠️ No streaming message found to update. Creating one now.');
              
              // If no streaming message exists (which shouldn't happen),
              // create one as a fallback
              updatedMessages.push({
                text: data.chunk,
                isUser: false,
                isStreaming: true,
                messageId: data.message_id
              });
              
              setStreamingText(data.chunk);
              setCurrentMessageId(data.message_id);
              setIsStreaming(true);
            }
            
            return updatedMessages;
          });
        }
        else if (eventType === 'response_end') {
          if (data.message_id === currentMessageId) {
            // Finalize the message
            setIsStreaming(false);
            
            // Update the message to remove the streaming flag
            setMessages(prev => {
              const updatedMessages = [...prev];
              const lastMessageIndex = updatedMessages.length - 1;
              
              if (lastMessageIndex >= 0 && updatedMessages[lastMessageIndex].isStreaming) {
                updatedMessages[lastMessageIndex] = {
                  ...updatedMessages[lastMessageIndex],
                  isStreaming: false
                };
              }
              
              return updatedMessages;
            });
            
            setCurrentMessageId(null);
          }
        }
      },
      
      onComplete: (response) => {
        console.log('Stream complete with response:', response);
        setIsLoading(false);
        
        // Only add the assistant's response if we're not already streaming it
        if (!isStreaming) {
          setMessages(prev => [
            ...prev, 
            { text: response.response, isUser: false }
          ]);
        }
        
        // We'll skip processing actions in onComplete because they should
        // have already been processed by the onAction handler during streaming
        
        // Clean up
        setStreamConnection(null);
      },
      
      onError: (error) => {
        console.error('Stream error:', error);
        setIsLoading(false);
        setIsStreaming(false);
        
        // Add error message
        setMessages(prev => [
          ...prev, 
          { 
            text: `Sorry, I encountered an error: ${error.message || 'Unknown error'}`, 
            isUser: false 
          }
        ]);
        
        // Clean up
        setStreamConnection(null);
      },
      
      onCancelled: () => {
        console.log('Stream cancelled');
        setIsLoading(false);
        setIsStreaming(false);
        
        // Clean up
        setStreamConnection(null);
      }
    };
  };
  
  // Handle sending message to the AI
  const handleSend = async () => {
    setSelectedTrack(null);
    if (!prompt.trim()) return;
    
    // First check if we need to cancel an active stream
    if (streamConnection) {
      streamConnection.close();
      setStreamConnection(null);
      setIsLoading(false);
      setIsStreaming(false);
      
      // Also cancel the request on the server if we have a request ID
      if (currentRequestId) {
        try {
          await cancelAssistantRequest(currentRequestId);
          setCurrentRequestId(null);
        } catch (err) {
          console.error('Error cancelling request:', err);
        }
      }
      return;
    }
    
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
      // Determine the appropriate mode (lowercase for API)
      const apiMode = mode.toLowerCase() as 'generate' | 'edit' | 'chat';
      
      // Get track ID if selected
      const trackId = selectedTrack ? selectedTrack.id : undefined;
      
      // Use the new POST-then-SSE pattern with interactWithAssistant
      const { requestId, close } = await interactWithAssistant(
        {
          prompt,
          mode: apiMode,
          track_id: trackId
        },
        setupStreamCallbacks()
      );
      
      // Store request ID and connection for potential cancellation
      setCurrentRequestId(requestId);
      setStreamConnection({ close });
    } catch (error) {
      console.error('Error handling assistant response:', error);
      setMessages(prev => [...prev, { 
        text: "Sorry, I encountered an error processing your request.", 
        isUser: false 
      }]);
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
      case 'add_track2':
        if (actionData?.type) {
          handleAddTrack(
            actionData.type,
            actionData.instrumentId,
            actionData.instrumentName
          );
        }
        break;
      case 'add_track':
        console.log('🟢 add_track action received:', actionData);
        // New action type for adding an individual generated track with notes
        if (store) {
          try {
            const trackId = actionData.trackId || crypto.randomUUID();
            const instrumentId = actionData.instrument_id;  // Fix: map from snake_case to camelCase
            const storageKey = actionData.storageKey;
            const hasNotes = actionData.hasNotes || false;
            
            console.log(`Adding generated track with instrumentId: ${instrumentId}`);
            
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
                console.log(`Adding generated track with instrumentId: ${instrumentId}`);
                const newTrack = await handleAddTrack('midi', instrumentId, undefined, storageKey);
                
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
                        column: note.start * 2,
                        length: note.duration * 2,
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
                const trackToRemove = tracks.find(t => t.id === trackId);
                if (trackToRemove) {
                  console.log(`Removing AI-generated track: ${trackId}`);
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
              wasMuted: track.mute
            }));
            
            // Create an array of actions
            const actions = [];
            
            // First, create mute actions for existing tracks
            for (const track of existingTracks) {
              if (!track.mute) {
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
              const trackName = actionData.instrumentName
                ?.split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
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
            //const compositeAction = new CompositeAction(actions, 'AI Assistant Generate');
            //await historyManager.executeAction(compositeAction);
            
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
                isStreaming={msg.isStreaming}
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
                label={isLoading ? "Cancel" : "Send"}
                onClick={handleSend}
                disabled={!prompt.trim() && !isLoading}
                color={isLoading ? 'secondary' : 'primary'}
              />
            </Box>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default ChatWindow;