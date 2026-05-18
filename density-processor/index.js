require('dotenv').config();
const { Kafka } = require('kafkajs');
const amqp = require('amqplib');
const { getAuthToken } = require('../shared/auth-helper');

const CLIENT_ID = 'density_processor';
const CLIENT_SECRET = 'secret_processor_456';
const AUTH_URL = process.env.AUTH_URL || 'http://vm-auth:443';
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'vm-data:9092';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://vm-data:5672';

async function run() {
    console.log(`Starting ${CLIENT_ID}...`);
    
    // 1. Get JWT Token
    const token = await getAuthToken(CLIENT_ID, CLIENT_SECRET, AUTH_URL);

    // 2. Kafka Consumer
    const kafkaConfig = {
        clientId: CLIENT_ID,
        brokers: [KAFKA_BROKER],
    };

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

    const consumer = kafka.consumer({ groupId: 'density-group' });
    await consumer.connect();
    await consumer.subscribe({ topic: 'traffic-raw', fromBeginning: true });

    // 3. RabbitMQ Producer
    let rabbitOptions = {
        credentials: amqp.credentials.plain('', token)
    };

    if (RABBITMQ_URL.includes('localhost') || process.env.RABBITMQ_BYPASS_OAUTH === 'true') {
        console.log('Local or bypassed environment detected, using guest credentials for RabbitMQ');
        rabbitOptions = {}; // Fallback for local
    }

    const rabbitConn = await amqp.connect(RABBITMQ_URL, rabbitOptions);
    const channel = await rabbitConn.createChannel();
    const exchange = 'traffic_updates';
    await channel.assertExchange(exchange, 'fanout', { durable: false });

    console.log('Connected to Kafka and RabbitMQ');

    await consumer.run({
        eachMessage: async ({ message }) => {
            const data = JSON.parse(message.value.toString());
            const status = data.vehicle_count > 50 ? 'CONGESTIONADA' : 'FLUIDA';
            
            const update = {
                zone_id: data.zone_id,
                status: status,
                timestamp: new Date().toISOString()
            };

            channel.publish(exchange, '', Buffer.from(JSON.stringify(update)));
            console.log(`Processed: ${data.zone_id} -> ${status}`);
        },
    });
}

run().catch(console.error);
