# Guía de Despliegue en AWS - SmartTraffic Distribuido (5 Zonas)

Esta guía detalla el despliegue de la arquitectura SmartTraffic utilizando **5 instancias EC2** independientes, una por cada zona de seguridad. En este modelo, cada instancia utiliza **Docker Compose** localmente y **nftables** para el control de tráfico entre zonas.

---

## 1. Arquitectura de Zonas

| Instancia | Rol | Servicios (Docker) | Tipo Recomendado |
|-----------|-----|--------------------|------------------|
| **vm-auth** | Identidad | `auth-server` | t3.micro |
| **vm-data** | Datos | `zookeeper`, `kafka`, `rabbitmq` | t3.medium |
| **vm-ingest** | Ingesta | `traffic-sensor` | t3.micro |
| **vm-core** | Cerebro | `density-processor`, `traffic-archiver` | t3.micro |
| **vm-app** | Aplicación | `dashboard-backend`, `alert-dispatcher`, `query-client` | t3.micro |

---

## 2. Configuración de Instancias en AWS

1.  **Lanzar 5 instancias** con Ubuntu 22.04 LTS.
2.  **Red (VPC)**: Asegúrate de que todas estén en la misma VPC para comunicación mediante IPs privadas.
3.  **Security Groups**:
    *   **sg-auth**: Inbound TCP 443 desde las otras 4 instancias.
    *   **sg-data**: Inbound TCP 9092 y 5672 desde las zonas permitidas.
    *   **sg-app**: Inbound TCP 3000 desde 0.0.0.0/0.
    *   **Todos**: Inbound TCP 22 desde tu IP.

---

## 3. Preparación de cada Instancia

En las 5 máquinas, debes realizar lo siguiente:

1.  **Instalar Docker y nftables**:
    ```bash
    sudo apt update && sudo apt upgrade -y
    sudo apt install -y docker.io docker-compose-v2 nftables git
    sudo usermod -aG docker ubuntu
    ```

2.  **Clonar el repositorio**:
    ```bash
    git clone <URL_DEL_REPOSITORIO> trafico
    cd trafico
    ```

---

## 4. Despliegue por Zona

Cada instancia debe ejecutar su propio archivo de configuración ubicado en `infrastructure/deployment/vm-*/`.

### Paso Crítico: Variables de Entorno
Debido a que las instancias están separadas, debes recolectar las **IPs Privadas** de AWS. En cada instancia, crea un archivo `.env` en la carpeta de despliegue correspondiente:

**Ejemplo para `vm-ingest` (`infrastructure/deployment/vm-ingest/.env`):**
```env
AUTH_URL=http://<IP_PRIVADA_VM_AUTH>:443
KAFKA_BROKERS=<IP_PRIVADA_VM_DATA>:9092
```

### Comandos de inicio:
```bash
# En vm-auth
cd infrastructure/deployment/vm-auth
docker compose up -d

# En vm-data
cd infrastructure/deployment/vm-data
docker compose up -d

# En las demás (Ingest, Core, App)
# Asegúrate de haber configurado el .env con las IPs reales primero
docker compose up -d
```

---

## 5. Configuración de Seguridad (nftables)

En cada máquina, aplica el script de firewall correspondiente para restringir el tráfico a nivel de kernel:

```bash
# Ejemplo en vm-data
sudo nft -f infrastructure/firewall/vm-data.nft
```

*Nota: Edita los archivos `.nft` en la carpeta `infrastructure/firewall/` para incluir las IPs específicas de tus instancias EC2 antes de aplicarlos.*

---

## 6. Verificación Zero Trust

1.  **Conectividad**: Desde `vm-ingest`, prueba `telnet <IP_VM_DATA> 9092`. Debe conectar.
2.  **Aislamiento**: Desde `vm-app`, prueba `telnet <IP_VM_DATA> 9092`. Debe ser rechazado por nftables/Security Group.
3.  **Auth**: Revisa los logs de `auth-server` para ver las solicitudes de tokens JWT de los otros servicios.
    ```bash
    docker compose logs -f
    ```

---

## 7. Mantenimiento y Logs

*   **Ver estados**: `docker compose ps` (dentro de la carpeta de la zona).
*   **Logs**: `docker compose logs -f`.
*   **Persistencia**: En `vm-data`, se recomienda montar volúmenes de EBS para los datos de Kafka y RabbitMQ para evitar pérdida de información en reinicios de contenedores.
