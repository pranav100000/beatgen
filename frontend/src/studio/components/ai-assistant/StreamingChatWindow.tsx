// import React, { useState, useEffect, useRef } from 'react';
// import { editTrackStream, EditStreamCallbacks } from '../../../platform/api/assistant';
// import { useStudioStore } from '../../stores/useStudioStore';
// import { Bars } from 'react-loader-spinner';

// // Check if the Bars component is missing (caused by an error importing react-loader-spinner)
// const LoadingIndicator = typeof Bars !== 'undefined' ? Bars : () => <div>Loading...</div>;

// // Add some inline styles for streaming text
// const styles = {
//   chatWindow: {
//     display: 'flex',
//     flexDirection: 'column' as const,
//     width: '400px',
//     height: '600px',
//     border: '1px solid #333',
//     borderRadius: '8px',
//     overflow: 'hidden',
//     backgroundColor: '#1a1a1a',
//     color: '#fff',
//   },
//   chatHeader: {
//     display: 'flex',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     padding: '10px 15px',
//     borderBottom: '1px solid #333',
//     backgroundColor: '#222',
//   },
//   chatMessages: {
//     flex: 1,
//     overflowY: 'auto' as const,
//     padding: '15px',
//     display: 'flex',
//     flexDirection: 'column' as const,
//     gap: '10px',
//   },
//   message: {
//     padding: '10px 12px',
//     borderRadius: '8px',
//     maxWidth: '80%',
//     wordBreak: 'break-word' as const,
//   },
//   userMessage: {
//     alignSelf: 'flex-end',
//     backgroundColor: '#2563eb',
//   },
//   assistantMessage: {
//     alignSelf: 'flex-start',
//     backgroundColor: '#333',
//   },
//   streamingMessage: {
//     position: 'relative' as const,
//   },
//   cursorBlink: {
//     display: 'inline-block',
//     marginLeft: '2px',
//     fontWeight: 'normal',
//     animation: 'cursor-blink 1s step-end infinite',
//   },
//   chatInput: {
//     display: 'flex',
//     padding: '10px',
//     borderTop: '1px solid #333',
//     backgroundColor: '#222',
//   },
//   input: {
//     flex: 1,
//     padding: '10px',
//     borderRadius: '4px',
//     border: 'none',
//     backgroundColor: '#333',
//     color: '#fff',
//   },
//   button: {
//     padding: '10px 15px',
//     marginLeft: '8px',
//     borderRadius: '4px',
//     border: 'none',
//     backgroundColor: '#2563eb',
//     color: '#fff',
//     cursor: 'pointer',
//   },
//   streamingProgress: {
//     marginBottom: '15px',
//     padding: '10px',
//     backgroundColor: 'rgba(0,0,0,0.2)',
//     borderRadius: '8px',
//   },
//   progressBar: {
//     height: '6px',
//     backgroundColor: 'rgba(255,255,255,0.1)',
//     borderRadius: '3px',
//     marginTop: '8px',
//     marginBottom: '8px',
//     overflow: 'hidden',
//   },
//   progressFill: {
//     height: '100%',
//     backgroundColor: '#2563eb',
//     transition: 'width 0.3s ease',
//   },
//   toolCalls: {
//     marginTop: '10px',
//     padding: '8px',
//     backgroundColor: 'rgba(0,0,0,0.2)',
//     borderRadius: '4px',
//   }
// };

// // Add keyframes for cursor blink animation
// const cursorBlinkKeyframes = `
// @keyframes cursor-blink {
//   from, to { opacity: 1; }
//   50% { opacity: 0; }
// }
// `;

// interface StreamingChatWindowProps {
//   isOpen: boolean;
//   onClose: () => void;
// }

// // Component to display streaming chat progress
// export const StreamingProgress: React.FC<{
//   stage: string;
//   description: string;
//   progress: number;
// }> = ({ stage, description, progress }) => {
//   return (
//     <div style={styles.streamingProgress}>
//       <div style={{ marginBottom: '5px' }}>
//         <h4 style={{ margin: '0 0 5px 0', fontSize: '14px' }}>{stage}</h4>
//         <p style={{ margin: 0, fontSize: '12px', color: '#aaa' }}>{description}</p>
//       </div>
//       <div style={styles.progressBar}>
//         <div 
//           style={{
//             ...styles.progressFill,
//             width: `${progress}%`
//           }}
//         />
//       </div>
//       <div style={{ display: 'flex', justifyContent: 'center', marginTop: '5px' }}>
//         <LoadingIndicator
//           height="24"
//           width="24"
//           color="#6366F1"
//           ariaLabel="loading"
//         />
//       </div>
//     </div>
//   );
// };

// // Message interfaces for better type safety
// interface UserMessage {
//   role: 'user';
//   content: string;
// }

// interface AssistantMessage {
//   role: 'assistant';
//   content: string;
//   isStreaming?: boolean;
//   actions?: any[];
//   error?: boolean;
// }

// type Message = UserMessage | AssistantMessage;

// // The main component
// const StreamingChatWindow: React.FC<StreamingChatWindowProps> = ({ isOpen, onClose }) => {
//   const [inputValue, setInputValue] = useState('');
//   const [messages, setMessages] = useState<Message[]>([]);
//   const [isProcessing, setIsProcessing] = useState(false);
//   const [streamConnection, setStreamConnection] = useState<{ close: () => void } | null>(null);
  
//   // Current streaming state
//   const [currentStage, setCurrentStage] = useState<{name: string, description: string} | null>(null);
//   const [statusMessage, setStatusMessage] = useState('');
//   const [toolCalls, setToolCalls] = useState<any[]>([]);
//   const [actions, setActions] = useState<any[]>([]);
//   const [streamProgress, setStreamProgress] = useState(0);
  
//   // Streaming text state
//   const [isStreaming, setIsStreaming] = useState(false);
//   const [streamingText, setStreamingText] = useState('');
//   const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);

//   // Get studio state
//   const {
//     tracks,
//     renameTrack,
//     changeTrackVolume,
//     toggleTrackMute,
//     changeTrackPan,
//     setTimeSignature,
//     changeTrackPosition,
//     addTrack
//   } = useStudioStore();
  
//   // Reference to message container for auto-scrolling
//   const messagesEndRef = useRef<HTMLDivElement>(null);
  
//   // Add cursor blink animation keyframes when component mounts
//   useEffect(() => {
//     const styleElement = document.createElement('style');
//     styleElement.type = 'text/css';
//     styleElement.appendChild(document.createTextNode(cursorBlinkKeyframes));
//     document.head.appendChild(styleElement);
    
//     return () => {
//       document.head.removeChild(styleElement);
//     };
//   }, []);
  
//   // Auto-scroll to bottom when messages change or streaming text updates
//   useEffect(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   }, [messages, streamingText]);
  
//   // Handle track actions based on streaming events
//   const handleActionEvent = (action: any) => {
//     if (!action || !action.type) return;
    
//     console.log('Handling streaming action:', action);
    
//     // Process the action based on its type
//     switch (action.type) {
//       case 'rename_track':
//         if (action.data?.trackId && action.data?.name) {
//           renameTrack(action.data.trackId, action.data.name);
//         }
//         break;
//       case 'adjust_volume':
//         if (action.data?.trackId && typeof action.data?.value === 'number') {
//           changeTrackVolume(action.data.trackId, action.data.value);
//         }
//         break;
//       case 'adjust_pan':
//         if (action.data?.trackId && typeof action.data?.value === 'number') {
//           changeTrackPan(action.data.trackId, action.data.value);
//         }
//         break;
//       case 'toggle_mute':
//         if (action.data?.trackId && typeof action.data?.muted === 'boolean') {
//           toggleTrackMute(action.data.trackId, action.data.muted);
//         }
//         break;
//       // Add other action types here
//       default:
//         console.warn(`Unknown streaming action type: ${action.type}`);
//     }
//   };
  
//   // Set up callbacks for streaming
//   const setupStreamCallbacks = (): EditStreamCallbacks => {
//     return {
//       onConnected: () => {
//         console.log('Streaming connection established');
//         // Reset state for new stream
//         setToolCalls([]);
//         setActions([]);
//         setCurrentStage(null);
//         setStatusMessage('Connected to AI assistant...');
//         setStreamProgress(5);
//         setIsStreaming(false);
//         setStreamingText('');
//         setCurrentMessageId(null);
//       },
      
//       onStage: (stage) => {
//         console.log('Stream stage update:', stage);
//         setCurrentStage(stage);
        
//         // Update progress based on stage
//         switch (stage.name) {
//           case 'initializing':
//             setStreamProgress(10);
//             break;
//           case 'project_loading':
//             setStreamProgress(20);
//             break;
//           case 'prompt_preparation':
//             setStreamProgress(30);
//             break;
//           case 'api_initialization':
//             setStreamProgress(40);
//             break;
//           case 'ai_processing':
//             setStreamProgress(50);
//             break;
//           case 'completing':
//             setStreamProgress(90);
//             break;
//           default:
//             setStreamProgress(50);
//         }
//       },
      
//       onStatus: (status) => {
//         setStatusMessage(status.message);
//       },
      
//       onToolCall: (toolCall) => {
//         setToolCalls(prev => [...prev, toolCall]);
//         setStreamProgress(Math.min(75, streamProgress + 5));
//       },
      
//       onAction: (action) => {
//         // Add action to list
//         setActions(prev => [...prev, action]);
        
//         // Process the action
//         handleActionEvent(action);
        
//         setStreamProgress(Math.min(85, streamProgress + 5));
//       },
      
//       // New handlers for streaming text
//       onEvent: (eventType, data) => {
//         console.log(`Received custom event: ${eventType}`, data);
        
//         // Handle response streaming events
//         if (eventType === 'response_start') {
//           console.log('Starting response stream', data);
//           console.log('Setting current message ID to:', data.message_id);
//           setIsStreaming(true);
//           setStreamingText('');
//           setCurrentMessageId(data.message_id);
          
//           // Add a placeholder message that will be updated
//           setMessages(prev => {
//             const newMessages = [
//               ...prev,
//               { role: 'assistant', content: '', isStreaming: true }
//             ];
//             console.log('Added streaming placeholder message:', newMessages);
//             return newMessages;
//           });
//         }
//         else if (eventType === 'response_chunk') {
//           console.log('Processing response_chunk event:', data, 'current message ID:', currentMessageId);
//           if (data.message_id === currentMessageId) {
//             console.log('Message IDs match, adding chunk to text:', data.chunk);
//             // Add the new chunk to our streaming text and update the message in one operation
//             setStreamingText(prevText => {
//               const newText = prevText + data.chunk;
//               console.log('Updated streaming text:', newText);
              
//               // Update the current streaming message using the updated text
//               setMessages(prevMessages => {
//                 const updatedMessages = [...prevMessages];
//                 const lastMessageIndex = updatedMessages.length - 1;
                
//                 if (lastMessageIndex >= 0 && (updatedMessages[lastMessageIndex] as AssistantMessage).isStreaming) {
//                   console.log('Updating streaming message at index:', lastMessageIndex);
//                   updatedMessages[lastMessageIndex] = {
//                     ...updatedMessages[lastMessageIndex],
//                     content: newText  // Use newText instead of streamingText + data.chunk
//                   };
//                 } else {
//                   console.warn('No streaming message found to update at index:', lastMessageIndex);
//                 }
                
//                 return updatedMessages;
//               });
              
//               return newText;
//             });
//           } else {
//             console.warn('Message IDs do not match, ignoring chunk');
//           }
//         }
//         else if (eventType === 'response_end') {
//           console.log('Processing response_end event:', data, 'current message ID:', currentMessageId);
//           if (data.message_id === currentMessageId) {
//             console.log('Message IDs match, finalizing message');
//             // Finalize the message
//             setIsStreaming(false);
            
//             // Update the message to remove the streaming flag
//             setMessages(prev => {
//               const updatedMessages = [...prev];
//               const lastMessageIndex = updatedMessages.length - 1;
              
//               if (lastMessageIndex >= 0 && (updatedMessages[lastMessageIndex] as AssistantMessage).isStreaming) {
//                 console.log('Removing streaming flag from message at index:', lastMessageIndex);
//                 updatedMessages[lastMessageIndex] = {
//                   ...updatedMessages[lastMessageIndex],
//                   isStreaming: false
//                 } as AssistantMessage;
//               } else {
//                 console.warn('No streaming message found to finalize at index:', lastMessageIndex);
//               }
              
//               return updatedMessages;
//             });
            
//             console.log('Clearing current message ID');
//             setCurrentMessageId(null);
//           } else {
//             console.warn('Message IDs do not match, ignoring end event');
//           }
//         }
//       },
      
//       onComplete: (response) => {
//         console.log('Stream complete with response:', response);
//         setStreamProgress(100);
//         setIsProcessing(false);
        
//         // Only add the assistant's response if we're not already streaming it
//         if (!isStreaming) {
//           setMessages(prev => [
//             ...prev, 
//             { role: 'assistant', content: response.response, actions: response.actions }
//           ]);
//         }
        
//         // Clear current stage
//         setCurrentStage(null);
//         setStatusMessage('');
//         setIsStreaming(false);
        
//         // Process any remaining actions from the complete response
//         if (response.actions) {
//           response.actions.forEach(action => handleActionEvent(action));
//         }
        
//         // Close the connection
//         setStreamConnection(null);
//       },
      
//       onError: (error) => {
//         console.error('Stream error:', error);
//         setIsProcessing(false);
//         setCurrentStage(null);
//         setStatusMessage(`Error: ${error.message || 'Unknown error'}`);
//         setIsStreaming(false);
        
//         // Add error message
//         setMessages(prev => [
//           ...prev, 
//           { 
//             role: 'assistant', 
//             content: `Sorry, there was an error processing your request: ${error.message || 'Unknown error'}`,
//             error: true
//           }
//         ]);
        
//         // Close the connection
//         setStreamConnection(null);
//       },
      
//       onCancelled: () => {
//         console.log('Stream cancelled');
//         setIsProcessing(false);
//         setCurrentStage(null);
//         setStatusMessage('Request cancelled');
//         setIsStreaming(false);
        
//         // Close the connection
//         setStreamConnection(null);
//       },
      
//       onHeartbeat: () => {
//         // Nothing needed here, just keeping connection alive
//       }
//     };
//   };
  
//   const handleSubmit = (e: React.FormEvent) => {
//     e.preventDefault();
    
//     if (!inputValue.trim() || isProcessing) return;
    
//     // First check if we need to cancel an active stream
//     if (streamConnection) {
//       streamConnection.close();
//       setStreamConnection(null);
//       setIsProcessing(false);
//       setCurrentStage(null);
//       setStatusMessage('Previous request cancelled');
//       setIsStreaming(false);
//       return;
//     }
    
//     // Add user message to chat
//     const userMessage: UserMessage = { role: 'user', content: inputValue };
//     setMessages(prev => [...prev, userMessage]);
    
//     // Start processing
//     setIsProcessing(true);
    
//     // Start streaming - using a hardcoded trackId for now
//     // In a real implementation, you'd get the selected track's ID
//     const trackId = tracks.length > 0 ? tracks[0].id : 'demo-track-1';
    
//     // Create the streaming connection
//     const connection = editTrackStream(
//       inputValue,
//       trackId,
//       setupStreamCallbacks()
//     );
    
//     // Store the connection so we can close it if needed
//     setStreamConnection(connection);
    
//     // Clear input
//     setInputValue('');
//   };
  
//   const handleCancel = () => {
//     if (streamConnection) {
//       streamConnection.close();
//       setStreamConnection(null);
//       setIsProcessing(false);
//       setCurrentStage(null);
//       setStatusMessage('Request cancelled');
//       setIsStreaming(false);
//     }
//   };
  
//   if (!isOpen) return null;
  
//   return (
//     <div style={styles.chatWindow}>
//       <div style={styles.chatHeader}>
//         <h3>AI Assistant (Streaming)</h3>
//         <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer' }}>×</button>
//       </div>
      
//       <div style={styles.chatMessages}>
//         {messages.map((msg, idx) => (
//           <div 
//             key={idx} 
//             style={{
//               ...styles.message,
//               ...(msg.role === 'user' ? styles.userMessage : styles.assistantMessage),
//               ...(msg as AssistantMessage).isStreaming ? styles.streamingMessage : {}
//             }}
//           >
//             <div>{msg.content}</div>
//             {(msg as AssistantMessage).isStreaming && (
//               <span style={styles.cursorBlink}>|</span>
//             )}
//           </div>
//         ))}
        
//         {/* Show streaming progress if processing */}
//         {isProcessing && (
//           <div style={{ marginTop: '15px' }}>
//             {currentStage && (
//               <StreamingProgress 
//                 stage={currentStage.name}
//                 description={currentStage.description}
//                 progress={streamProgress}
//               />
//             )}
//             {statusMessage && <p style={{ margin: '10px 0', color: '#aaa' }}>{statusMessage}</p>}
            
//             {/* Show tool calls */}
//             {toolCalls.length > 0 && (
//               <div style={styles.toolCalls}>
//                 <h4>AI is using tools:</h4>
//                 <ul style={{ marginLeft: '20px' }}>
//                   {toolCalls.map((tool, idx) => (
//                     <li key={idx} style={{ marginBottom: '5px' }}>
//                       <span style={{ fontWeight: 'bold' }}>{tool.name}</span>
//                     </li>
//                   ))}
//                 </ul>
//               </div>
//             )}
//           </div>
//         )}
        
//         <div ref={messagesEndRef} />
//       </div>
      
//       <form onSubmit={handleSubmit} style={styles.chatInput}>
//         <input
//           type="text"
//           value={inputValue}
//           onChange={(e) => setInputValue(e.target.value)}
//           placeholder="Ask the AI assistant..."
//           disabled={isProcessing}
//           style={styles.input}
//         />
//         <button 
//           type="submit" 
//           disabled={!inputValue.trim() || isProcessing}
//           style={{
//             ...styles.button,
//             opacity: !inputValue.trim() || isProcessing ? 0.5 : 1
//           }}
//         >
//           {isProcessing ? "Cancel" : "Send"}
//         </button>
        
//         {isProcessing && (
//           <button 
//             type="button" 
//             onClick={handleCancel}
//             style={{
//               ...styles.button,
//               backgroundColor: '#555'
//             }}
//           >
//             Cancel
//           </button>
//         )}
//       </form>
//     </div>
//   );
// };

// export default StreamingChatWindow;