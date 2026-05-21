-- Apply this when Kafka Connect/Debezium will own the outbox relay.
-- Requires PostgreSQL logical replication support and a user with privileges
-- to create or modify the publication.

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
