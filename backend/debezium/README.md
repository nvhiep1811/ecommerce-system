# Local Kafka + Debezium Outbox

This folder contains the Kafka-only outbox pipeline:

`outbox_events INSERT -> Debezium PostgreSQL connector -> Kafka topic -> commerce-service Kafka consumer`

Use this in local/staging before production so connector lag, DLT behavior, and consumer idempotency can be observed under realistic load.

## 1. Start Kafka and Kafka Connect

From the repository root:

```powershell
docker compose -f backend/docker-compose.kafka.yml up -d
```

Kafka is exposed on `localhost:9092`.
Kafka Connect is exposed on `localhost:8085`.

Pinned local/staging versions:

- Kafka: `apache/kafka:4.1.1`
- Debezium Kafka Connect: `quay.io/debezium/connect:3.5.1.Final`

This pair is intentionally conservative: Debezium 3.5.1.Final is built and tested against Kafka Connect/Broker 4.1.1.

## 2. Prepare PostgreSQL

For PostgreSQL/RDS, logical replication must be enabled and the connector user must be able to use a replication slot and publication.

Apply the notification idempotency table first:

```sql
\i backend/db/phase3_notification_deliveries.sql
```

Then create the outbox publication:

```sql
\i backend/db/phase3_debezium_publication.sql
```

The connector intentionally does not set `transforms.outbox.table.field.event.timestamp`. Debezium's outbox `EventRouter` will use the Debezium event timestamp by default. Do not point this property at `created_at timestamptz`; PostgreSQL `timestamptz` is not emitted as the `INT64` type that the SMT expects for this optional override.

The connector config defaults to `host.docker.internal:5432`, database `ecommerce`, user `postgres`, `database.sslmode=prefer`, and `snapshot.mode=when_needed` for Debezium 3.x. `when_needed` lets Debezium recover with a bounded snapshot if its stored WAL offset is no longer available; the outbox consumers are expected to stay idempotent. Create a local connector config before registering:

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
Invoke-RestMethod http://localhost:8085/connectors/ecommerce-outbox-postgres/status
```

If registration fails with `ResponseEnded`, Kafka Connect was likely still starting or rebalancing. The register script waits for `/connectors` before the PUT request, so rerun it after the containers settle.

If the connector is `RUNNING` but the task fails with `Field 'created_at' is not of type INT64`, remove `transforms.outbox.table.field.event.timestamp` from the local connector config and re-register the connector. The property is optional; the default Debezium event timestamp is sufficient for the current outbox flow.

If the connector is `RUNNING` but the task fails with `the connector is trying to read change stream ... but this is no longer available on the server`, the stored Kafka Connect offset points to a PostgreSQL WAL position that has already been recycled. Keep `snapshot.mode=when_needed`, re-register the connector, and then check status again. If it still fails with the same stale offset, stop the connector and reset its offsets before registering again:

```powershell
Invoke-RestMethod -Method Put http://localhost:8085/connectors/ecommerce-outbox-postgres/stop
Invoke-RestMethod -Method Delete http://localhost:8085/connectors/ecommerce-outbox-postgres/offsets
backend/debezium/register-connector.ps1
```

## 4. Run Commerce Service in Kafka Consumer Mode

Use these env values for the staging test:

```properties
EVENTS_KAFKA_ENABLED=true
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
EVENTS_KAFKA_ORDER_EVENTS_TOPICS=ecommerce.order.events,ecommerce.ORDER.events
EVENTS_KAFKA_RETRY_MAX_ATTEMPTS=3
EVENTS_KAFKA_DLT_SUFFIX=.DLT
```

Then create a COD order or trigger an `ORDER_PAID` webhook. Expected flow:

1. Commerce writes `orders` and `outbox_events`.
2. Debezium streams the outbox insert to Kafka.
3. Commerce Kafka consumers receive the event.
4. `notification_deliveries` prevents duplicate email sends.
5. `ORDER_PAYMENT_PENDING` schedules the payment id into the Redis expiration ZSET.
6. Mail service sends the email once.

## Important Outbox Status Note

Debezium does not update `outbox_events.status` to `published`, so new rows remain `pending`.

In the Kafka-only runtime there is no application outbox poller. Treat `pending` as "persisted and CDC-owned"; use Kafka Connect offsets, connector status, consumer lag, and DLT depth as the operational signal.
