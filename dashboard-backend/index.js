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

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Smart Traffic - Control Zero Trust</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Fira+Code:wght@400;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root {
            --bg-base: #030712;
            --bg-surface: rgba(17, 24, 39, 0.7);
            --bg-card: rgba(31, 41, 55, 0.4);
            --border-glow: rgba(255, 255, 255, 0.05);
            --text-main: #f3f4f6;
            --text-muted: #9ca3af;
            --neon-green: #10b981;
            --neon-amber: #fbbf24;
            --neon-red: #ef4444;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Outfit', sans-serif;
            background: radial-gradient(circle at top, #111827, var(--bg-base));
            color: var(--text-main);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            overflow-x: hidden;
        }

        header {
            padding: 1.5rem 2rem;
            background: rgba(3, 7, 18, 0.6);
            backdrop-filter: blur(12px);
            border-bottom: 1px solid var(--border-glow);
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: sticky;
            top: 0;
            z-index: 50;
        }

        .logo-section {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        .logo-section i {
            font-size: 1.8rem;
            color: var(--neon-green);
            text-shadow: 0 0 12px rgba(16, 185, 129, 0.4);
        }

        .logo-section h1 {
            font-size: 1.4rem;
            font-weight: 800;
            letter-spacing: 1px;
            background: linear-gradient(to right, #ffffff, #9ca3af);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .status-badge {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            border-radius: 9999px;
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.2);
            color: var(--neon-green);
            font-size: 0.85rem;
            font-weight: 600;
        }

        .status-dot {
            width: 8px;
            height: 8px;
            background-color: var(--neon-green);
            border-radius: 50%;
            animation: pulse-dot 2s infinite;
        }

        @keyframes pulse-dot {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }

        main {
            flex: 1;
            padding: 2rem;
            max-width: 1400px;
            margin: 0 auto;
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 2rem;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 1.5rem;
        }

        .stat-card {
            background: var(--bg-surface);
            border: 1px solid var(--border-glow);
            backdrop-filter: blur(12px);
            border-radius: 1rem;
            padding: 1.5rem;
            display: flex;
            align-items: center;
            gap: 1.25rem;
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.2);
        }

        .stat-icon {
            width: 48px;
            height: 48px;
            border-radius: 0.75rem;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.4rem;
            background: rgba(255, 255, 255, 0.05);
            color: var(--text-muted);
        }

        .stat-card:nth-child(1) .stat-icon { color: var(--neon-green); background: rgba(16, 185, 129, 0.1); }
        .stat-card:nth-child(2) .stat-icon { color: var(--neon-amber); background: rgba(251, 191, 36, 0.1); }
        .stat-card:nth-child(3) .stat-icon { color: var(--neon-red); background: rgba(239, 68, 68, 0.1); }

        .stat-info h3 {
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-muted);
            margin-bottom: 0.25rem;
        }

        .stat-info p {
            font-size: 1.75rem;
            font-weight: 800;
        }

        .dashboard-layout {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 2rem;
        }

        @media (max-width: 1024px) {
            .dashboard-layout {
                grid-template-columns: 1fr;
            }
        }

        .section-title {
            font-size: 1.2rem;
            font-weight: 700;
            margin-bottom: 1.25rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .zones-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 1.5rem;
        }

        .zone-card {
            background: var(--bg-surface);
            border: 1px solid var(--border-glow);
            backdrop-filter: blur(12px);
            border-radius: 1.25rem;
            padding: 1.75rem;
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
            position: relative;
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.2);
        }

        .zone-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 4px;
            background: var(--text-muted);
            transition: background 0.3s ease;
        }

        .zone-card.status-fluido::before { background: var(--neon-green); }
        .zone-card.status-moderado::before { background: var(--neon-amber); }
        .zone-card.status-congestionado::before { background: var(--neon-red); }

        .zone-card:hover {
            transform: translateY(-5px);
            border-color: rgba(255, 255, 255, 0.15);
            box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.4);
        }

        .zone-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .zone-name {
            font-size: 1.5rem;
            font-weight: 800;
        }

        .zone-indicator {
            padding: 0.35rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .status-fluido .zone-indicator { background: rgba(16, 185, 129, 0.1); color: var(--neon-green); }
        .status-moderado .zone-indicator { background: rgba(251, 191, 36, 0.1); color: var(--neon-amber); }
        .status-congestionado .zone-indicator { background: rgba(239, 68, 68, 0.1); color: var(--neon-red); }

        .metrics-list {
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }

        .metric-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid rgba(255, 255, 255, 0.03);
            padding-bottom: 0.5rem;
        }

        .metric-row:last-child {
            border: none;
            padding: 0;
        }

        .metric-label {
            font-size: 0.85rem;
            color: var(--text-muted);
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .metric-value {
            font-weight: 600;
            font-size: 1.1rem;
        }

        .terminal-panel {
            background: rgba(3, 7, 18, 0.85);
            border: 1px solid var(--border-glow);
            border-radius: 1.25rem;
            display: flex;
            flex-direction: column;
            height: 520px;
            box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.4);
        }

        .terminal-header {
            padding: 0.75rem 1.25rem;
            background: rgba(17, 24, 39, 0.8);
            border-bottom: 1px solid var(--border-glow);
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-top-left-radius: 1.25rem;
            border-top-right-radius: 1.25rem;
        }

        .terminal-dots {
            display: flex;
            gap: 0.35rem;
        }

        .terminal-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
        }

        .terminal-dot:nth-child(1) { background: #ef4444; }
        .terminal-dot:nth-child(2) { background: #fbbf24; }
        .terminal-dot:nth-child(3) { background: #10b981; }

        .terminal-title {
            font-family: 'Fira Code', monospace;
            font-size: 0.8rem;
            color: var(--text-muted);
        }

        .terminal-body {
            flex: 1;
            padding: 1.25rem;
            overflow-y: auto;
            font-family: 'Fira Code', monospace;
            font-size: 0.85rem;
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            color: #34d399;
        }

        .log-entry {
            line-height: 1.4;
            animation: fadeIn 0.3s ease;
        }

        .log-time { color: var(--text-muted); }
        .log-info { color: #38bdf8; }
        .log-success { color: var(--neon-green); }
        .log-warning { color: var(--neon-amber); }
        .log-danger { color: var(--neon-red); }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(4px); }
            to { opacity: 1; transform: translateY(0); }
        }

        footer {
            padding: 2rem;
            text-align: center;
            border-top: 1px solid var(--border-glow);
            font-size: 0.85rem;
            color: var(--text-muted);
            background: rgba(3, 7, 18, 0.4);
            margin-top: auto;
        }

        footer strong {
            color: var(--neon-green);
        }
    </style>
</head>
<body>

    <header>
        <div class="logo-section">
            <i class="fa-solid fa-tower-broadcast"></i>
            <div>
                <h1>SMART TRAFFIC</h1>
                <p style="font-size: 0.65rem; color: var(--text-muted); font-weight: 600; letter-spacing: 0.5px;">MONITOR EN TIEMPO REAL</p>
            </div>
        </div>
        <div class="status-badge">
            <div class="status-dot"></div>
            <span>CONECTADO AL BROKER</span>
        </div>
    </header>

    <main>
        <!-- Stats -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon"><i class="fa-solid fa-car-side"></i></div>
                <div class="stat-info">
                    <h3>Vehículos Procesados</h3>
                    <p id="total-vehicles">0</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="fa-solid fa-gauge-high"></i></div>
                <div class="stat-info">
                    <h3>Velocidad Promedio</h3>
                    <p id="avg-speed">0 km/h</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
                <div class="stat-info">
                    <h3>Zonas en Congestión</h3>
                    <p id="congested-zones">0</p>
                </div>
            </div>
        </div>

        <!-- Main Workspace -->
        <div class="dashboard-layout">
            <!-- Left Side: Zones Status -->
            <div>
                <h2 class="section-title"><i class="fa-solid fa-circle-nodes"></i> Estado de las Zonas de Tráfico</h2>
                <div class="zones-grid">
                    <!-- Zone A -->
                    <div id="card-A" class="zone-card status-fluido">
                        <div class="zone-header">
                            <span class="zone-name">Zona A</span>
                            <span id="badge-A" class="zone-indicator">FLUIDO</span>
                        </div>
                        <div class="metrics-list">
                            <div class="metric-row">
                                <div class="metric-label"><i class="fa-solid fa-car"></i> Vehículos</div>
                                <span id="veh-A" class="metric-value">0</span>
                            </div>
                            <div class="metric-row">
                                <div class="metric-label"><i class="fa-solid fa-gauge"></i> Velocidad</div>
                                <span id="vel-A" class="metric-value">0 km/h</span>
                            </div>
                            <div class="metric-row">
                                <div class="metric-label"><i class="fa-solid fa-clock"></i> Última Act.</div>
                                <span id="time-A" class="metric-value" style="font-size: 0.85rem; color: var(--text-muted);">--:--:--</span>
                            </div>
                        </div>
                    </div>

                    <!-- Zone B -->
                    <div id="card-B" class="zone-card status-fluido">
                        <div class="zone-header">
                            <span class="zone-name">Zona B</span>
                            <span id="badge-B" class="zone-indicator">FLUIDO</span>
                        </div>
                        <div class="metrics-list">
                            <div class="metric-row">
                                <div class="metric-label"><i class="fa-solid fa-car"></i> Vehículos</div>
                                <span id="veh-B" class="metric-value">0</span>
                            </div>
                            <div class="metric-row">
                                <div class="metric-label"><i class="fa-solid fa-gauge"></i> Velocidad</div>
                                <span id="vel-B" class="metric-value">0 km/h</span>
                            </div>
                            <div class="metric-row">
                                <div class="metric-label"><i class="fa-solid fa-clock"></i> Última Act.</div>
                                <span id="time-B" class="metric-value" style="font-size: 0.85rem; color: var(--text-muted);">--:--:--</span>
                            </div>
                        </div>
                    </div>

                    <!-- Zone C -->
                    <div id="card-C" class="zone-card status-fluido">
                        <div class="zone-header">
                            <span class="zone-name">Zona C</span>
                            <span id="badge-C" class="zone-indicator">FLUIDO</span>
                        </div>
                        <div class="metrics-list">
                            <div class="metric-row">
                                <div class="metric-label"><i class="fa-solid fa-car"></i> Vehículos</div>
                                <span id="veh-C" class="metric-value">0</span>
                            </div>
                            <div class="metric-row">
                                <div class="metric-label"><i class="fa-solid fa-gauge"></i> Velocidad</div>
                                <span id="vel-C" class="metric-value">0 km/h</span>
                            </div>
                            <div class="metric-row">
                                <div class="metric-label"><i class="fa-solid fa-clock"></i> Última Act.</div>
                                <span id="time-C" class="metric-value" style="font-size: 0.85rem; color: var(--text-muted);">--:--:--</span>
                            </div>
                        </div>
                    </div>

                    <!-- Zone D -->
                    <div id="card-D" class="zone-card status-fluido">
                        <div class="zone-header">
                            <span class="zone-name">Zona D</span>
                            <span id="badge-D" class="zone-indicator">FLUIDO</span>
                        </div>
                        <div class="metrics-list">
                            <div class="metric-row">
                                <div class="metric-label"><i class="fa-solid fa-car"></i> Vehículos</div>
                                <span id="veh-D" class="metric-value">0</span>
                            </div>
                            <div class="metric-row">
                                <div class="metric-label"><i class="fa-solid fa-gauge"></i> Velocidad</div>
                                <span id="vel-D" class="metric-value">0 km/h</span>
                            </div>
                            <div class="metric-row">
                                <div class="metric-label"><i class="fa-solid fa-clock"></i> Última Act.</div>
                                <span id="time-D" class="metric-value" style="font-size: 0.85rem; color: var(--text-muted);">--:--:--</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Side: Terminal Logs -->
            <div>
                <h2 class="section-title"><i class="fa-solid fa-terminal"></i> Terminal Eventos RabbitMQ</h2>
                <div class="terminal-panel">
                    <div class="terminal-header">
                        <div class="terminal-dots">
                            <div class="terminal-dot"></div>
                            <div class="terminal-dot"></div>
                            <div class="terminal-dot"></div>
                        </div>
                        <div class="terminal-title">rabbitmq-listener@zero-trust</div>
                    </div>
                    <div id="terminal-body" class="terminal-body">
                        <div class="log-entry"><span class="log-time">[${new Date().toLocaleTimeString()}]</span> <span class="log-info">Iniciando escucha de eventos en el clúster...</span></div>
                        <div class="log-entry"><span class="log-time">[${new Date().toLocaleTimeString()}]</span> <span class="log-success">Conexión establecida con el exchange "traffic_updates"</span></div>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <footer>
        <p>Smart Traffic Zero Trust Dashboard - UCC Sexto Semestre. Creado de forma segura con <strong>Zero Trust Architecture</strong>.</p>
    </footer>

    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    <script>
        const socket = io();
        const term = document.getElementById('terminal-body');
        
        let vehiclesCount = 0;
        let speedSum = 0;
        let speedCount = 0;
        const currentStatuses = { A: 'FLUIDO', B: 'FLUIDO', C: 'FLUIDO', D: 'FLUIDO' };

        function updateGlobals() {
            document.getElementById('total-vehicles').innerText = vehiclesCount;
            document.getElementById('avg-speed').innerText = speedCount > 0 ? Math.round(speedSum / speedCount) + ' km/h' : '0 km/h';
            
            let congested = 0;
            for (let z in currentStatuses) {
                if (currentStatuses[z] === 'CONGESTIONADO') congested++;
            }
            document.getElementById('congested-zones').innerText = congested;
        }

        socket.on('connect', () => {
            addTerminalLog('Conectado exitosamente con WebSocket backend', 'success');
        });

        socket.on('disconnect', () => {
            addTerminalLog('Desconectado del WebSocket backend. Intentando reconectar...', 'warning');
        });

        socket.on('traffic_update', (data) => {
            console.log('Update received:', data);
            
            const { zone_id, vehicle_count, avg_speed, density } = data;
            const now = new Date().toLocaleTimeString();

            // Actualizar datos globales
            vehiclesCount += parseInt(vehicle_count || 0);
            speedSum += parseInt(avg_speed || 0);
            speedCount++;

            // Mapear densidad
            let status = 'FLUIDO';
            let cardClass = 'status-fluido';
            let logType = 'success';
            
            if (density === 'CONGESTIONADA' || density === 'CONGESTIONADO') {
                status = 'CONGESTIONADO';
                cardClass = 'status-congestionado';
                logType = 'danger';
            } else if (density === 'MODERADA' || density === 'MODERADO') {
                status = 'MODERADO';
                cardClass = 'status-moderado';
                logType = 'warning';
            }

            currentStatuses[zone_id] = status;

            // Actualizar UI de tarjeta específica
            const card = document.getElementById('card-' + zone_id);
            if (card) {
                card.className = 'zone-card ' + cardClass;
                document.getElementById('badge-' + zone_id).innerText = status;
                document.getElementById('veh-' + zone_id).innerText = vehicle_count;
                document.getElementById('vel-' + zone_id).innerText = avg_speed + ' km/h';
                document.getElementById('time-' + zone_id).innerText = now;
            }

            // Actualizar contadores superiores
            updateGlobals();

            // Imprimir en terminal simulada
            addTerminalLog(`Recibido evento Zona \${zone_id} | Vehículos: \${vehicle_count} | Velocidad: \${avg_speed} km/h | Densidad: \${density}`, logType);
        });

        function addTerminalLog(msg, type = 'info') {
            const time = new Date().toLocaleTimeString();
            let colorClass = 'log-info';
            if (type === 'success') colorClass = 'log-success';
            if (type === 'warning') colorClass = 'log-warning';
            if (type === 'danger') colorClass = 'log-danger';

            const log = document.createElement('div');
            log.className = 'log-entry';
            log.innerHTML = `<span class="log-time">[\${time}]</span> <span class="\${colorClass}">\${msg}</span>`;
            term.appendChild(log);
            term.scrollTop = term.scrollHeight;

            // Mantener últimos 30 logs para no saturar memoria
            while (term.children.length > 30) {
                term.removeChild(term.firstChild);
            }
        }
    </script>
</body>
</html>`;

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

    // Socket.io & HTTP Setup
    const server = http.createServer((req, res) => {
        if (req.method === 'GET' && req.url === '/') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(HTML_CONTENT);
        } else {
            res.writeHead(404);
            res.end();
        }
    });
    
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
