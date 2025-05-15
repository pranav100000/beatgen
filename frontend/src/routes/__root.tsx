import { createRootRoute, Outlet, useRouter } from '@tanstack/react-router'
import React, { useEffect, useState } from 'react'
// import Navbar from '../platform/components/Navbar'
import { useAuth } from '../platform/auth/auth-context'
import { handleOAuthCallback } from '../platform/api/auth'
import { useAppTheme } from '../platform/theme/ThemeContext'
import Sidebar from '../platform/components/Sidebar'
import { SidebarProvider, SidebarInset } from '../components/ui/sidebar'
import { cn } from '../lib/utils'

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
  const { mode } = useAppTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Simple studio route detection using string matching on location.href
  // This is more reliable than router state during transitions
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const isStudioRoute = currentUrl.includes('/studio');
  
  // Handle OAuth callbacks
  useEffect(() => {
    const handleOAuth = async () => {
      // Check if this is an OAuth callback
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const isGoogleCallback = window.location.pathname.includes('/api/auth/callback/google');
        
        if (code && isGoogleCallback) {
          try {
            console.log('Processing Google OAuth callback');
            const result = await handleOAuthCallback('google', code);
            
            if (result.access_token) {
              // Store the token
              localStorage.setItem('access_token', result.access_token);
              console.log('OAuth authentication successful, token stored');
              
              // Redirect to home or requested page
              const redirectTo = localStorage.getItem('auth_redirect') || '/';
              localStorage.removeItem('auth_redirect'); // Clear redirect
              window.location.href = redirectTo;
            }
          } catch (error) {
            console.error('OAuth callback processing failed:', error);
            // Redirect to login page on error
            window.location.href = '/login?error=oauth_failed';
          }
        }
      }
    };
    
    handleOAuth();
  }, []);
  
  // Define themes inline or import them if preferred
  const lightTheme = { background: '#ffffff', text: '#000000' }; // Simplified for example
  const darkTheme = { background: '#000000', text: '#ffffff' };
  const currentThemePalette = mode === 'light' ? lightTheme : darkTheme;
  
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: currentThemePalette.background,
        color: currentThemePalette.text
      }}>
        <p>Loading...</p>
      </div>
    );
  }
  
  // Determine if the sidebar should be shown based on the route
  // For example, hide sidebar on /studio, /login, /register, /etc.
  const noSidebarRoutes = ['/studio', '/login', '/register', '/']; // Added landing page '/'
  const shouldShowSidebar = !noSidebarRoutes.some(route => currentUrl.endsWith(route) || currentUrl.includes(route + '/') || currentUrl.includes(route + '?'));

  // No navbar in the root layout - each route will add its own navbar if needed
  // The main div now becomes a flex container to hold Sidebar and SidebarInset
  return (
    <SidebarProvider 
      open={isSidebarOpen}
      onOpenChange={setIsSidebarOpen} 
      defaultOpen={true} // Default open state
    >
      <div 
        id="root-layout" 
        style={{ 
          background: currentThemePalette.background, 
          color: currentThemePalette.text, 
          minHeight: '100vh',
          display: 'flex', // Added display flex
          width: '100%' // Ensure full width within its parent flex container
        }}
      >
        {shouldShowSidebar && <Sidebar />} 
        <SidebarInset> {/* Wrap Outlet with SidebarInset */}
          <main
            className={cn(
              "flex-grow overflow-y-auto w-full" // Ensure it's always full width
            )}
            // style={{ flexGrow: 1, overflowY: 'auto' }} // Replaced by className
          >
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}