const axios = require('axios');

async function getAuthToken(clientId, clientSecret, authUrl) {
    try {
        const response = await axios.post(`${authUrl}/token`, {
            client_id: clientId,
            client_secret: clientSecret
        });
        return response.data.access_token;
    } catch (error) {
        console.error(`Error fetching token for ${clientId}:`, error.message);
        throw error;
    }
}

function getUnsecuredKafkaToken(sub = 'admin') {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
        sub: sub,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
    })).toString('base64url');
    return `${header}.${payload}.`;
}

module.exports = { getAuthToken, getUnsecuredKafkaToken };
