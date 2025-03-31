import { apiClient } from './client';

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


// Generate Endpoint Types
export interface GenerateRequest {
  prompt: string;
  project_id?: string;
  style?: string;
  num_tracks?: number;
  context?: {
    [key: string]: any;
  };
}

export interface GenerateResponse {
  response: string;
  tracks: TrackData[];
  actions?: AssistantAction[];
}

// Edit Endpoint Types
export interface EditRequest {
  prompt: string;
  track_id: string;
  project_id?: string;
  edit_type?: string;
  context?: {
    [key: string]: any;
  };
}

export interface EditResponse {
  response: string;
  track: TrackData;
  actions?: AssistantAction[];
}

/**
 * Generate tracks using the AI assistant
 * 
 * @param prompt The user's generation prompt
 * @param projectId Optional project ID
 * @param style Optional music style
 * @param numTracks Number of tracks to generate (default 1)
 * @param context Optional additional context data
 * @returns Generated tracks data
 */
export const generateTracks = async (
  prompt: string,
  style?: string,
  numTracks: number = 1,
  context?: Record<string, any>
): Promise<GenerateResponse> => {
  try {
    const request: GenerateRequest = { 
      prompt,
      num_tracks: numTracks
    };
    
    // Add optional parameters if provided
    if (style) request.style = style;
    if (context) request.context = context;
    
    // Log the request
    console.log('Sending track generation request:', request);
    
    // Make API call
    const response = await apiClient.post('/assistant/generate', request);
    
    // Log the response
    console.log('Received generation response:', response.data);
    
    return response.data;
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
 * Edit a track using the AI assistant
 * 
 * @param prompt The user's edit prompt
 * @param trackId The ID of the track to edit
 * @param projectId Optional project ID
 * @param editType Optional edit type (melody, rhythm, harmony, etc.)
 * @param context Optional additional context data
 * @returns Edited track data
 */
export const editTrack = async (
  prompt: string,
  trackId: string,
  editType?: string,
  context?: Record<string, any>
): Promise<EditResponse> => {
    try {
        const request: EditRequest = { 
        prompt,
        track_id: trackId
        };
        
        // Add optional parameters if provided
        if (editType) request.edit_type = editType;
        if (context) request.context = context;
        
        // Log the request
        console.log('Sending track edit request:', request);
        
        // Make API call
        const response = await apiClient.post('/assistant/edit', request);
        
        // Log the response
        console.log('Received edit response:', response.data);
        
        return response.data;
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