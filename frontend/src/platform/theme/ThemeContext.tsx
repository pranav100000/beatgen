import React, { createContext, useState, useMemo, useContext, ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Define the shape of the context
interface ThemeContextType {
  mode: 'light' | 'dark';
  toggleTheme: () => void;
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

// Create the provider component
export const AppThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Default to dark mode, or read from localStorage/preference
  const [mode, setMode] = useState<'light' | 'dark'>('light'); 

  const toggleTheme = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  // Select the theme object based on the current mode
  const theme = useMemo(() => (mode === 'light' ? lightTheme : darkTheme), [mode]);

  // Provide the context value
  const contextValue = useMemo(() => ({ mode, toggleTheme }), [mode]);

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