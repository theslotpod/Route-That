// src/index.js

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// --- PWA SERVICE WORKER ADDITIONS ---
// 1. Import the service worker logic (assuming it exists in your src folder)
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
// ------------------------------------

const root = ReactDOM.createRoot(document.getElementById('root')); 

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// --- PWA SERVICE WORKER REGISTRATION ---
// If you want your app to work offline and load faster, you must REGISTER the service worker.
// IMPORTANT: If this file uses an older create-react-app style, you might see:
// serviceWorker.unregister();
// You must change the call from unregister() to register().
serviceWorkerRegistration.register();
// ---------------------------------------