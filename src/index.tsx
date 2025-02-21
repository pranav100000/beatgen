import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import NewProject from './pages/NewProject';
import reportWebVitals from './reportWebVitals';
import NiceModal from '@ebay/nice-modal-react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <NiceModal.Provider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/new-project" element={<NewProject />} />
        </Routes>
      </NiceModal.Provider>
    </BrowserRouter>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
