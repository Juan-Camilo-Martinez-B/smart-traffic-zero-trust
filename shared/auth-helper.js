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

module.exports = { getAuthToken };
