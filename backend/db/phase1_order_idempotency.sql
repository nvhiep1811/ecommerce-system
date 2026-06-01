-- Apply this on an existing database before running commerce-service with ddl-auto=validate.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS client_request_id varchar(80);

CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_user_client_request
  ON orders(user_id, client_request_id)
  WHERE client_request_id IS NOT NULL;
