import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Studio from './Studio';
import './index.css';

// Import MUI fonts
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

// Create custom theme to match the original app
const theme = createTheme({
  typography: {
    fontFamily: '"Sen", sans-serif',
  },
  palette: {
    mode: 'dark',
    background: {
      default: '#000000'
    }
  }
});

// When used directly (not through the loader)
if (document.getElementById('root')) {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ThemeProvider theme={theme}>
        <Studio />
      </ThemeProvider>
    </React.StrictMode>
  );
}

// Keep track of roots to allow for proper cleanup
const rootRegistry: Record<string, ReactDOM.Root> = {};

// For the library mode, expose the function to mount the studio
// This is used when loaded as a module
const mountStudio = (elementId: string) => {
  // Clean up any existing root first
  if (rootRegistry[elementId]) {
    try {
      console.log(`Unmounting existing root for ${elementId}`);
      rootRegistry[elementId].unmount();
      delete rootRegistry[elementId];
    } catch (e) {
      console.error(`Error unmounting root for ${elementId}:`, e);
    }
  }

  const element = document.getElementById(elementId);
  if (element) {
    try {
      console.log(`Creating new root for ${elementId}`);
      const root = ReactDOM.createRoot(element);
      rootRegistry[elementId] = root;
      
      root.render(
        // Using StrictMode in production can cause double-mounting, which might 
        // contribute to cleanup issues
        <ThemeProvider theme={theme}>
          <Studio />
        </ThemeProvider>
      );
      
      console.log(`Successfully mounted to ${elementId}`);
      return true;
    } catch (e) {
      console.error(`Error mounting to ${elementId}:`, e);
      return false;
    }
  }
  
  console.warn(`Element with ID ${elementId} not found`);
  return false;
};

// Add an unmount function to clean up properly
const unmountStudio = (elementId: string) => {
  if (rootRegistry[elementId]) {
    try {
      rootRegistry[elementId].unmount();
      delete rootRegistry[elementId];
      return true;
    } catch (e) {
      console.error(`Error unmounting from ${elementId}:`, e);
      return false;
    }
  }
  return false;
};

// Expose the mount and unmount functions to window - IMPORTANT for the loader integration
console.log('Exposing mountStudioVite and unmountStudioVite functions to window object');
(window as any).mountStudioVite = mountStudio;
(window as any).unmountStudioVite = unmountStudio;

// Also export them for ESM imports if needed
export { mountStudio as mountStudioVite, unmountStudio as unmountStudioVite };

// Add window event listener for cleaning up when the page unloads
window.addEventListener('beforeunload', () => {
  // Clean up all roots
  Object.keys(rootRegistry).forEach(elementId => {
    try {
      rootRegistry[elementId].unmount();
    } catch (e) {
      console.error(`Error unmounting ${elementId} during page unload:`, e);
    }
  });
});

// Try to auto-mount to studio-vite-root if present
if (document.getElementById('studio-vite-root')) {
  console.log('Auto-mounting to studio-vite-root');
  mountStudio('studio-vite-root');
}