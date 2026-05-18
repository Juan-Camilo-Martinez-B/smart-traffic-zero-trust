require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 443;
const JWT_SECRET = process.env.JWT_SECRET;

// In a real scenario, these would be in a database
const CLIENTS = {
    'sensor_simulator': 'secret_sensor_123',
    'density_processor': 'secret_processor_456',
    'traffic_archiver': 'secret_archiver_789',
    'dashboard_backend': 'secret_dashboard_000',
    'alert_dispatcher': 'secret_alert_111',
    'query_client': 'secret_query_222'
};

app.post('/token', (req, res) => {
    const { client_id, client_secret } = req.body;

    if (!client_id || !client_secret) {
        return res.status(400).json({ error: 'Missing client_id or client_secret' });
    }

    if (CLIENTS[client_id] === client_secret) {
        // Generate token
        // For Kafka/RabbitMQ OAUTHBEARER, we might need specific claims
        const token = jwt.sign(
            { 
                sub: client_id,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
                aud: 'smarttraffic-cluster',
                iss: 'auth-server',
                scope: 'smarttraffic-cluster.read:*/* smarttraffic-cluster.write:*/* smarttraffic-cluster.configure:*/* smarttraffic-cluster.tag:administrator smarttraffic-cluster.tag:management'
            }, 
            JWT_SECRET,
            { algorithm: 'HS256' }
        );

        console.log(`Token issued for: ${client_id}`);
        return res.json({ 
            access_token: token,
            token_type: 'Bearer',
            expires_in: 3600
        });
    }

    return res.status(401).json({ error: 'Invalid credentials' });
});

// Health check
app.get('/health', (req, res) => res.send('Auth Server is running'));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Auth Server running on port ${PORT}`);
});
