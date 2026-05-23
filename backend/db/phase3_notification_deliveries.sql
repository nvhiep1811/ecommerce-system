-- Apply this before enabling EVENTS_KAFKA_ENABLED=true or before running
-- commerce-service with ddl-auto=validate after the idempotent email consumer change.

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id              bigserial    PRIMARY KEY,
  event_id        varchar(160) NOT NULL,
  consumer_name   varchar(120) NOT NULL,
  event_type      varchar(120),
  aggregate_type  varchar(80),
  aggregate_id    varchar(120),
  recipient_email varchar(255),
  status          varchar(32)  NOT NULL DEFAULT 'processing'
                    CHECK (status IN ('processing', 'sent', 'skipped', 'failed')),
  attempt_count   int          NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error      text,
  payload         jsonb,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now(),
  processed_at    timestamptz,
  CONSTRAINT uk_notification_deliveries_event_consumer UNIQUE(event_id, consumer_name)
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status_updated
  ON notification_deliveries(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_recipient_created
  ON notification_deliveries(recipient_email, created_at DESC);

DROP TRIGGER IF EXISTS trg_notification_deliveries_updated_at ON notification_deliveries;
CREATE TRIGGER trg_notification_deliveries_updated_at
  BEFORE UPDATE ON notification_deliveries FOR EACH ROW EXECUTE FUNCTION set_updated_at();
