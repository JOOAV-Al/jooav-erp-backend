import * as Sentry from '@sentry/nestjs';
const { nodeProfilingIntegration } = require('@sentry/profiling-node');

// Ensure to call this before requiring any other modules!
Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Add our Profiling integration
  integrations: [nodeProfilingIntegration()],

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for tracing.
  // We recommend adjusting this value in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Set profilesSampleRate to 1.0 to profile 100%
  // of sampled transactions.
  // This is relative to tracesSampleRate
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Debug mode in development
  debug: process.env.NODE_ENV === 'development',

  // Filter out certain errors
  beforeSend(event) {
    // Don't send health check 404s
    if (event.request?.url?.includes('/favicon.ico')) {
      return null;
    }
    return event;
  },
});
