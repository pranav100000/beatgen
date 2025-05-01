/* tslint:disable */
/* eslint-disable */
/**
/* This file was automatically generated from pydantic models by running pydantic2ts.
/* Do not modify it by hand - just update the pydantic models and then re-run the script
*/

export type ActionType =
  | "change_bpm"
  | "change_key"
  | "change_time_signature"
  | "add_track"
  | "add_drum_track"
  | "adjust_volume"
  | "adjust_pan"
  | "toggle_mute"
  | "toggle_solo";

/**
 * Base class for all assistant actions
 */
export interface AssistantAction {
  /**
   * The type of action to perform
   */
  action_type: ActionType;
  /**
   * The data for this action
   */
  data: ActionData;
}
/**
 * Base class for all action data
 */
export interface ActionData {
  [k: string]: unknown;
}
/**
 * Request data for the AI assistant (legacy)
 */
export interface AssistantRequest {
  prompt: string;
  project_id?: string | null;
  context?: {
    [k: string]: unknown;
  } | null;
  track_id?: string | null;
}
/**
 * Base request data for the AI assistant
 */
export interface AssistantRequestBase {
  prompt: string;
  project_id?: string | null;
  context?: {
    [k: string]: unknown;
  } | null;
}
/**
 * Response from the AI assistant (legacy)
 */
export interface AssistantResponse {
  response: string;
  actions?: AssistantAction[] | null;
  track_id?: string | null;
}
/**
 * Base response from the AI assistant
 */
export interface AssistantResponseBase {
  response: string;
  actions?: AssistantAction[] | null;
}
/**
 * Request for editing a specific track
 */
export interface EditRequest {
  prompt: string;
  project_id?: string | null;
  context?: {
    [k: string]: unknown;
  } | null;
  track_id: string;
  edit_type?: string | null;
}
/**
 * Response for the edit endpoint
 */
export interface EditResponse {
  response: string;
  actions?: AssistantAction[] | null;
  track: TrackData;
}
/**
 * Data for a generated or edited track
 */
export interface TrackData {
  notes: {
    [k: string]: unknown;
  }[];
  instrument_name?: string | null;
  instrument_id?: string | null;
}
/**
 * Request for generating multiple tracks
 */
export interface GenerateRequest {
  prompt: string;
  project_id?: string | null;
  context?: {
    [k: string]: unknown;
  } | null;
  style?: string | null;
}
/**
 * Response for the generate endpoint
 */
export interface GenerateResponse {
  response: string;
  actions?: AssistantAction[] | null;
  tracks: TrackData[];
}
/**
 * Project data for AI context
 */
export interface ProjectContext {
  id: string;
  name: string;
  bpm: number;
  time_signature: string;
  key_signature: string;
  tracks: TrackContext[];
}
/**
 * Simplified track data for AI context
 */
export interface TrackContext {
  id: string;
  name: string;
  type: string;
  instrument?: string | null;
  volume: number;
  pan: number;
  muted: boolean;
  position: {
    [k: string]: number;
  };
}
/**
 * Model for events sent through the asyncio.Queue
 */
export interface QueueEvent {
  type:
    | "connected"
    | "stage"
    | "status"
    | "response_start"
    | "response_chunk"
    | "response_end"
    | "action"
    | "complete"
    | "cancelled"
    | "error";
  data: QueueEventData | AssistantAction | AssistantResponse | GenerateResponse | EditResponse;
}
/**
 * Base model for queue event data
 */
export interface QueueEventData {
  message?: string | null;
  status?: string | null;
  name?: string | null;
  description?: string | null;
  message_id?: string | null;
  chunk?: string | null;
  chunk_index?: number | null;
  is_complete?: boolean | null;
  details?: string | null;
  error?: string | null;
  track_id?: string | null;
}
/**
 * Tool call output from Claude API
 */
export interface ToolCallResponse {
  name: string;
  parameters: {
    [k: string]: unknown;
  };
}
/**
 * Definition of a tool that Claude can use
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    [k: string]: unknown;
  };
}
/**
 * Results from executing tools
 */
export interface ToolResults {
  success: boolean;
  message: string;
  data?: {
    [k: string]: unknown;
  } | null;
}
