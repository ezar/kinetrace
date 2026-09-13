import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { CURRENT_CACHE, sweepStaleCaches } from './pwa/caches.js';
import './index.css';

// Reclaim what a previous build's MediaPipe runtime is still holding. Nothing
// depends on it finishing, and nothing goes wrong if it never does.
if (CURRENT_CACHE) void sweepStaleCaches(CURRENT_CACHE);

const container = document.getElementById('root');
if (!container) throw new Error('Root element missing');

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
