import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from "@sentry/react";
import App from './AutoShowroom.jsx';

// Error reporting only. Customer names/phones must never leave the machine, so no session
// replay, no performance tracing, no default PII, and breadcrumbs/user/request data are stripped.
Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  sendDefaultPii: false,
  tracesSampleRate: 0,
  maxBreadcrumbs: 0,
  beforeSend(event) {
    delete event.user;
    delete event.request;
    delete event.breadcrumbs;
    return event;
  },
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<p>An error has occurred</p>}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);