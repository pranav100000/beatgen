import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import NewProject from './pages/NewProject';
import UserAccount from './pages/UserAccount';
import Projects from './pages/Projects';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './core/auth/auth-context';
import ProtectedRoute from './components/ProtectedRoute';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme({
  typography: {
    fontFamily: '"Sen", sans-serif',
    button: {
      fontFamily: '"Sen", sans-serif',
    },
    body1: {
      fontFamily: '"Sen", sans-serif',
    },
    body2: {
      fontFamily: '"Sen", sans-serif',
    },
    h1: {
      fontFamily: '"Sen", sans-serif',
    },
    h2: {
      fontFamily: '"Sen", sans-serif',
    },
    h3: {
      fontFamily: '"Sen", sans-serif',
    },
    h4: {
      fontFamily: '"Sen", sans-serif',
    },
    h5: {
      fontFamily: '"Sen", sans-serif',
    },
    h6: {
      fontFamily: '"Sen", sans-serif',
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
          <Route path="/" element={<App />} />
          <Route path="/studio" element={<NewProject />} />
          <Route path="/account" element={
            <ProtectedRoute>
              <UserAccount />
            </ProtectedRoute>
          } />
          <Route path="/projects" element={
            <ProtectedRoute>
              <Projects />
            </ProtectedRoute>
          } />
          <Route path="/reset-password" element={<App />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
