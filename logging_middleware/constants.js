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

module.exports = {
    VALID_STACKS,
    VALID_LEVELS,
    VALID_BACKEND_PACKAGES,
    VALID_FRONTEND_PACKAGES,
    VALID_SHARED_PACKAGES
};
