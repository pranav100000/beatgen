import { useState, useEffect } from 'react';
import { getProject } from '../../platform/api/projects';
import { Project as ApiProject } from '../../platform/types/project';
import Project from '../core/state/project';
import { apiProjectToInternal } from '../../platform/types/adapters';

/**
 * Hook to load a project from the API and convert it to the internal format
 * @param projectId The ID of the project to load
 * @returns Object containing loading state, error, and the loaded project
 */
export function useProjectLoader(projectId: string | null) {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [apiProject, setApiProject] = useState<ApiProject | null>(null);
  const [internalProject, setInternalProject] = useState<InternalProject | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const loadProject = async () => {
      setLoading(true);
      setError(null);

      try {
        // Load the project from the API
        const project = await getProject(projectId);
        
        // Store the API project
        setApiProject(project);
        
        // Convert to internal format
        const converted = apiProjectToInternal(project);
        setInternalProject(converted);
        
      } catch (err) {
        console.error('Error loading project:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectId]);

  return { loading, error, apiProject, internalProject };
}