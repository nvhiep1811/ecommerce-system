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

Pinned local/staging versions:

- Kafka: `apache/kafka:4.1.1`
- Debezium Kafka Connect: `quay.io/debezium/connect:3.5.1.Final`

This pair is intentionally conservative: Debezium 3.5.1.Final is built and tested against Kafka Connect/Broker 4.1.1.

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

The connector intentionally does not set `transforms.outbox.table.field.event.timestamp`. Debezium's outbox `EventRouter` will use the Debezium event timestamp by default. Do not point this property at `created_at timestamptz`; PostgreSQL `timestamptz` is not emitted as the `INT64` type that the SMT expects for this optional override.

The connector config defaults to `host.docker.internal:5432`, database `ecommerce`, user `postgres`, `database.sslmode=prefer`, and `snapshot.mode=no_data` for Debezium 3.x. Create a local connector config before registering:

```powershell
Copy-Item backend/debezium/ecommerce-outbox-postgres.connector.example.json backend/debezium/ecommerce-outbox-postgres.connector.local.json
```

Edit `backend/debezium/ecommerce-outbox-postgres.connector.local.json` for your local/staging database before registering. This local file is ignored by Git.

For Supabase direct database connections, use the direct database host, database `postgres`, port `5432`, and `database.sslmode=require`. Do not use the pooler URL for Debezium logical replication.

### Supabase IPv6 note

Some Supabase direct database hosts resolve to IPv6 only. Debezium must use the direct database endpoint for logical replication; the Supabase pooler URL is not a safe substitute for CDC.

If connector validation fails with `Network is unreachable` from inside `ecommerce-kafka-connect`, the container likely has no IPv6 route. Use one of these options:

- enable IPv6 networking in Docker Desktop/daemon and recreate the Kafka Connect container. This compose file already enables IPv6 on its default network with a local ULA subnet,
- use a Supabase IPv4 direct connection option if your project/plan provides one,
- run Kafka Connect on a host or VM that has IPv6 egress,
- or test Debezium locally against a local PostgreSQL instance with logical replication enabled.

Docker Desktop steps:

1. Open Docker Desktop.
2. Go to Settings -> Resources -> Network.
3. Set Default networking mode to `Dual IPv4/IPv6`.
4. Set DNS resolution behavior to `Auto` or `IPv4 and IPv6`.
5. Apply & restart Docker Desktop.
6. Recreate the stack:

```powershell
docker compose --env-file backend/.env -f backend/docker-compose.kafka.yml down
docker compose --env-file backend/.env -f backend/docker-compose.kafka.yml up -d
```

Do not commit real database passwords.

## 3. Register Connector

```powershell
backend/debezium/register-connector.ps1
```

Check status:

```powershell
Invoke-RestMethod http://localhost:8084/connectors/ecommerce-outbox-postgres/status
```

If registration fails with `ResponseEnded`, Kafka Connect was likely still starting or rebalancing. The register script waits for `/connectors` before the PUT request, so rerun it after the containers settle.

If the connector is `RUNNING` but the task fails with `Field 'created_at' is not of type INT64`, remove `transforms.outbox.table.field.event.timestamp` from the local connector config and re-register the connector. The property is optional; the default Debezium event timestamp is sufficient for the current outbox flow.

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
