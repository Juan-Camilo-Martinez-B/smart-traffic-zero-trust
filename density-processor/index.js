require('dotenv').config();
const { Kafka } = require('kafkajs');
const amqp = require('amqplib');
const { getAuthToken, getUnsecuredKafkaToken } = require('../shared/auth-helper');

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
            oauthBearerProvider: async () => ({ value: getUnsecuredKafkaToken('admin') })
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
        credentials: amqp.credentials.plain(CLIENT_ID, token)
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
            const vehicleCount = data.vehicle_count;
            let density = 'FLUIDO';
            let speed = data.avg_speed;

            if (vehicleCount > 70) {
                density = 'CONGESTIONADO';
                if (!speed) speed = Math.floor(Math.random() * 15) + 10;
            } else if (vehicleCount > 40) {
                density = 'MODERADO';
                if (!speed) speed = Math.floor(Math.random() * 25) + 25;
            } else {
                density = 'FLUIDO';
                if (!speed) speed = Math.floor(Math.random() * 40) + 50;
            }
            
            const update = {
                zone_id: data.zone_id,
                vehicle_count: vehicleCount,
                avg_speed: speed,
                density: density,
                timestamp: new Date().toISOString()
            };

            channel.publish(exchange, '', Buffer.from(JSON.stringify(update)));
            console.log(`Processed: ${data.zone_id} -> ${density} (Vehicles: ${vehicleCount}, Speed: ${speed} km/h)`);
        },
    });
}

run().catch(console.error);
