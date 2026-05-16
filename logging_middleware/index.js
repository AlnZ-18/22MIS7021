const axios = require('axios');

// Valid values for validation
const VALID_STACKS = ['backend', 'frontend'];
const VALID_LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'];

const VALID_BACKEND_PACKAGES = [
  'cache', 'controller', 'cron_job', 'db', 'domain', 
  'handler', 'repository', 'route', 'service'
];

const VALID_FRONTEND_PACKAGES = [
  'api', 'component', 'hook', 'page', 'state', 'style'
];

const VALID_SHARED_PACKAGES = [
  'auth', 'config', 'middleware', 'utils'
];

// In-memory token storage
let bearerToken = null;
let tokenExpiresAt = 0;

/**
 * Validates the inputs before attempting to log.
 */
function validateInputs(stack, level, packageName, message) {
  if (!VALID_STACKS.includes(stack)) {
    throw new Error(`Invalid stack: ${stack}. Must be one of: ${VALID_STACKS.join(', ')}`);
  }
  
  if (!VALID_LEVELS.includes(level)) {
    throw new Error(`Invalid level: ${level}. Must be one of: ${VALID_LEVELS.join(', ')}`);
  }

  const isValidBackend = stack === 'backend' && VALID_BACKEND_PACKAGES.includes(packageName);
  const isValidFrontend = stack === 'frontend' && VALID_FRONTEND_PACKAGES.includes(packageName);
  const isValidShared = VALID_SHARED_PACKAGES.includes(packageName);

  if (!isValidBackend && !isValidFrontend && !isValidShared) {
    throw new Error(`Invalid packageName: ${packageName} for stack: ${stack}.`);
  }

  if (!message || typeof message !== 'string') {
    throw new Error('Message must be a non-empty string.');
  }
}

/**
 * Authenticates with the external API to get a Bearer token.
 * Caches the token in memory to prevent excessive API calls.
 */
async function authenticate() {
  const authUrl = process.env.LOGGING_AUTH_URL;
  const clientId = process.env.LOGGING_CLIENT_ID;
  const clientSecret = process.env.LOGGING_CLIENT_SECRET;

  if (!authUrl) {
      // If no auth URL is provided, we skip remote logging and just log locally
      return false; 
  }

  // If we have a valid token, don't re-authenticate
  if (bearerToken && Date.now() < tokenExpiresAt) {
    return true;
  }

  try {
    const response = await axios.post(authUrl, {
      clientId,
      clientSecret
    });
    
    bearerToken = response.data.token;
    // Assume token is valid for 1 hour if not specified by the API
    const expiresInMs = (response.data.expiresIn || 3600) * 1000; 
    tokenExpiresAt = Date.now() + expiresInMs;
    
    return true;
  } catch (error) {
    console.error('[LoggingMiddleware] Authentication failed:', error.message);
    return false;
  }
}

/**
 * The main logging function to be exported.
 * 
 * @param {string} stack - 'backend' or 'frontend'
 * @param {string} level - 'debug', 'info', 'warn', 'error', 'fatal'
 * @param {string} packageName - specific package name from the allowed list
 * @param {string} message - the log message
 */
async function Log(stack, level, packageName, message) {
  try {
    // 1. Validate inputs
    validateInputs(stack, level, packageName, message);

    // If no external URL is provided, fallback to standard console.log
    const logUrl = process.env.LOGGING_API_URL;
    if (!logUrl) {
        console.log(`[${new Date().toISOString()}] [${stack}] [${level}] [${packageName}] - ${message}`);
        return;
    }

    // 2. Authenticate
    const isAuthenticated = await authenticate();
    if (!isAuthenticated) {
        // Fallback if auth fails so we don't lose the log
        console.log(`[AUTH_FAILED_FALLBACK] [${stack}] [${level}] [${packageName}] - ${message}`);
        return;
    }

    // 3. Send log
    await axios.post(
      logUrl,
      { stack, level, packageName, message, timestamp: new Date().toISOString() },
      {
        headers: {
          Authorization: `Bearer ${bearerToken}`
        }
      }
    );

  } catch (error) {
    // Handle API failures gracefully without crashing the main application
    console.error('[LoggingMiddleware] Failed to send log:', error.message);
    // Fallback log
    console.log(`[FALLBACK] [${stack}] [${level}] [${packageName}] - ${message}`);
  }
}

module.exports = { Log };
