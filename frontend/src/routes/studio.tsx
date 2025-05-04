import { createFileRoute, Outlet, useRouter, useSearch } from '@tanstack/react-router'
import React from 'react'
// Removed ThemeProvider and createTheme imports
// Import Studio component with a different name to avoid any potential naming conflicts
import StudioComponent from '../studio/Studio'
import { requireAuth, AuthErrorComponent } from '../platform/auth/auth-utils.tsx'

// Type definition for our search parameters
interface StudioSearchParams {
  projectId?: string;
}

// Removed darkTheme definition

// Studio route - this will render at the path '/studio'
export const Route = createFileRoute('/studio')({
  // Type-safe search parameters
  /* // Temporarily commented out to test type inference
  validateSearch: (search): StudioSearchParams => {
    // Handle the case where search might be undefined
    if (!search) return { projectId: undefined };
    
    return {
      projectId: search.projectId as string | undefined,
    }
  },
  */
  
  // Use requireAuth utility to protect this route
  ...requireAuth('/login'),
  
  // Custom loader behavior when authentication is successful
  loader: async ({ /* context, params, */ location }) => { // Access location instead of search
    console.log('Studio loader running with location:', location);
    
    // Safely access search params from location.search
    const searchParams = new URLSearchParams(location.search);
    const projectId = searchParams.get('projectId');
    
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
  // Manually get projectId from search params since validateSearch is commented out
  const searchParams = useSearch({ from: Route.id }); // Get search params for this route
  const projectId = (searchParams as StudioSearchParams)?.projectId;

  console.log("StudioPage rendering with projectId:", projectId);

  // Render StudioComponent directly - theme is handled by AppThemeProvider
  return <StudioComponent projectId={projectId} />;
}