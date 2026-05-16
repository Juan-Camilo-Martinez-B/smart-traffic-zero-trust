# SmartTraffic - Zona Cero (Zero Trust)

Este proyecto implementa un sistema de monitoreo de tráfico inteligente con una arquitectura de red de Confianza Cero. Cada componente está aislado en su propia Zona de Seguridad (VM) y todas las comunicaciones están autenticadas mediante JWT y bloqueadas por reglas estrictas de firewall (nftables).

## Arquitectura de Zonas

1.  **vm-auth (Zona de Autoridad)**: Emite tokens JWT para autenticación de servicio a servicio (S2S).
2.  **vm-data (Zona de Datos)**: Contiene los brokers de mensajería (Kafka y RabbitMQ). Es el núcleo del sistema.
3.  **vm-ingest (Zona de Ingesta)**: Simuladores de sensores que generan datos crudos de tráfico.
4.  **vm-core (Zona de Procesamiento)**: El cerebro del sistema que analiza la densidad y archiva datos.
5.  **vm-app (Zona de Aplicación)**: Interfaz de usuario, alertas y consultas.

## Tecnologías Utilizadas

*   **Node.js**: Microservicios y Servidor de Autenticación.
*   **Kafka**: Ingesta de eventos de alta velocidad (Raw Data).
*   **RabbitMQ**: Distribución de estado procesado y mensajería RPC.
*   **JWT (JSON Web Tokens)**: Autenticación obligatoria en cada conexión.
*   **nftables**: Firewall de red con política de "denegación por defecto".
*   **Vagrant**: Orquestación de infraestructura local.
*   **Docker**: Contenedores para brokers y servicios.

## Seguridad Zero Trust

### Autenticación S2S
Cada microservicio debe obtener un token del `auth-server` antes de comunicarse con cualquier broker. Los brokers están configurados para validar estos tokens:
*   **Kafka**: SASL/OAUTHBEARER.
*   **RabbitMQ**: rabbitmq_auth_backend_oauth2.

### Aislamiento de Red (nftables)
Cada VM tiene una política de `DROP` por defecto. Solo se permite el tráfico estrictamente necesario definido en los archivos `.nft` en `infrastructure/nftables/`.

## Cómo Empezar

### Requisitos
*   Vagrant
*   VirtualBox
*   Ansible (opcional, para despliegue avanzado)

### Despliegue Local
1.  Clonar el repositorio.
2.  Ejecutar `vagrant up` para levantar las 5 VMs.
3.  Los scripts de provisión instalarán Docker y configurarán nftables automáticamente.

### Despliegue en AWS
Ver [aws_guide.md](./aws_guide.md) para instrucciones detalladas sobre Grupos de Seguridad y VPC.

## Flujo de Datos Seguro
1.  `traffic_sensor` solicita JWT a `vm-auth`.
2.  `traffic_sensor` envía datos a `vm-data:9092` (Kafka) usando el JWT.
3.  `density_processor` solicita JWT, consume de Kafka y publica en `vm-data:5672` (RabbitMQ).
4.  `alert_dispatcher` solicita JWT y consume de RabbitMQ para alertar al dashboard.
