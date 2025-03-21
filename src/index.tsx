import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import NewProject from './pages/NewProject';
import UserAccount from './pages/UserAccount';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './core/auth/auth-context';
import ProtectedRoute from './components/ProtectedRoute';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/new-project" element={<NewProject />} />
          <Route path="/account" element={
            <ProtectedRoute>
              <UserAccount />
            </ProtectedRoute>
          } />
          <Route path="/reset-password" element={<App />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
