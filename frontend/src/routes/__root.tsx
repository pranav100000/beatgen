import { createRootRoute, Outlet, useRouter } from '@tanstack/react-router'
import React from 'react'
import Navbar from '../platform/components/Navbar'
import { useAuth } from '../platform/auth/auth-context'

// Root Layout Component - this wraps all routes
export const Route = createRootRoute({
  component: RootLayout,
  // Add a global error component to handle any unhandled errors or redirects
  errorComponent: ({ error }) => {
    console.error('Root error boundary caught:', error);
    
    return (
      <div style={{ 
        padding: '2rem', 
        textAlign: 'center',
        color: 'white',
        background: '#111',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <h1>Something went wrong</h1>
        <p>The application encountered an unexpected error.</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: '#3f51b5',
            color: 'white',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '1rem'
          }}
        >
          Reload page
        </button>
      </div>
    )
  }
})

// Root Layout Component implementation
function RootLayout() {
  const { loading } = useAuth();
  const router = useRouter();
  
  // Simple studio route detection using string matching on location.href
  // This is more reliable than router state during transitions
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const isStudioRoute = currentUrl.includes('/studio');
  
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#000',
        color: 'white'
      }}>
        <p>Loading...</p>
      </div>
    );
  }
  
  // No navbar in the root layout - each route will add its own navbar if needed
  return (
    <div id="root-layout">
      <main>
        <Outlet />
      </main>
    </div>
  );
}