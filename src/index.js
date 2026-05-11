import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from "@sentry/react";
import App from './AutoShowroom.jsx';

// Load environment variables at runtime in Electron
if (window.require) {
  const path = window.require('path');
  const fs = window.require('fs');
  const electron = window.require('electron');
  
  // Use app.isPackaged if remote is available, otherwise fallback to process.env
  const isPackaged = electron.remote ? electron.remote.app.isPackaged : true;
  const isDev = !isPackaged || process.env.NODE_ENV === 'development';
  
  const resourcesPath = isDev 
    ? path.join(window.process.cwd(), '.env')
    : path.join(window.process.resourcesPath || '', '.env');

  if (fs.existsSync(resourcesPath)) {
    const dotenv = window.require('dotenv');
    dotenv.config({ path: resourcesPath });
  }
}

Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0, 
  // Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<p>An error has occurred</p>}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);