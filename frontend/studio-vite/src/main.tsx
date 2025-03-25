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

// For the library mode, expose the function to mount the studio
// This is used when loaded as a module
const mountStudio = (elementId: string) => {
  const element = document.getElementById(elementId);
  if (element) {
    ReactDOM.createRoot(element).render(
      <React.StrictMode>
        <ThemeProvider theme={theme}>
          <Studio />
        </ThemeProvider>
      </React.StrictMode>
    );
    return true;
  }
  return false;
};

// Expose the mount function to window
(window as any).mountStudioVite = mountStudio;

// Try to auto-mount to studio-vite-root if present
if (document.getElementById('studio-vite-root')) {
  mountStudio('studio-vite-root');
}