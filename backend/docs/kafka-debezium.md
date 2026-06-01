# Kafka + Debezium Outbox Runtime

The backend uses Kafka as the event backbone. Application services write durable rows to `outbox_events` inside the same database transaction as order, payment, product, and coupon changes. Debezium owns the relay from PostgreSQL WAL to Kafka; application code does not run a scheduled outbox poller.

## Runtime Mode

Kafka/Debezium defaults:

```properties
EVENTS_KAFKA_ENABLED=true
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
EVENTS_KAFKA_ORDER_EVENTS_TOPICS=ecommerce.order.events,ecommerce.ORDER.events
EVENTS_KAFKA_NOTIFICATION_EMAIL_GROUP_ID=notification.email.order
EVENTS_KAFKA_RETRY_MAX_ATTEMPTS=3
EVENTS_KAFKA_RETRY_BACKOFF_MS=1000
EVENTS_KAFKA_DLT_SUFFIX=.DLT
```

`commerce-service` and `catalog-service` only persist `outbox_events`. If Kafka Connect or Debezium is down, new outbox rows remain in PostgreSQL and are streamed when the connector catches up.

## Local/Staging Runtime

Start Kafka, Redis, and Kafka Connect:

```powershell
docker compose --env-file backend/.env -f backend/docker-compose.kafka.yml up -d
```

Pinned local/staging images:

- Kafka: `apache/kafka:4.1.1`
- Debezium Kafka Connect: `quay.io/debezium/connect:3.5.1.Final`

Kafka 4.2.0 is newer, but this project pins Kafka 4.1.1 because Debezium 3.5.1.Final is built and tested against Kafka Connect/Broker 4.1.1.

Register the Debezium connector after editing database credentials:

```powershell
backend/debezium/register-connector.ps1
```

Detailed local steps are in `backend/debezium/README.md`.

## Topic Contract

Current topics:

- `ecommerce.order.events`
- `ecommerce.ORDER.events`
- `ecommerce.catalog.events`
- `ecommerce.PRODUCT.events`
- `ecommerce.COUPON.events`
- `ecommerce.flash-sale.events`

Dead-letter topics use the `.DLT` suffix. For example, failed order notification records land in `ecommerce.order.events.DLT` or `ecommerce.ORDER.events.DLT` after retry exhaustion.

The current `outbox_events.aggregate_type` values are uppercase (`ORDER`, `PRODUCT`, `COUPON`). If Debezium routes directly by `aggregate_type`, the generated topic can be uppercase such as `ecommerce.ORDER.events`. The Kafka email consumer listens to both lower-case and uppercase order topics while the topic naming is normalized.

Long term, add a normalized `topic` column to `outbox_events` or standardize lower-case aggregate types in a migration window.

## Debezium Connector Skeleton

This is the shape for a PostgreSQL Debezium connector using the Outbox Event Router SMT. Fill in credentials through Kafka Connect secrets, not plain committed files.

```json
{
  "name": "ecommerce-outbox-postgres",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "plugin.name": "pgoutput",
    "database.hostname": "${POSTGRES_HOST}",
    "database.port": "5432",
    "database.user": "${POSTGRES_REPLICATION_USER}",
    "database.password": "${POSTGRES_REPLICATION_PASSWORD}",
    "database.dbname": "${POSTGRES_DB}",
    "topic.prefix": "ecommerce",
    "slot.name": "ecommerce_outbox_slot",
    "publication.name": "ecommerce_outbox_publication",
    "publication.autocreate.mode": "disabled",
    "snapshot.mode": "when_needed",
    "table.include.list": "public.outbox_events",
    "tombstones.on.delete": "false",
    "transforms": "outbox",
    "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
    "transforms.outbox.table.field.event.id": "id",
    "transforms.outbox.table.field.event.key": "aggregate_id",
    "transforms.outbox.table.field.event.type": "event_type",
    "transforms.outbox.table.field.event.payload": "payload",
    "transforms.outbox.route.by.field": "aggregate_type",
    "transforms.outbox.route.topic.replacement": "ecommerce.${routedByValue}.events"
  }
}
```

Before enabling this in PostgreSQL/RDS, verify:

- Logical replication is enabled.
- The connector user can use a replication slot/publication.
- WAL retention is monitored, because a stuck connector can grow WAL.
- Consumers are idempotent. Order email delivery uses `notification_deliveries(event_id, consumer_name)` to avoid duplicate sends.
- Use `snapshot.mode=when_needed` for local/staging recovery so Debezium can snapshot the outbox table when a stored WAL offset is no longer available.
- Debezium connects to a PostgreSQL endpoint that supports logical replication. Do not point CDC at PgBouncer or transaction poolers.

Apply these migrations before running commerce-service with `ddl-auto=validate`:

```sql
\i backend/db/phase3_notification_deliveries.sql
\i backend/db/phase3_debezium_publication.sql
```

Debezium does not mark `outbox_events.status = 'published'`. With the Kafka-only runtime, `pending` means "persisted and CDC-owned", not "waiting for an application poller".

## Consumer Responsibilities

Email:

- Kafka listener is enabled by default with `EVENTS_KAFKA_ENABLED=true`.
- The Kafka listener accepts either a direct outbox payload or a raw Debezium envelope.
- Duplicate `ORDER_CREATED`, `ORDER_PAID`, and other order email events are skipped after the first successful or skipped delivery.
- Processing failures are retried by the Kafka listener container and then published to `<topic>.DLT`.

Elasticsearch/OpenSearch sync:

- Add after the search index is introduced.
- Consume product/review/inventory events from Kafka, not from checkout requests.

Payment expiration:

- Kafka does not provide native per-message delayed delivery.
- `ORDER_PAYMENT_PENDING` events are consumed by `PaymentExpirationKafkaConsumer`, which schedules the `paymentId` into a Redis sorted-set using `expiredAt` as the score.
- `PaymentExpirationService` polls only due Redis jobs and calls `PaymentService.expirePaymentIfDue(paymentId, now)`; it does not scan the payments table.
- Expiration is idempotent. Paid, cancelled, non-online, missing, or already-expired payments remove their Redis job without changing state.
- If Redis scheduling fails, the Kafka listener retries and then sends the event to `<topic>.DLT`.

## Operations Checklist

1. Start Kafka and Kafka Connect.
2. Create the Debezium PostgreSQL connector.
3. Start services with `EVENTS_KAFKA_ENABLED=true`.
4. Verify `outbox_events` inserts appear on Kafka topics.
5. Verify `notification_deliveries` records successful, skipped, and failed email events.
6. Verify `ORDER_PAYMENT_PENDING` records create Redis ZSET entries under `PAYMENT_EXPIRATION_QUEUE_REDIS_KEY`.
7. Monitor Kafka consumer lag, DLT topic depth, Kafka Connect connector status, PostgreSQL WAL growth, and Redis payment-expiration queue depth.
