import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
// Import Studio component with a different name to avoid any potential naming conflicts
import StudioComponent from '../studio/Studio'
import { requireAuth, AuthErrorComponent } from '../platform/auth/auth-utils.tsx'

// Type definition for our search parameters
interface StudioSearchParams {
  projectId?: string;
}

// Studio route - this will render at the path '/studio'
export const Route = createFileRoute('/studio')({
  // Type-safe search parameters
  validateSearch: (search): StudioSearchParams => {
    // Handle the case where search might be undefined
    if (!search) return { projectId: undefined };
    
    return {
      projectId: search.projectId as string | undefined,
    }
  },
  
  // Use requireAuth utility to protect this route
  ...requireAuth('/login'),
  
  // Custom loader behavior when authentication is successful
  loader: async ({ search }) => {
    console.log('Studio loader running with search params:', search);
    
    // Safely access search params with proper null checks
    const projectId = search?.projectId;
    
    if (projectId) {
      console.log(`Loading project data for: ${projectId}`);
      // Return the projectId to the component
      return { 
        projectId,
        projectLoaded: true
      };
    } else {
      console.log('No project ID provided - creating new project');
      return { projectLoaded: true };
    }
  },
  
  // Component to render
  component: StudioPage,
  
  // Use shared error component for authentication failures
  errorComponent: AuthErrorComponent,
})

function StudioPage() {
  // Get the projectId directly from search params instead of loader data
  const { projectId } = Route.useSearch()
  // Don't wrap with AuthProvider as it should be provided at a higher level
  return <StudioComponent projectId={projectId} />
}