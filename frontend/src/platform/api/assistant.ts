import { apiClient } from './client';
import { EventSourcePolyfill } from 'event-source-polyfill';

// Common Types
export interface AssistantAction {
  type: string;
  data: {
    [key: string]: any;
  };
}

export interface Note {
  time: number;
  duration: number;
  pitch: number;
  velocity: number;
}

export interface TrackData {
  track_id?: string;
  notes: Note[];
  instrument?: string;
  name?: string;
  storage_key?: string;  // Key for the instrument soundfont
}

// Request Types
export interface AssistantRequestOptions {
  prompt: string;
  mode: 'generate' | 'edit' | 'chat';
  track_id?: string;
  project_id?: string;
  style?: string;
  context?: {
    [key: string]: any;
  };
}

// Response Types
export interface RequestCreationResponse {
  request_id: string;
  status: string;
  mode: string;
  estimated_time?: number;
}

export interface GenerateResponse {
  response: string;
  tracks: TrackData[];
  actions?: AssistantAction[];
}

export interface EditResponse {
  response: string;
  track: TrackData;
  actions?: AssistantAction[];
}

/**
 * Stream event callbacks interface
 */
export interface StreamCallbacks {
  onConnected?: () => void;
  onStage?: (stage: { name: string, description: string }) => void;
  onStatus?: (status: { message: string, details?: string }) => void;
  onToolCall?: (toolCall: any) => void;
  onAction?: (action: AssistantAction) => void;
  onComplete?: (response: any) => void;
  onError?: (error: any) => void;
  onCancelled?: () => void;
  onHeartbeat?: () => void;
  onEvent?: (eventType: string, data: any) => void;
}

// Add MessageEvent type for SSE events
interface StreamEvent extends MessageEvent {
  data: string;
}

/**
 * Create a new assistant request and get a request ID
 * 
 * This is the first step in the POST-then-SSE pattern.
 * After getting a request ID, use streamAssistantResponse() to get streaming updates.
 * 
 * @param options Options for the assistant request
 * @returns Request creation response with request ID
 */
export const requestAssistant = async (
  options: AssistantRequestOptions
): Promise<RequestCreationResponse> => {
  try {
    
    // Log the request with additional details
    console.log(`🚀 POST REQUEST - Creating ${options.mode} request:`, {
      options,
      url: '/assistant/request',
      baseUrl: apiClient.defaults.baseURL
    });
    
    // Make API call
    const response = await apiClient.post('/assistant/request', options);
    
    // Log the response with additional details
    console.log('🟢 POST RESPONSE - Received request creation response:', {
      data: response.data,
      status: response.status,
      requestId: response.data.request_id
    });
    
    return response.data;
  } catch (error) {
    console.error('Error creating assistant request:', error);
    throw error;
  }
};

/**
 * Stream response for an existing request ID
 * 
 * This is the second step in the POST-then-SSE pattern.
 * First create a request with requestAssistant(), then stream the response.
 * 
 * @param requestId Request ID from requestAssistant()
 * @param callbacks Callbacks for different event types
 * @returns A function to close the connection
 */
export const streamAssistantResponse = (
  requestId: string,
  callbacks: StreamCallbacks
): { close: () => void } => {
  try {
    // Construct the URL with base URL from apiClient
    const baseUrl = apiClient.defaults.baseURL || '';
    const url = `${baseUrl}/assistant/stream/${requestId}`;
    
    // Log the streaming request with detailed info
    console.log(`🔷 GET REQUEST - Starting streaming for request:`, { 
      requestId, 
      url,
      fullUrl: `${window.location.origin}${url}`,
      baseUrl: apiClient.defaults.baseURL
    });
    
    // Get auth token from localStorage with correct key
    const token = localStorage.getItem('access_token');
    console.log('🔑 AUTH - Token for streaming request:', {
      tokenExists: !!token,
      tokenLength: token ? token.length : 0,
      tokenPreview: token ? `${token.substring(0, 10)}...` : 'none'
    });
    
    // Create the EventSource with auth header using polyfill
    const eventSource = new EventSourcePolyfill(url, { 
      withCredentials: true,
      headers: {
        'Authorization': token ? `Bearer ${token}` : ''
      }
    });
    
    // Event handlers
    eventSource.addEventListener('connected', (event: StreamEvent) => {
      console.log('SSE Connection established');
      callbacks.onConnected?.();
    });
    
    eventSource.addEventListener('stage', (event: StreamEvent) => {
      const data = JSON.parse(event.data);
      console.log('Assistant stage:', data);
      callbacks.onStage?.(data);
    });
    
    eventSource.addEventListener('status', (event: StreamEvent) => {
      const data = JSON.parse(event.data);
      console.log('Assistant status:', data);
      callbacks.onStatus?.(data);
    });
    
    eventSource.addEventListener('tool_call', (event: StreamEvent) => {
      const data = JSON.parse(event.data);
      console.log('Tool call:', data);
      callbacks.onToolCall?.(data);
    });
    
    eventSource.addEventListener('action', (event: StreamEvent) => {
      const data = JSON.parse(event.data);
      console.log('Action:', data);
      callbacks.onAction?.(data);
    });
    
    eventSource.addEventListener('complete', (event: StreamEvent) => {
      const data = JSON.parse(event.data);
      console.log('Assistant complete:', data);
      callbacks.onComplete?.(data);
      eventSource.close();
    });
    
    eventSource.addEventListener('error', (event: StreamEvent) => {
      const data = event.data ? JSON.parse(event.data) : { message: 'Unknown error' };
      console.error('Assistant stream error:', data);
      callbacks.onError?.(data);
      eventSource.close();
    });
    
    eventSource.addEventListener('cancelled', (event: StreamEvent) => {
      console.log('Assistant request cancelled');
      callbacks.onCancelled?.();
      eventSource.close();
    });
    
    eventSource.addEventListener('heartbeat', (event: StreamEvent) => {
      // Just keep the connection alive, no need to log this
      callbacks.onHeartbeat?.();
    });
    
    // Add streaming text event handlers with enhanced logging
    eventSource.addEventListener('response_start', (event: StreamEvent) => {
      const data = JSON.parse(event.data);
      console.log('🚀 RESPONSE_START EVENT RECEIVED:', data);
      callbacks.onEvent?.('response_start', data);
    });
    
    eventSource.addEventListener('response_chunk', (event: StreamEvent) => {
      const data = JSON.parse(event.data);
      console.log('📝 RESPONSE_CHUNK EVENT RECEIVED:', data);
      callbacks.onEvent?.('response_chunk', data);
    });
    
    eventSource.addEventListener('response_end', (event: StreamEvent) => {
      const data = JSON.parse(event.data);
      console.log('✅ RESPONSE_END EVENT RECEIVED:', data);
      callbacks.onEvent?.('response_end', data);
    });
    
    // Return a function to close the connection
    return {
      close: () => {
        console.log('Closing assistant stream connection');
        eventSource.close();
      }
    };
  } catch (error) {
    console.error('Error setting up assistant stream:', error);
    callbacks.onError?.(error);
    return { close: () => {} };
  }
};

/**
 * Cancel an ongoing assistant request
 * 
 * @param requestId Request ID to cancel
 * @returns True if cancelled successfully
 */
export const cancelAssistantRequest = async (requestId: string): Promise<boolean> => {
  try {
    console.log(`Cancelling request:`, requestId);
    
    // Make API call
    const response = await apiClient.delete(`/assistant/request/${requestId}`);
    
    console.log('Cancel response:', response.data);
    return true;
  } catch (error) {
    console.error('Error cancelling request:', error);
    return false;
  }
};

/**
 * Combined function to handle both steps of POST-then-SSE pattern
 * 
 * 1. Creates the request with requestAssistant()
 * 2. Streams the response with streamAssistantResponse()
 * 
 * @param options Options for the assistant request
 * @param callbacks Callbacks for streaming events
 * @returns Object with requestId and close function
 */
export const interactWithAssistant = async (
  options: AssistantRequestOptions,
  callbacks: StreamCallbacks
): Promise<{ requestId: string, close: () => void }> => {
  try {
    // Step 1: Create the request
    const { request_id } = await requestAssistant(options);
    
    // Step 2: Stream the response
    const { close } = streamAssistantResponse(request_id, callbacks);
    
    // Return both the request ID and close function
    return {
      requestId: request_id,
      close
    };
  } catch (error) {
    console.error('Error in assistant interaction:', error);
    callbacks.onError?.(error);
    return { 
      requestId: '', 
      close: () => {} 
    };
  }
};

// Legacy support functions

/**
 * Interface for streaming edit event callbacks (legacy)
 */
export interface EditStreamCallbacks extends StreamCallbacks {
  // Maintained for backward compatibility
}

/**
 * Interact with the AI assistant using streaming updates (legacy)
 * 
 * @deprecated Use interactWithAssistant() instead
 */
export const streamAssistant = (
  prompt: string,
  mode: 'generate' | 'edit' | 'chat',
  callbacks: StreamCallbacks,
  trackId?: string,
  context?: Record<string, any>
): { close: () => void } => {
  // Create options object for the new API
  const options: AssistantRequestOptions = {
    prompt,
    mode,
    track_id: trackId,
    context
  };
  
  // Use the new combined function
  interactWithAssistant(options, callbacks)
    .catch(error => {
      console.error('Legacy streamAssistant error:', error);
      callbacks.onError?.(error);
    });
  
  // Return a placeholder close function that will be replaced
  // once interactWithAssistant resolves
  let realClose: () => void = () => {};
  
  return {
    close: () => realClose()
  };
};

/**
 * Edit a track with streaming updates (legacy)
 * 
 * @deprecated Use interactWithAssistant() instead
 */
export const editTrackStream = (
  prompt: string,
  trackId: string,
  callbacks: EditStreamCallbacks,
  editType?: string,
  context?: Record<string, any>
): { close: () => void } => {
  return streamAssistant(
    prompt,
    editType === 'generate' ? 'generate' : 'edit',
    callbacks,
    trackId,
    context
  );
};

/**
 * Generate tracks using the AI assistant (legacy)
 * 
 * @deprecated Use interactWithAssistant() instead
 */
export const generateTracks = async (
  prompt: string,
  style?: string,
  numTracks: number = 1,
  context?: Record<string, any>
): Promise<GenerateResponse> => {
  try {
    // Use the new API instead
    const options: AssistantRequestOptions = {
      prompt,
      mode: 'generate',
      style,
      context: {
        ...context,
        num_tracks: numTracks
      }
    };
    
    // Create a Promise that will resolve when we get the complete event
    return new Promise((resolve, reject) => {
      interactWithAssistant(options, {
        onComplete: (response) => {
          resolve(response);
        },
        onError: (error) => {
          reject(error);
        }
      }).catch(reject);
    });
  } catch (error) {
    console.error('Error generating tracks with AI:', error);
    
    // Return a fallback response
    return {
      response: "Sorry, I encountered an error generating tracks. Please try again later.",
      tracks: []
    };
  }
};

/**
 * Edit a track using the AI assistant (legacy)
 * 
 * @deprecated Use interactWithAssistant() instead
 */
export const editTrack = async (
  prompt: string,
  trackId: string,
  editType?: string,
  context?: Record<string, any>
): Promise<EditResponse> => {
    try {
      // Use the new API instead
      const options: AssistantRequestOptions = {
        prompt,
        mode: 'edit',
        track_id: trackId,
        context: {
          ...context,
          edit_type: editType
        }
      };
      
      // Create a Promise that will resolve when we get the complete event
      return new Promise((resolve, reject) => {
        interactWithAssistant(options, {
          onComplete: (response) => {
            resolve(response);
          },
          onError: (error) => {
            reject(error);
          }
        }).catch(reject);
      });
    } catch (error) {
        console.error('Error editing track with AI:', error);
        
        // Return a fallback response with an empty track
        return {
          response: "Sorry, I encountered an error editing the track. Please try again later.",
          track: {
              track_id: trackId,
              notes: []
          }
        };
    }
};