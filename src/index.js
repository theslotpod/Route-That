// src/index.js

import React from 'react';
import ReactDOM from 'react-dom/client'; // Use the correct import for React 18+
import App from './App'; // Import your main component

// Use ReactDOM.createRoot for modern React
const root = ReactDOM.createRoot(document.getElementById('root')); 

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Note: If you have a separate CSS file for global styles (e.g., index.css), 
// you may also need to import it here:
// import './index.css';