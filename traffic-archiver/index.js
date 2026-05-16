require('dotenv').config();
const { Kafka } = require('kafkajs');
const { getAuthToken } = require('../shared/auth-helper');

const CLIENT_ID = 'traffic_archiver';
const CLIENT_SECRET = 'secret_archiver_789';
const AUTH_URL = process.env.AUTH_URL || 'http://vm-auth:443';
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'vm-data:9092';

async function run() {
    console.log(`Starting ${CLIENT_ID}...`);
    
    const token = await getAuthToken(CLIENT_ID, CLIENT_SECRET, AUTH_URL);

    const kafkaConfig = {
        clientId: CLIENT_ID,
        brokers: [KAFKA_BROKER],
    };

    if (!KAFKA_BROKER.includes('localhost')) {
        kafkaConfig.sasl = {
            mechanism: 'oauthbearer',
            oauthBearerProvider: async () => ({ value: token })
        };
    }

    const kafka = new Kafka(kafkaConfig);
    const consumer = kafka.consumer({ groupId: 'archiver-group' });

    await consumer.connect();
    await consumer.subscribe({ topic: 'traffic-raw', fromBeginning: true });

    console.log('Archiver waiting for messages...');

    await consumer.run({
        eachMessage: async ({ message }) => {
            const data = JSON.parse(message.value.toString());
            console.log(`[ARCHIVE] Storing data for zone ${data.zone_id}: ${data.vehicle_count} vehicles`);
            // In a real scenario, this would save to a DB
        },
    });
}

run().catch(console.error);
