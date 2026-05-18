require('dotenv').config();
const amqp = require('amqplib');
const { getAuthToken } = require('../shared/auth-helper');
const http = require('http');
const { Server } = require('socket.io');

const CLIENT_ID = 'dashboard_backend';
const CLIENT_SECRET = 'secret_dashboard_000';
const AUTH_URL = process.env.AUTH_URL || 'http://vm-auth:443';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://vm-data:5672';
const PORT = process.env.PORT || 3000;

async function run() {
    console.log(`Starting ${CLIENT_ID}...`);
    const token = await getAuthToken(CLIENT_ID, CLIENT_SECRET, AUTH_URL);

    // RabbitMQ Setup
    let rabbitOptions = { credentials: amqp.credentials.plain(CLIENT_ID, token) };
    if (RABBITMQ_URL.includes('localhost') || process.env.RABBITMQ_BYPASS_OAUTH === 'true') {
        rabbitOptions = {};
    }

    const conn = await amqp.connect(RABBITMQ_URL, rabbitOptions);
    const channel = await conn.createChannel();
    const exchange = 'traffic_updates';
    await channel.assertExchange(exchange, 'fanout', { durable: false });
    const q = await channel.assertQueue('', { exclusive: true });
    channel.bindQueue(q.queue, exchange, '');

    // Socket.io Setup
    const server = http.createServer();
    const io = new Server(server, { cors: { origin: "*" } });

    channel.consume(q.queue, (msg) => {
        const data = JSON.parse(msg.content.toString());
        io.emit('traffic_update', data);
        console.log('Update broadcasted to dashboard');
    }, { noAck: true });

    server.listen(PORT, () => {
        console.log(`Dashboard Backend running on port ${PORT}`);
    });
}

run().catch(console.error);
