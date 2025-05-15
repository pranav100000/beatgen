import { createFileRoute } from '@tanstack/react-router'
import React, { useEffect } from 'react'
import Projects from '../platform/pages/Projects'
import HomePage from '../platform/pages/HomePage'
import { requireAuth, AuthErrorComponent } from '../platform/auth/auth-utils.tsx'

// Home/Projects route - this will render at the path '/home'
export const Route = createFileRoute('/projects')({
  // Use requireAuth utility to protect this route
  ...requireAuth('/login'),
  
  // Component to render
  component: Projects,
  
  // Use shared error component for authentication failures
  errorComponent: AuthErrorComponent,
})

function ProjectsPageDemo() {
  // For demonstration, log that we've accessed this protected route
  useEffect(() => {
    console.log('Accessing protected home/projects page')
  }, [])

  // Render the Navbar and Projects component
  return (
    <>
      <Projects />
    </>
  )
}