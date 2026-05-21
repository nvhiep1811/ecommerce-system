# Local Kafka + Debezium Outbox

This folder contains the first runnable Phase 3 pipeline:

`outbox_events INSERT -> Debezium PostgreSQL connector -> Kafka topic -> commerce-service Kafka consumer`

RabbitMQ remains the default production path. Use this only in local/staging until the connector and consumers are observed under real load.

## 1. Start Kafka and Kafka Connect

From the repository root:

```powershell
docker compose -f backend/docker-compose.kafka.yml up -d
```

Kafka is exposed on `localhost:9092`.
Kafka Connect is exposed on `localhost:8084`.

## 2. Prepare PostgreSQL

For a local PostgreSQL database, logical replication must be enabled. For Supabase, enable logical replication/replication slot support in the project settings or via the supported Supabase path.

Apply the notification idempotency table first:

```sql
\i backend/db/phase3_notification_deliveries.sql
```

Then create the outbox publication:

```sql
\i backend/db/phase3_debezium_publication.sql
```

The connector config defaults to `host.docker.internal:5432`, database `ecommerce`, user `postgres`. Create a local connector config before registering:

```powershell
Copy-Item backend/debezium/ecommerce-outbox-postgres.connector.example.json backend/debezium/ecommerce-outbox-postgres.connector.local.json
```

Edit `backend/debezium/ecommerce-outbox-postgres.connector.local.json` for your local/staging database before registering. This local file is ignored by Git.

Do not commit real database passwords.

## 3. Register Connector

```powershell
backend/debezium/register-connector.ps1
```

Check status:

```powershell
Invoke-RestMethod http://localhost:8084/connectors/ecommerce-outbox-postgres/status
```

## 4. Run Commerce Service in Kafka Consumer Mode

Use these env values for the staging test:

```properties
OUTBOX_RELAY_ENABLED=false
EVENTS_RABBIT_ENABLED=false
EVENTS_KAFKA_ENABLED=true
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
EVENTS_KAFKA_ORDER_EVENTS_TOPICS=ecommerce.order.events,ecommerce.ORDER.events
```

Then create a COD order or trigger an `ORDER_PAID` webhook. Expected flow:

1. Commerce writes `orders` and `outbox_events`.
2. Debezium streams the outbox insert to Kafka.
3. Commerce Kafka consumer receives the event.
4. `notification_deliveries` prevents duplicate email sends.
5. Mail service sends the email once.

## Important Cutover Warning

Debezium does not update `outbox_events.status` to `published`. When `OUTBOX_RELAY_ENABLED=false`, new rows will remain `pending`.

Do not later re-enable the old scheduled RabbitMQ relay on the same database unless you first decide how to archive/delete/mark Debezium-owned outbox rows. Re-enabling it blindly can replay old events.
