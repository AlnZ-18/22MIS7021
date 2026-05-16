const axios = require('axios');
const config = require('./config');

let currentClientId = config.clientId;
let currentClientSecret = config.clientSecret;
let currentToken = config.token;

async function register() {
    try {
        if (currentClientId && currentClientSecret) {
            return { clientId: currentClientId, clientSecret: currentClientSecret };
        }

        const response = await axios.post(`${config.baseUrl}/company/register`, {
            companyName: config.name,
            ownerName: config.name,
            rollNo: config.rollNo,
            ownerEmail: config.email,
            accessCode: config.accessCode
        });

        currentClientId = response.data.clientID || response.data.clientId;
        currentClientSecret = response.data.clientSecret;
        
        return { clientId: currentClientId, clientSecret: currentClientSecret };
    } catch (error) {
        throw new Error('Registration failed');
    }
}

async function authenticate() {
    try {
        if (currentToken) return currentToken;

        const creds = await register();
        
        const response = await axios.post(`${config.baseUrl}/company/auth`, {
            companyName: config.name,
            clientID: creds.clientId,
            clientSecret: creds.clientSecret
        });

        currentToken = response.data.access_token || response.data.token;
        return currentToken;
    } catch (error) {
        throw new Error('Authentication failed');
    }
}

async function getToken() {
    if (currentToken) return currentToken;
    return await authenticate();
}

module.exports = { register, authenticate, getToken };
