require('dotenv').config();
const amqp = require('amqplib');
const { getAuthToken } = require('../shared/auth-helper');
const { v4: uuidv4 } = require('uuid');

const CLIENT_ID = 'query_client';
const CLIENT_SECRET = 'secret_query_222';
const AUTH_URL = process.env.AUTH_URL || 'http://vm-auth:443';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://vm-data:5672';

async function run() {
    const token = await getAuthToken(CLIENT_ID, CLIENT_SECRET, AUTH_URL);

    let rabbitOptions = { credentials: amqp.credentials.plain(CLIENT_ID, token) };
    if (RABBITMQ_URL.includes('localhost') || process.env.RABBITMQ_BYPASS_OAUTH === 'true') {
        rabbitOptions = {};
    }

    const conn = await amqp.connect(RABBITMQ_URL, rabbitOptions);
    const channel = await conn.createChannel();
    
    const replyQueue = await channel.assertQueue('', { exclusive: true });
    const queryQueue = 'query_traffic_queue';

    const zones = ['A', 'B', 'C', 'D'];

    setInterval(() => {
        const zone = zones[Math.floor(Math.random() * zones.length)];
        const correlationId = uuidv4();

        console.log(`[QUERY] Asking for status of zone ${zone}...`);

        channel.sendToQueue(queryQueue, Buffer.from(JSON.stringify({ zone_id: zone })), {
            correlationId: correlationId,
            replyTo: replyQueue.queue
        });
    }, 10000);

    channel.consume(replyQueue.queue, (msg) => {
        const response = JSON.parse(msg.content.toString());
        console.log(`[RESPONSE] Zone ${response.zone_id} is currently: ${response.status}`);
    }, { noAck: true });
}

run().catch(console.error);
