const { Log } = require('logging_middleware');

/**
 * Standardizes successful API responses.
 */
function sendSuccess(res, statusCode, data, message = 'Success') {
    return res.status(statusCode).json({ success: true, message, data });
}

/**
 * Standardizes error API responses and automatically logs the error.
 */
function sendError(res, statusCode, errorMsg, stack, level, packageName, logMsg) {
    Log(stack, level, packageName, logMsg);
    return res.status(statusCode).json({ success: false, error: errorMsg });
}

module.exports = { sendSuccess, sendError };
