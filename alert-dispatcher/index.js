require('dotenv').config();
const amqp = require('amqplib');
const { getAuthToken } = require('../shared/auth-helper');

const CLIENT_ID = 'alert_dispatcher';
const CLIENT_SECRET = 'secret_alert_111';
const AUTH_URL = process.env.AUTH_URL || 'http://vm-auth:443';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://vm-data:5672';

let stateMap = new Map();

async function run() {
    const token = await getAuthToken(CLIENT_ID, CLIENT_SECRET, AUTH_URL);

    // For local simulation, we might need to fallback to guest/guest 
    // if the broker doesn't support OAuth2 without HTTPS
    let connectionOptions = {
        credentials: amqp.credentials.plain(CLIENT_ID, token)
    };

    if (RABBITMQ_URL.includes('localhost') || process.env.RABBITMQ_BYPASS_OAUTH === 'true') {
        console.log('Local or bypassed environment detected, using guest credentials for RabbitMQ');
        connectionOptions = {}; // Fallback to default guest/guest
    }

    const conn = await amqp.connect(RABBITMQ_URL, connectionOptions);
    const channel = await conn.createChannel();
    
    // Consume updates
    const exchange = 'traffic_updates';
    await channel.assertExchange(exchange, 'fanout', { durable: false });
    const q = await channel.assertQueue('', { exclusive: true });
    channel.bindQueue(q.queue, exchange, '');

    // Query Handling
    const queryQueue = 'query_traffic_queue';
    await channel.assertQueue(queryQueue, { durable: false });

    console.log('Alert Dispatcher waiting for updates and queries...');

    // Process updates
    channel.consume(q.queue, (msg) => {
        const data = JSON.parse(msg.content.toString());
        stateMap.set(data.zone_id, data.status);
        console.log(`Updated state: ${data.zone_id} is ${data.status}`);
    }, { noAck: true });

    // Process queries
    channel.consume(queryQueue, (msg) => {
        const query = JSON.parse(msg.content.toString());
        const zone = query.zone_id;
        const status = stateMap.get(zone) || 'DESCONOCIDO';
        
        const response = {
            zone_id: zone,
            status: status,
            queried_at: new Date().toISOString()
        };

        channel.sendToQueue(msg.properties.replyTo, Buffer.from(JSON.stringify(response)), {
            correlationId: msg.properties.correlationId
        });
        
        console.log(`Answered query for zone ${zone}: ${status}`);
        channel.ack(msg);
    });
}

run().catch(console.error);
