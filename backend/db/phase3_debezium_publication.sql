-- Apply this when Kafka Connect/Debezium will own the outbox relay.
-- Requires PostgreSQL logical replication support and a user with privileges
-- to create or modify the publication.

ALTER TABLE public.outbox_events
  ADD COLUMN IF NOT EXISTS event_timestamp_ms bigint;

UPDATE public.outbox_events
SET event_timestamp_ms = floor(extract(epoch from created_at) * 1000)::bigint
WHERE event_timestamp_ms IS NULL;

ALTER TABLE public.outbox_events
  ALTER COLUMN event_timestamp_ms SET DEFAULT floor(extract(epoch from now()) * 1000)::bigint;

ALTER TABLE public.outbox_events
  ALTER COLUMN event_timestamp_ms SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'ecommerce_outbox_publication'
  ) THEN
    CREATE PUBLICATION ecommerce_outbox_publication;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication publication
    JOIN pg_publication_rel publication_rel
      ON publication_rel.prpubid = publication.oid
    JOIN pg_class relation
      ON relation.oid = publication_rel.prrelid
    JOIN pg_namespace namespace
      ON namespace.oid = relation.relnamespace
    WHERE publication.pubname = 'ecommerce_outbox_publication'
      AND namespace.nspname = 'public'
      AND relation.relname = 'outbox_events'
  ) THEN
    ALTER PUBLICATION ecommerce_outbox_publication ADD TABLE public.outbox_events;
  END IF;
END $$;
