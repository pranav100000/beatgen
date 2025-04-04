import React, { useState, useRef, useEffect } from 'react';
import { EventSourcePolyfill } from 'event-source-polyfill';
import { Bars } from 'react-loader-spinner';

// Check if the Bars component is missing (caused by an error importing react-loader-spinner)
const LoadingIndicator = typeof Bars !== 'undefined' ? Bars : () => <div>Loading...</div>;

// Simple component for testing the SSE streaming functionality
const StreamingTest: React.FC = () => {
  const [prompt, setPrompt] = useState('Increase the volume to 80%');
  const [trackId, setTrackId] = useState('track-123');
  const [endpoint, setEndpoint] = useState('/api/assistant/streaming/edit');
  const [logs, setLogs] = useState<{type: string, data: any, timestamp: Date}[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef<EventSourcePolyfill | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Add a log entry
  const addLog = (type: string, data: any) => {
    setLogs(prev => [...prev, { type, data, timestamp: new Date() }]);
  };

  // Start the SSE connection
  const startStreaming = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setIsLoading(true);
    
    try {
      // Check multiple possible token keys in localStorage
      const possibleTokenKeys = ['access_token', 'token', 'authToken', 'auth_token', 'jwt'];
      let token = null;
      
      // Try all possible token keys
      for (const key of possibleTokenKeys) {
        const possibleToken = localStorage.getItem(key);
        if (possibleToken) {
          token = possibleToken;
          addLog('system', { message: `Auth token found in localStorage with key: ${key}` });
          break;
        }
      }
      
      // If no token found, log all available localStorage keys
      if (!token) {
        const allKeys = Object.keys(localStorage);
        addLog('warning', { 
          message: 'No auth token found in localStorage', 
          tried: possibleTokenKeys,
          available_keys: allKeys 
        });
      }
      
      // Construct the URL
      const baseUrl = 'http://localhost:8000'; // Hardcoded for testing
      const url = `${baseUrl}${endpoint}?prompt=${encodeURIComponent(prompt)}&track_id=${encodeURIComponent(trackId)}`;
      
      addLog('system', { message: `Connecting to ${url}` });

      // Create EventSource options
      const options: any = {
        withCredentials: true
      };
      
      // Only add headers if token is available
      if (token) {
        options.headers = {
          'Authorization': `Bearer ${token}`
        };
        addLog('system', { message: 'Adding Authorization header with Bearer token' });
      } else {
        // Try to get saved token from browser console for debugging
        addLog('system', { 
          message: 'No token found, connection will likely fail with 401 error',
          tip: 'To test, find a valid token and set it with: localStorage.setItem("token", "your-token-here")'
        });
      }
      
      // Log final connection options (without exposing the actual token)
      addLog('system', { 
        message: 'Creating EventSourcePolyfill with options',
        hasAuthHeader: !!options.headers?.Authorization,
        withCredentials: options.withCredentials
      });
      
      // Create new EventSource with options
      eventSourceRef.current = new EventSourcePolyfill(url, options);
      
      // Listen for all standard events
      const eventTypes = [
        'connected', 'stage', 'status', 'tool_call', 'action', 
        'complete', 'error', 'cancelled', 'heartbeat', 
        // Add more event types for debugging
        'ping', 'pong', 'message', 'open', 'close',
        // Test events
        'start', 'background'
      ];
      
      // Set up event listeners for all types
      eventTypes.forEach(eventType => {
        eventSourceRef.current?.addEventListener(eventType, (event) => {
          console.log(`SSE ${eventType} event received:`, event);
          
          try {
            // For connected event, update connection state
            if (eventType === 'connected') {
              setIsConnected(true);
            }
            
            // For complete or cancelled event, stop streaming
            if (eventType === 'complete' || eventType === 'cancelled') {
              stopStreaming();
            }
            
            // Parse the data if it exists
            const data = event.data ? JSON.parse(event.data) : { message: `${eventType} event received` };
            
            // Log the event
            addLog(eventType, data);
          } catch (error) {
            console.error(`Error handling ${eventType} event:`, error);
            addLog('parse_error', { 
              event_type: eventType,
              raw_data: event.data,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        });
      });
      
      // Also add a message handler for any message type
      eventSourceRef.current.onmessage = (event) => {
        console.log('SSE message event:', event);
        try {
          const data = event.data ? JSON.parse(event.data) : { message: 'generic message received' };
          addLog('message', data);
        } catch (error) {
          console.error('Error handling message event:', error);
          addLog('parse_error', {
            event_type: 'message',
            raw_data: event.data,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      };
      
      // Handle connection errors with detailed logging
      eventSourceRef.current.onerror = (err) => {
        console.error('EventSource error:', err);
        
        // Extract more information from the error
        const errorInfo = {
          message: 'EventSource error',
          status: err.status || 'unknown',
          statusText: err.statusText || 'unknown',
          readyState: eventSourceRef.current?.readyState || 'unknown',
          hasHeaders: !!err.headers,
          timestamp: new Date().toISOString()
        };
        
        // Add debugging tips based on status code
        if (err.status === 401) {
          errorInfo.tipForAuthIssue = 'Authentication failed. Check if your token is valid. Try setting a valid token in localStorage.';
        } else if (err.status === 404) {
          errorInfo.tipForNotFound = 'Endpoint not found. Check if the URL is correct and the backend server is running.';
        } else if (err.status === 0 || !err.status) {
          errorInfo.tipForConnection = 'Connection error. Check if the backend server is running and CORS is configured correctly.';
        }
        
        addLog('connection_error', errorInfo);
        stopStreaming();
      };
      
    } catch (error) {
      console.error('Error setting up EventSource:', error);
      addLog('error', { 
        message: 'Failed to set up EventSource', 
        error: error instanceof Error ? error.message : String(error) 
      });
      setIsLoading(false);
    }
  };

  // Stop the SSE connection
  const stopStreaming = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
    setIsLoading(false);
  };

  // Clear logs
  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="streaming-test" style={{ 
      position: 'fixed', 
      bottom: 20, 
      right: 20, 
      width: 400, 
      backgroundColor: '#fff',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      borderRadius: 8,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      maxHeight: '80vh',
    }}>
      <div style={{ padding: '10px 16px', backgroundColor: '#eef', borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Streaming Test</h3>
        <div>
          <span style={{ 
            padding: '4px 8px', 
            borderRadius: 4, 
            backgroundColor: isConnected ? '#d6f5d6' : '#f8d7da',
            color: isConnected ? '#28a745' : '#dc3545',
            marginRight: 8,
            fontSize: 12
          }}>
            {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>
      </div>
      
      <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Prompt:</label>
            <input 
              type="text" 
              value={prompt} 
              onChange={(e) => setPrompt(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
              disabled={isConnected}
            />
          </div>
          
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Track ID:</label>
            <input 
              type="text" 
              value={trackId} 
              onChange={(e) => setTrackId(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
              disabled={isConnected}
            />
          </div>
          
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Endpoint:</label>
            <input 
              type="text" 
              value={endpoint} 
              onChange={(e) => setEndpoint(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
              disabled={isConnected}
            />
          </div>
          
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              onClick={startStreaming} 
              disabled={isConnected || isLoading}
              style={{ 
                padding: '8px 16px', 
                backgroundColor: isConnected ? '#ccc' : '#5c6bc0', 
                color: 'white', 
                border: 'none', 
                borderRadius: 4,
                cursor: isConnected ? 'not-allowed' : 'pointer'
              }}
            >
              {isLoading ? (
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <LoadingIndicator height={16} width={16} color="#fff" />
                  <span style={{ marginLeft: 8 }}>Connecting...</span>
                </span>
              ) : 'Start Streaming'}
            </button>
            
            <button 
              onClick={stopStreaming} 
              disabled={!isConnected && !isLoading}
              style={{ 
                padding: '8px 16px', 
                backgroundColor: !isConnected && !isLoading ? '#ccc' : '#dc3545', 
                color: 'white', 
                border: 'none', 
                borderRadius: 4,
                cursor: !isConnected && !isLoading ? 'not-allowed' : 'pointer'
              }}
            >
              Stop
            </button>
            
            <button 
              onClick={clearLogs}
              style={{ 
                padding: '8px 16px', 
                backgroundColor: '#6c757d', 
                color: 'white', 
                border: 'none', 
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              Clear Logs
            </button>
          </div>
        </div>
        
        <div 
          ref={logContainerRef}
          style={{ 
            backgroundColor: '#black', 
            padding: 12, 
            borderRadius: 4, 
            maxHeight: 300, 
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: 12
          }}
        >
          {logs.length === 0 ? (
            <div style={{ color: 'black', textAlign: 'center', padding: 16 }}>No events yet</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} style={{ 
                marginBottom: 8, 
                padding: 8, 
                backgroundColor: 
                  log.type === 'error' ? '#f8d7da' : 
                  log.type === 'connected' ? '#d6f5d6' : 
                  log.type === 'complete' ? '#d1ecf1' : 
                  log.type === 'heartbeat' ? '#fff3cd' : 
                  '#fff',
                borderRadius: 4,
                borderLeft: `4px solid ${
                  log.type === 'error' ? '#dc3545' : 
                  log.type === 'connected' ? '#28a745' : 
                  log.type === 'complete' ? '#17a2b8' : 
                  log.type === 'heartbeat' ? '#ffc107' : 
                  log.type === 'stage' ? '#6f42c1' : 
                  log.type === 'status' ? '#fd7e14' : 
                  log.type === 'tool_call' ? '#20c997' : 
                  log.type === 'action' ? '#e83e8c' : 
                  '#6c757d'
                }`
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                  {log.timestamp.toLocaleTimeString()} - {log.type.toUpperCase()}
                </div>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'black' }}>
                  {JSON.stringify(log.data, null, 2)}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default StreamingTest;