-- Cleanup for a short-lived Debezium timestamp override experiment.
-- The connector now relies on Debezium's default outbox event timestamp,
-- so this application-owned column is not needed by the current system.

ALTER TABLE public.outbox_events
  DROP COLUMN IF EXISTS event_timestamp_ms;
