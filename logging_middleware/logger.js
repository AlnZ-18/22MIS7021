const axios = require('axios');
const auth = require('./auth');
const config = require('./config');
const { 
    VALID_STACKS, 
    VALID_LEVELS, 
    VALID_BACKEND_PACKAGES, 
    VALID_FRONTEND_PACKAGES, 
    VALID_SHARED_PACKAGES 
} = require('./constants');

function validateInputs(stack, level, packageName, message) {
    if (!VALID_STACKS.includes(stack)) throw new Error(`Invalid stack: ${stack}`);
    if (!VALID_LEVELS.includes(level)) throw new Error(`Invalid level: ${level}`);

    const isValidBackend = stack === 'backend' && VALID_BACKEND_PACKAGES.includes(packageName);
    const isValidFrontend = stack === 'frontend' && VALID_FRONTEND_PACKAGES.includes(packageName);
    const isValidShared = VALID_SHARED_PACKAGES.includes(packageName);

    if (!isValidBackend && !isValidFrontend && !isValidShared) {
        throw new Error(`Invalid packageName: ${packageName} for stack: ${stack}`);
    }

    if (!message || typeof message !== 'string') {
        throw new Error('Message must be a non-empty string');
    }
}

async function Log(stack, level, packageName, message) {
    try {
        validateInputs(stack, level, packageName, message);

        if (!config.baseUrl) {
            return { success: true, local: true, message: 'Logged locally due to missing configuration' };
        }

        const token = await auth.getToken();

        const logPayload = {
            stack,
            level,
            packageName,
            message,
            timestamp: new Date().toISOString()
        };

        const response = await axios.post(`${config.baseUrl}/logs`, logPayload, { 
            headers: { 
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            } 
        });

        return response.data;
    } catch (error) {
        const errorMsg = error.response?.data?.message || error.message;
        console.error(`[FALLBACK LOG] [${stack}] [${level}] [${packageName}] - ${message}`);
        return { success: false, error: errorMsg, fallback: true };
    }
}

module.exports = { Log };
