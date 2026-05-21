# Kafka + Debezium Outbox Rollout

This project already writes durable events to `outbox_events` inside the same transaction as order, payment, product, and coupon changes. Kafka should take over the relay layer gradually, not replace RabbitMQ in one deployment.

## Current Safe Modes

RabbitMQ default:

```properties
OUTBOX_RELAY_ENABLED=true
EVENTS_RABBIT_ENABLED=true
EVENTS_KAFKA_ENABLED=false
```

Debezium/Kafka email consumer test:

```properties
OUTBOX_RELAY_ENABLED=false
EVENTS_RABBIT_ENABLED=false
EVENTS_KAFKA_ENABLED=true
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
EVENTS_KAFKA_ORDER_EVENTS_TOPICS=ecommerce.order.events,ecommerce.ORDER.events
EVENTS_KAFKA_NOTIFICATION_EMAIL_GROUP_ID=notification.email.order
```

`OUTBOX_RELAY_ENABLED=false` is important when Debezium owns the relay. It prevents the old `@Scheduled` relay from also publishing the same event.

## Local/Staging Runtime

Start Kafka and Kafka Connect:

```powershell
docker compose -f backend/docker-compose.kafka.yml up -d
```

Register the Debezium connector after editing database credentials:

```powershell
backend/debezium/register-connector.ps1
```

Detailed local steps are in `backend/debezium/README.md`.

## Topic Contract

Recommended topics:

- `ecommerce.order.events`
- `ecommerce.catalog.events`
- `ecommerce.inventory.events`
- `ecommerce.payment.events`

The current `outbox_events.aggregate_type` values are uppercase (`ORDER`, `PRODUCT`, `COUPON`). If Debezium routes directly by `aggregate_type`, the generated topic can be uppercase such as `ecommerce.ORDER.events`. The Kafka email consumer listens to both `ecommerce.order.events` and `ecommerce.ORDER.events` by default during the transition.

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

Before enabling this in Supabase/PostgreSQL, verify:

- Logical replication is enabled.
- The connector user can use a replication slot/publication.
- WAL retention is monitored, because a stuck connector can grow WAL.
- The consumer group has idempotent handlers. Order email delivery now uses `notification_deliveries(event_id, consumer_name)` to avoid duplicate sends.

Apply this migration before enabling Kafka/Debezium or running commerce-service with `ddl-auto=validate`:

```sql
\i backend/db/phase3_notification_deliveries.sql
\i backend/db/phase3_debezium_publication.sql
```

Debezium does not mark `outbox_events.status = 'published'`. If `OUTBOX_RELAY_ENABLED=false`, Debezium-owned rows remain `pending`; do not re-enable the old RabbitMQ scheduled relay on that same database without first archiving, deleting, or marking those rows according to an explicit replay policy.

## Consumer Responsibilities

Email:

- Rabbit listener remains the default path.
- Kafka listener is disabled by default and enabled with `EVENTS_KAFKA_ENABLED=true`.
- The Kafka listener accepts either a direct business payload or a raw Debezium envelope.
- Duplicate `ORDER_CREATED`, `ORDER_PAID`, and other order email events are skipped after the first successful or skipped delivery.

Elasticsearch/OpenSearch sync:

- Add after the search index is introduced.
- Consume product/review/inventory events from Kafka, not from checkout requests.

Payment expiration:

- Keep the current payment expiration scheduler for now.
- Kafka does not provide native per-message delayed delivery.
- Move this only after choosing Redis key expiry, a delay-topic pattern, or a dedicated delayed-job service.

## Cutover Checklist

1. Start Kafka and Kafka Connect.
2. Create the Debezium PostgreSQL connector.
3. Enable `EVENTS_KAFKA_ENABLED=true` on `commerce-service`.
4. Temporarily keep Rabbit path in a staging environment and compare delivered email events.
5. Set `OUTBOX_RELAY_ENABLED=false` when Debezium relay is confirmed.
6. Set `EVENTS_RABBIT_ENABLED=false` only when Kafka consumers are stable.
7. Add alerts for Kafka consumer lag, Kafka Connect connector status, and PostgreSQL WAL growth.
