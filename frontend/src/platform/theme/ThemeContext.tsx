import React, { createContext, useState, useMemo, useContext, ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Define the shape of the context
interface ThemeContextType {
  mode: 'light' | 'dark';
  studioMode: 'light' | 'dark';
  toggleUITheme: () => void;
  toggleStudioTheme: () => void;
}

// Create the context with a default value (or null and check)
const ThemeContext = createContext<ThemeContextType | null>(null);

// Define light and dark themes (could be imported from main.tsx or defined here)
const lightTheme = createTheme({
  palette: {
    mode: 'light',
  },
  typography: {
    fontFamily: '"Sen", sans-serif',
  },
});

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#000000'
    },
  },
  typography: {
    fontFamily: '"Sen", sans-serif',
  },
});

// Studio-specific themes (can be customized independently later)
// For now, they mirror the global themes
export const studioLightTheme = createTheme({
  palette: {
    mode: 'light',
  },
  typography: {
    fontFamily: '"Sen", sans-serif',
  },
});

export const studioDarkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#000000'
    },
  },
  typography: {
    fontFamily: '"Sen", sans-serif',
  },
});

// Create the provider component
export const AppThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Default to dark mode, or read from localStorage/preference
  const [uiMode, setUIMode] = useState<'light' | 'dark'>('light'); 
  const [studioMode, setStudioMode] = useState<'light' | 'dark'>('dark'); 

  const toggleUITheme = () => {
    setUIMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };
  const toggleStudioTheme = () => {
    setStudioMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  // Select the theme object based on the current mode
  const theme = useMemo(() => (uiMode === 'light' ? lightTheme : darkTheme), [uiMode]);

  // Provide the context value
  const contextValue = useMemo(() => ({ mode: uiMode, studioMode: studioMode, toggleUITheme, toggleStudioTheme }), [uiMode, studioMode]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {/* Apply the selected MUI theme */}
      <MuiThemeProvider theme={theme}>
        {/* CssBaseline kickstarts an elegant, consistent baseline to build upon. */}
        <CssBaseline /> 
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

// Custom hook to use the theme context
export const useAppTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within an AppThemeProvider');
  }
  return context;
}; 