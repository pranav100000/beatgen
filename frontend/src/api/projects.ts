import { apiClient } from './client';

export interface Track {
  id: string;
  name: string;
  type: string;
  volume: number;
  pan: number;
  solo: boolean;
  mute: boolean;
  color?: string;
  content: Record<string, any>;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  bpm: number;
  time_signature: string;
  tracks: Track[];
  created_at: string;
  updated_at: string;
}

export interface ProjectCreateDto {
  name: string;
  description?: string;
  bpm?: number;
  time_signature?: string;
}

export interface ProjectUpdateDto {
  name?: string;
  description?: string;
  bpm?: number;
  time_signature?: string;
}

export const getProjects = async (): Promise<Project[]> => {
  const response = await apiClient.get('/projects');
  return response.data;
};

export const getProject = async (id: string): Promise<Project> => {
  const response = await apiClient.get(`/projects/${id}`);
  return response.data;
};

export const createProject = async (project: ProjectCreateDto): Promise<Project> => {
  const response = await apiClient.post('/projects', project);
  return response.data;
};

export const updateProject = async (id: string, updates: ProjectUpdateDto): Promise<Project> => {
  const response = await apiClient.patch(`/projects/${id}`, updates);
  return response.data;
};

export const deleteProject = async (id: string): Promise<void> => {
  await apiClient.delete(`/projects/${id}`);
};

export const addTrack = async (projectId: string, track: Omit<Track, 'id'>): Promise<Project> => {
  const response = await apiClient.post(`/projects/${projectId}/tracks`, track);
  return response.data;
};

export const updateTrack = async (projectId: string, trackId: string, track: Partial<Track>): Promise<Project> => {
  const response = await apiClient.patch(`/projects/${projectId}/tracks/${trackId}`, track);
  return response.data;
};

export const deleteTrack = async (projectId: string, trackId: string): Promise<Project> => {
  const response = await apiClient.delete(`/projects/${projectId}/tracks/${trackId}`);
  return response.data;
};