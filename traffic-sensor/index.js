require('dotenv').config();
const { Kafka } = require('kafkajs');
const { getAuthToken } = require('../shared/auth-helper');

const CLIENT_ID = 'sensor_simulator';
const CLIENT_SECRET = 'secret_sensor_123';
const AUTH_URL = process.env.AUTH_URL || 'http://vm-auth:443';
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'vm-data:9092';

async function run() {
    console.log(`Starting ${CLIENT_ID}...`);
    
    // 1. Get JWT Token
    const token = await getAuthToken(CLIENT_ID, CLIENT_SECRET, AUTH_URL);
    console.log('Token obtained successfully');

    // 2. Configure Kafka
    const kafkaConfig = {
        clientId: CLIENT_ID,
        brokers: [KAFKA_BROKER],
    };

    // For local simulation, only use SASL if not on localhost
    if (!KAFKA_BROKER.includes('localhost')) {
        console.log('Using SASL OAUTHBEARER authentication for Kafka');
        kafkaConfig.sasl = {
            mechanism: 'oauthbearer',
            oauthBearerProvider: async () => ({ value: token })
        };
    } else {
        console.log('Local environment detected, using PLAINTEXT for Kafka');
    }

    const kafka = new Kafka(kafkaConfig);

    const producer = kafka.producer();
    await producer.connect();
    console.log('Connected to Kafka');

    const zones = ['A', 'B', 'C', 'D'];

    setInterval(async () => {
        const zone = zones[Math.floor(Math.random() * zones.length)];
        const vehicleCount = Math.floor(Math.random() * 100);
        const payload = {
            zone_id: zone,
            vehicle_count: vehicleCount,
            timestamp: new Date().toISOString()
        };

        await producer.send({
            topic: 'traffic-raw',
            messages: [{ value: JSON.stringify(payload) }],
        });

        console.log(`Sent: ${JSON.stringify(payload)}`);
    }, 5000);
}

run().catch(console.error);
