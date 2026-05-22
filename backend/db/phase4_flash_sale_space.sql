-- Phase 4A: flash sale metadata and eventual sync tables.
-- The high-concurrency reservation hot path is Redis + Lua + Kafka.
-- PostgreSQL stores campaign metadata and receives reservation facts from the data pump.

CREATE TABLE IF NOT EXISTS flash_sale_campaigns (
  id          bigserial    PRIMARY KEY,
  name        varchar(160) NOT NULL,
  status      varchar(30)  NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'scheduled', 'active', 'ended', 'cancelled')),
  starts_at   timestamptz  NOT NULL,
  ends_at     timestamptz  NOT NULL,
  version     bigint       NOT NULL DEFAULT 0,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT ck_flash_sale_campaigns_time_range
    CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_flash_sale_campaigns_status_time
  ON flash_sale_campaigns(status, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS flash_sale_items (
  id             bigserial      PRIMARY KEY,
  campaign_id    bigint         NOT NULL REFERENCES flash_sale_campaigns(id) ON DELETE CASCADE,
  product_id     bigint         NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id     bigint         REFERENCES product_variants(id) ON DELETE RESTRICT,
  sale_price     numeric(12,2)  NOT NULL CHECK (sale_price >= 0),
  stock_limit    int            NOT NULL CHECK (stock_limit >= 0),
  per_user_limit int            NOT NULL DEFAULT 1 CHECK (per_user_limit > 0),
  reserved_count int            NOT NULL DEFAULT 0 CHECK (reserved_count >= 0),
  sold_count     int            NOT NULL DEFAULT 0 CHECK (sold_count >= 0),
  status         varchar(30)    NOT NULL DEFAULT 'scheduled'
                   CHECK (status IN ('scheduled', 'active', 'sold_out', 'ended', 'cancelled')),
  version        bigint         NOT NULL DEFAULT 0,
  created_at     timestamptz    NOT NULL DEFAULT now(),
  updated_at     timestamptz    NOT NULL DEFAULT now(),
  CONSTRAINT fk_flash_sale_items_variant_belongs_to_product
    FOREIGN KEY (product_id, variant_id)
    REFERENCES product_variants(product_id, id)
    DEFERRABLE INITIALLY IMMEDIATE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_flash_sale_items_campaign_product_variant
  ON flash_sale_items(campaign_id, product_id, COALESCE(variant_id, -1));
CREATE INDEX IF NOT EXISTS idx_flash_sale_items_campaign_status
  ON flash_sale_items(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_flash_sale_items_product_variant
  ON flash_sale_items(product_id, variant_id);

CREATE TABLE IF NOT EXISTS flash_sale_reservations (
  id                bigserial    PRIMARY KEY,
  campaign_id       bigint       NOT NULL REFERENCES flash_sale_campaigns(id) ON DELETE CASCADE,
  item_id           bigint       NOT NULL REFERENCES flash_sale_items(id) ON DELETE CASCADE,
  user_id           uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id        varchar(120) NOT NULL,
  reservation_token varchar(120) NOT NULL UNIQUE,
  quantity          int          NOT NULL CHECK (quantity > 0),
  status            varchar(30)  NOT NULL DEFAULT 'reserved'
                      CHECK (status IN ('reserved', 'confirmed', 'released', 'expired')),
  expires_at        timestamptz  NOT NULL,
  confirmed_at      timestamptz,
  released_at       timestamptz,
  order_id          bigint       REFERENCES orders(id) ON DELETE SET NULL,
  version           bigint       NOT NULL DEFAULT 0,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_flash_sale_reservations_request
  ON flash_sale_reservations(campaign_id, item_id, user_id, request_id);
CREATE INDEX IF NOT EXISTS idx_flash_sale_reservations_status_expires
  ON flash_sale_reservations(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_flash_sale_reservations_user_created
  ON flash_sale_reservations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flash_sale_reservations_item_status
  ON flash_sale_reservations(item_id, status);
CREATE INDEX IF NOT EXISTS idx_flash_sale_reservations_campaign_item_status
  ON flash_sale_reservations(campaign_id, item_id, status);

DROP TRIGGER IF EXISTS trg_flash_sale_campaigns_updated_at ON flash_sale_campaigns;
CREATE TRIGGER trg_flash_sale_campaigns_updated_at
  BEFORE UPDATE ON flash_sale_campaigns FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_flash_sale_items_updated_at ON flash_sale_items;
CREATE TRIGGER trg_flash_sale_items_updated_at
  BEFORE UPDATE ON flash_sale_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_flash_sale_reservations_updated_at ON flash_sale_reservations;
CREATE TRIGGER trg_flash_sale_reservations_updated_at
  BEFORE UPDATE ON flash_sale_reservations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
