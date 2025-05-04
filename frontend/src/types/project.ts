/**
 * Unified Project types for BeatGen
 * This file provides a single source of truth for project types across the application
 */

import { CombinedTrack } from "../platform/types/project";

/**
 * Core project model - the essential data representing a project
 * This is used for persistence and transfer to/from the API
 */
export interface Project {
  id: string;
  name: string;
  tempo: number;
  timeSignature: [number, number];
  key: string;
  tracks: CombinedTrack[];
  
  // Optional metadata
  created_at?: string;
  updated_at?: string;
  user_id?: string;
}

/**
 * Runtime project state - includes everything in Project plus runtime-specific data
 * This should only be used in the UI layer, not for persistence
 */
export interface ProjectState extends Project {
  tracks: CombinedTrack[];  // Override tracks to use TrackState
  
  // Runtime-specific fields can be added here
  isDirty?: boolean;     // Whether the project has unsaved changes
  isPlaying?: boolean;   // Whether the project is currently playing
  isRecording?: boolean; // Whether the project is currently recording
}

/**
 * Project creation/update data types
 */
export interface ProjectCreateData {
  name: string;
  tempo: number;
  timeSignature: [number, number];
  key: string;
}

export interface ProjectUpdateData {
  name?: string;
  tempo?: number;
  timeSignature?: [number, number];
  key?: string;
  tracks?: CombinedTrack[];
}

/**
 * Converts a project to project state (useful for initializing the UI state)
 */
export function projectToProjectState(project: Project): ProjectState {
  return {
    ...project,
    tracks: project.tracks.map(track => ({ ...track })),
    isDirty: false,
    isPlaying: false,
    isRecording: false
  };
}