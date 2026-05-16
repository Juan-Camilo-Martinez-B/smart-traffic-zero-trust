# Guía de Pruebas - SmartTraffic Zero Trust

Parece que no tienes Vagrant instalado o configurado en tu PATH. No te preocupes, puedes probar el sistema localmente usando Docker y Node.js directamente.

## Opción A: Prueba Local (Sin Máquinas Virtuales)
Usa esta opción si quieres probar la lógica del sistema rápidamente en tu máquina.

### 1. Iniciar Brokers (Kafka y RabbitMQ)
Abre una terminal de PowerShell en la raíz del proyecto y ejecuta:
```powershell
# Instalar dependencias base necesarias para los helpers
npm install axios dotenv

# Iniciar contenedores
docker-compose -f docker-compose.dev.yml up -d
```

### 2. Iniciar los Microservicios
Abre una terminal diferente para cada uno de estos comandos (en el orden indicado):

1.  **Auth Server** (Simula vm-auth):
    ```powershell
    cd auth-server
    node index.js
    ```
2.  **Alert Dispatcher** (Simula vm-app):
    ```powershell
    $env:AUTH_URL="http://localhost:443"
    $env:RABBITMQ_URL="amqp://localhost:5672"
    cd alert-dispatcher
    node index.js
    ```
3.  **Density Processor** (Simula vm-core):
    ```powershell
    $env:AUTH_URL="http://localhost:443"
    $env:KAFKA_BROKER="localhost:9092"
    $env:RABBITMQ_URL="amqp://localhost:5672"
    cd density-processor
    node index.js
    ```
4.  **Traffic Sensor** (Simula vm-ingest):
    ```powershell
    $env:AUTH_URL="http://localhost:443"
    $env:KAFKA_BROKER="localhost:9092"
    cd traffic-sensor
    node index.js
    ```

---

## Opción B: Prueba con Infraestructura (Vagrant)
Usa esta opción para validar las reglas de firewall (nftables) y aislamiento real.

## 2. Pruebas de Red (Zero Trust - nftables)
En un entorno Zero Trust, lo primero es validar que el firewall bloquea lo que debe.

*   **Prueba de Bloqueo**: Entra a `vm-app` e intenta conectar a Kafka en `vm-data` (esto no está permitido por nftables).
    ```bash
    vagrant ssh vm-app
    nc -zv 10.0.0.100 9092
    # Resultado esperado: Connection refused o Timeout (Bloqueado)
    ```
*   **Prueba de Permiso**: Entra a `vm-ingest` e intenta conectar a Kafka (esto sí está permitido).
    ```bash
    vagrant ssh vm-ingest
    nc -zv 10.0.0.100 9092
    # Resultado esperado: Connection succeeded!
    ```

## 3. Pruebas de Autenticación (JWT)
Validaremos que el `auth-server` emite tokens y que los brokers los exigen.

*   **Obtener Token Manualmente**:
    Desde cualquier VM permitida (ej. `vm-ingest`):
    ```bash
    curl -X POST http://10.0.0.5:443/token \
      -H "Content-Type: application/json" \
      -d '{"client_id": "sensor_simulator", "client_secret": "secret_sensor_123"}'
    # Resultado esperado: Un JSON con el access_token.
    ```
*   **Intento Fallido (Credenciales Incorrectas)**:
    ```bash
    curl -i -X POST http://10.0.0.5:443/token \
      -H "Content-Type: application/json" \
      -d '{"client_id": "hacker", "client_secret": "wrong"}'
    # Resultado esperado: HTTP 401 Unauthorized.
    ```

## 4. Pruebas de Flujo de Datos Completo
Para ver el sistema en acción, inicia los servicios en este orden:

1.  **Auth Server** (vm-auth): `node auth-server/index.js`
2.  **Brokers** (vm-data): Asegúrate de que los contenedores Docker de Kafka y RabbitMQ estén corriendo con las configuraciones de `infrastructure/broker-configs/`.
3.  **Consumidores** (vm-core, vm-app):
    - `node alert-dispatcher/index.js`
    - `node density-processor/index.js`
4.  **Productor** (vm-ingest):
    - `node traffic-sensor/index.js`

### Verificación de Logs:
*   En `vm-ingest`: Deberías ver logs de "Sent: { zone_id: 'A', ... }".
*   En `vm-core`: Deberías ver "Processed: A -> CONGESTIONADA".
*   En `vm-app`: Deberías ver "Updated state: A is CONGESTIONADA".

## 5. Pruebas en AWS
Si estás probando en AWS, utiliza los comandos equivalentes reemplazando las IPs de Vagrant por las IPs privadas de tus instancias EC2 y asegúrate de que los **Security Groups** reflejen las reglas de [aws_guide.md](./aws_guide.md).
