-- =============================================================
-- SCHEMA TỔNG HỢP CUỐI CÙNG
-- E-Commerce Spring Boot (Shared Database)
-- Gộp từ:
--   springboot_service_based_revised_schema_hardened_v2_final.sql  (base)
--   V002__backfill_address_ward_district_country.sql               (data migration)
--   V003__sepay_payment_methods_notifications.sql                  (payment extension)
--   V004__qr_payment_image_base64.sql                              (qr image)
--   V005__vietqr_payment_metadata.sql                              (vietqr metadata)
--
-- Ghi chú:
--   * V003/V004/V005 đều là ALTER TABLE → đã merge vào CREATE TABLE tương ứng
--   * V002 là data migration → giữ nguyên ở cuối file dưới section riêng
--   * Constraints cũ bị V003 drop đã được thay bằng phiên bản mới nhất
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================
-- 0. COMMON FUNCTION
-- =============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- 1. USER DOMAIN  (Owner: User Service)
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext       NOT NULL UNIQUE,
  password_hash varchar(255),
  full_name     varchar(150) NOT NULL,
  phone_number  varchar(30),
  avatar_url    text,
  status        varchar(30)  NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'inactive', 'blocked')),
  is_verified   boolean      NOT NULL DEFAULT false,
  version       bigint       NOT NULL DEFAULT 0,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
  code        varchar(30) PRIMARY KEY,
  description text
);

INSERT INTO roles(code, description)
VALUES
  ('CUSTOMER', 'Customer role'),
  ('ADMIN',    'Administrator role'),
  ('SELLER',   'Seller role')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_roles (
  user_id   uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_code varchar(30) NOT NULL REFERENCES roles(code) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_code)
);

-- Địa chỉ: ward + district + country đã có từ base schema
-- (V002 chỉ là data backfill cho dữ liệu cũ, không thêm cột mới)
CREATE TABLE IF NOT EXISTS addresses (
  id             bigserial    PRIMARY KEY,
  user_id        uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_name  varchar(150) NOT NULL,
  receiver_phone varchar(30)  NOT NULL,
  address_line   text         NOT NULL,
  ward           varchar(120),
  district       varchar(120),
  city           varchar(120) NOT NULL,
  province       varchar(120),
  postal_code    varchar(20),
  country        varchar(120) NOT NULL DEFAULT 'Vietnam',
  is_default     boolean      NOT NULL DEFAULT false,
  version        bigint       NOT NULL DEFAULT 0,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now()
);

-- Mỗi user chỉ có 1 địa chỉ mặc định
CREATE UNIQUE INDEX IF NOT EXISTS uq_addresses_default_per_user
  ON addresses(user_id)
  WHERE is_default = true;

-- Chỉ lưu token, KHÔNG bao giờ lưu số thẻ/CVV thô
CREATE TABLE IF NOT EXISTS customer_payment_methods (
  id              bigserial   PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method_type     varchar(30) NOT NULL
                    CHECK (method_type IN ('CARD', 'BANK_TRANSFER', 'VNPAY', 'MOMO', 'PAYPAL')),
  provider        varchar(80),
  provider_token  varchar(255),
  masked_account  varchar(50),
  expiry_month    int         CHECK (expiry_month IS NULL OR expiry_month BETWEEN 1 AND 12),
  expiry_year     int         CHECK (expiry_year IS NULL OR expiry_year >= 2000),
  is_default      boolean     NOT NULL DEFAULT false,
  version         bigint      NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_payment_default_per_user
  ON customer_payment_methods(user_id)
  WHERE is_default = true;

-- =============================================================
-- 2. CATALOG DOMAIN  (Owner: Product Catalog Service)
-- =============================================================
CREATE TABLE IF NOT EXISTS brands (
  id          bigserial    PRIMARY KEY,
  name        varchar(120) NOT NULL UNIQUE,
  description text,
  logo_url    text,
  version     bigint       NOT NULL DEFAULT 0,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id          bigserial    PRIMARY KEY,
  parent_id   bigint       REFERENCES categories(id) ON DELETE SET NULL,
  name        varchar(120) NOT NULL,
  slug        varchar(150) NOT NULL UNIQUE,
  description text,
  image_url   text,
  is_active   boolean      NOT NULL DEFAULT true,
  version     bigint       NOT NULL DEFAULT 0,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id                bigserial      PRIMARY KEY,
  category_id       bigint         REFERENCES categories(id) ON DELETE SET NULL,
  brand_id          bigint         REFERENCES brands(id) ON DELETE SET NULL,
  seller_id         uuid           REFERENCES users(id) ON DELETE SET NULL,
  product_type      varchar(20)    NOT NULL DEFAULT 'simple'
                      CHECK (product_type IN ('simple', 'variant')),
  sku               varchar(80),
  name              varchar(255)   NOT NULL,
  slug              varchar(300)   UNIQUE,
  short_description text,
  description       text,
  thumbnail_url     text,
  base_price        numeric(12,2),
  active            boolean        NOT NULL DEFAULT true,
  published         boolean        NOT NULL DEFAULT true,
  published_at      timestamptz,
  deleted_at        timestamptz,
  rating_avg        numeric(3,2)   NOT NULL DEFAULT 0 CHECK (rating_avg BETWEEN 0 AND 5),
  review_count      int            NOT NULL DEFAULT 0  CHECK (review_count >= 0),
  version           bigint         NOT NULL DEFAULT 0,
  created_at        timestamptz    NOT NULL DEFAULT now(),
  updated_at        timestamptz    NOT NULL DEFAULT now(),
  CONSTRAINT ck_products_base_price_non_negative
    CHECK (base_price IS NULL OR base_price >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_products_sku
  ON products(sku) WHERE sku IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_category_id         ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand_id            ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_seller_id           ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_active_published_not_deleted
  ON products(active, published) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_published_at        ON products(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm_published
  ON products USING gin (lower(name) gin_trgm_ops)
  WHERE active = true AND published = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_published_sort_created
  ON products(created_at DESC)
  WHERE active = true AND published = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_published_sort_rating
  ON products(rating_avg DESC, created_at DESC)
  WHERE active = true AND published = true AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS product_images (
  id          bigserial   PRIMARY KEY,
  product_id  bigint      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url   text        NOT NULL,
  is_main     boolean     NOT NULL DEFAULT false,
  sort_order  int         NOT NULL DEFAULT 1 CHECK (sort_order > 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_images_main_per_product
  ON product_images(product_id) WHERE is_main = true;

CREATE TABLE IF NOT EXISTS attributes (
  id   bigserial    PRIMARY KEY,
  name varchar(120) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS attribute_values (
  id           bigserial    PRIMARY KEY,
  attribute_id bigint       NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
  value        varchar(120) NOT NULL,
  UNIQUE(attribute_id, value)
);

CREATE TABLE IF NOT EXISTS product_variants (
  id           bigserial      PRIMARY KEY,
  product_id   bigint         NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku          varchar(80)    UNIQUE,
  combination  jsonb          NOT NULL,
  variant_name varchar(255),
  price        numeric(12,2)  NOT NULL CHECK (price >= 0),
  active       boolean        NOT NULL DEFAULT true,
  thumbnail_url text,
  version      bigint         NOT NULL DEFAULT 0,
  created_at   timestamptz    NOT NULL DEFAULT now(),
  updated_at   timestamptz    NOT NULL DEFAULT now()
);

-- Composite unique để hỗ trợ composite FK từ cart/order/inventory
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_variants_product_id_id
  ON product_variants(product_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_variants_combination_per_product
  ON product_variants(product_id, combination);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id
  ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id_active
  ON product_variants(product_id, active);

CREATE TABLE IF NOT EXISTS product_variant_images (
  id          bigserial   PRIMARY KEY,
  variant_id  bigint      NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  image_url   text        NOT NULL,
  is_main     boolean     NOT NULL DEFAULT false,
  sort_order  int         NOT NULL DEFAULT 1 CHECK (sort_order > 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_variant_images_main_per_variant
  ON product_variant_images(variant_id) WHERE is_main = true;

CREATE TABLE IF NOT EXISTS product_attribute_values (
  product_id         bigint NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  attribute_value_id bigint NOT NULL REFERENCES attribute_values(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, attribute_value_id)
);

-- =============================================================
-- 3. INVENTORY DOMAIN  (Owner: Inventory Service)
-- =============================================================
-- variant_id NULL  → hàng tồn kho của sản phẩm đơn giản
-- variant_id NOT NULL → hàng tồn kho theo variant
CREATE TABLE IF NOT EXISTS inventory_items (
  id            bigserial   PRIMARY KEY,
  product_id    bigint      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id    bigint      REFERENCES product_variants(id) ON DELETE CASCADE,
  available_qty int         NOT NULL DEFAULT 0 CHECK (available_qty >= 0),
  reserved_qty  int         NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
  safety_stock  int         NOT NULL DEFAULT 0 CHECK (safety_stock >= 0),
  version       bigint      NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_inventory_items_variant_belongs_to_product
    FOREIGN KEY (product_id, variant_id)
    REFERENCES product_variants(product_id, id)
    DEFERRABLE INITIALLY IMMEDIATE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_simple_product
  ON inventory_items(product_id) WHERE variant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_variant
  ON inventory_items(product_id, variant_id) WHERE variant_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS inventory_reservations (
  id          bigserial   PRIMARY KEY,
  order_id    bigint,
  product_id  bigint      NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id  bigint      REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity    int         NOT NULL CHECK (quantity > 0),
  status      varchar(30) NOT NULL DEFAULT 'reserved'
                CHECK (status IN ('reserved', 'confirmed', 'released', 'expired')),
  expires_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_inventory_reservations_expiry_after_created
    CHECK (expires_at IS NULL OR expires_at > created_at),
  CONSTRAINT fk_inventory_reservations_variant_belongs_to_product
    FOREIGN KEY (product_id, variant_id)
    REFERENCES product_variants(product_id, id)
    DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_order_id
  ON inventory_reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_status_expires_at
  ON inventory_reservations(status, expires_at);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id             bigserial   PRIMARY KEY,
  product_id     bigint      NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id     bigint      REFERENCES product_variants(id) ON DELETE RESTRICT,
  movement_type  varchar(30) NOT NULL
                   CHECK (movement_type IN ('in', 'out', 'reserve', 'release', 'adjustment')),
  quantity       int         NOT NULL CHECK (quantity > 0),
  reference_type varchar(30),
  reference_id   varchar(100),
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_inventory_movements_variant_belongs_to_product
    FOREIGN KEY (product_id, variant_id)
    REFERENCES product_variants(product_id, id)
    DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_variant_created
  ON inventory_movements(product_id, variant_id, created_at DESC);

-- =============================================================
-- 4. CART DOMAIN  (Owner: Order Service / Cart submodule)
-- =============================================================
-- Hybrid model: guest cart → local device (Expo SQLite)
--               authenticated cart → server DB
--               On login: merge device cart vào server cart
CREATE TABLE IF NOT EXISTS carts (
  id              bigserial   PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          varchar(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'checked_out', 'abandoned')),
  last_merged_at  timestamptz,
  checked_out_at  timestamptz,
  abandoned_at    timestamptz,
  expires_at      timestamptz,
  version         bigint      NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_carts_expiry_after_created
    CHECK (expires_at IS NULL OR expires_at > created_at)
);

-- Mỗi user chỉ có 1 cart active
CREATE UNIQUE INDEX IF NOT EXISTS uq_carts_active_user
  ON carts(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_carts_user_status ON carts(user_id, status);

CREATE TABLE IF NOT EXISTS cart_items (
  id          bigserial   PRIMARY KEY,
  cart_id     bigint      NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id  bigint      NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id  bigint      REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity    int         NOT NULL DEFAULT 1 CHECK (quantity > 0),
  is_selected boolean     NOT NULL DEFAULT true,
  added_at    timestamptz NOT NULL DEFAULT now(),
  version     bigint      NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_cart_items_variant_belongs_to_product
    FOREIGN KEY (product_id, variant_id)
    REFERENCES product_variants(product_id, id)
    DEFERRABLE INITIALLY IMMEDIATE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_items_unique_line
  ON cart_items(cart_id, product_id, COALESCE(variant_id, -1));
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);

-- =============================================================
-- 5. PROMOTION DOMAIN  (Owner: Promotion Service / Catalog)
-- =============================================================
CREATE TABLE IF NOT EXISTS coupons (
  id              bigserial      PRIMARY KEY,
  code            varchar(60)    NOT NULL UNIQUE,
  description     text,
  discount_type   varchar(20)    NOT NULL
                    CHECK (discount_type IN ('percent', 'fixed')),
  discount_value  numeric(12,2)  NOT NULL CHECK (discount_value >= 0),
  min_order_value numeric(12,2)  NOT NULL DEFAULT 0 CHECK (min_order_value >= 0),
  max_discount    numeric(12,2),
  start_at        timestamptz,
  end_at          timestamptz,
  usage_limit     int,
  used_count      int            NOT NULL DEFAULT 0,
  active          boolean        NOT NULL DEFAULT true,
  version         bigint         NOT NULL DEFAULT 0,
  created_at      timestamptz    NOT NULL DEFAULT now(),
  updated_at      timestamptz    NOT NULL DEFAULT now(),
  CONSTRAINT ck_coupons_percent_value
    CHECK (discount_type <> 'percent' OR discount_value <= 100),
  CONSTRAINT ck_coupons_time_range
    CHECK (start_at IS NULL OR end_at IS NULL OR end_at > start_at),
  CONSTRAINT ck_coupons_usage_limit
    CHECK (usage_limit IS NULL OR usage_limit >= 0),
  CONSTRAINT ck_coupons_used_count_non_negative
    CHECK (used_count >= 0),
  CONSTRAINT ck_coupons_used_count_lte_limit
    CHECK (usage_limit IS NULL OR used_count <= usage_limit)
);

CREATE TABLE IF NOT EXISTS coupon_usages (
  id         bigserial   PRIMARY KEY,
  coupon_id  bigint      NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id   bigint,
  used_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_coupon_usages_coupon_order
  ON coupon_usages(coupon_id, order_id) WHERE order_id IS NOT NULL;

-- =============================================================
-- 6. ORDER DOMAIN  (Owner: Order Service)
-- =============================================================
CREATE TABLE IF NOT EXISTS shipping_methods (
  id                   bigserial     PRIMARY KEY,
  name                 varchar(120)  NOT NULL,
  description          text,
  estimated_min_days   int           CHECK (estimated_min_days IS NULL OR estimated_min_days >= 0),
  estimated_max_days   int           CHECK (estimated_max_days IS NULL OR estimated_max_days >= 0),
  fee                  numeric(12,2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  active               boolean       NOT NULL DEFAULT true,
  version              bigint        NOT NULL DEFAULT 0,
  created_at           timestamptz   NOT NULL DEFAULT now(),
  updated_at           timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT ck_shipping_methods_day_range
    CHECK (
      estimated_min_days IS NULL
      OR estimated_max_days IS NULL
      OR estimated_max_days >= estimated_min_days
    )
);

-- Đã merge V003 constraints trực tiếp vào CREATE TABLE
CREATE TABLE IF NOT EXISTS orders (
  id                   bigserial     PRIMARY KEY,
  order_no             varchar(40)   NOT NULL UNIQUE,
  cart_id              bigint        REFERENCES carts(id) ON DELETE SET NULL,
  user_id              uuid          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  coupon_id            bigint        REFERENCES coupons(id) ON DELETE SET NULL,
  coupon_code          varchar(60),
  shipping_method_id   bigint        REFERENCES shipping_methods(id) ON DELETE SET NULL,
  shipping_method_name varchar(120),

  -- V003: extended enum (thêm pending_payment, paid, payment_expired)
  order_status         varchar(30)   NOT NULL DEFAULT 'pending'
                         CHECK (order_status IN (
                           'pending', 'pending_payment', 'paid', 'payment_expired',
                           'confirmed', 'processing', 'shipping', 'delivered',
                           'cancelled', 'returned'
                         )),

  -- V003: extended enum (thêm amount_mismatch, partially_refunded)
  payment_status       varchar(30)   NOT NULL DEFAULT 'unpaid'
                         CHECK (payment_status IN (
                           'unpaid', 'pending', 'paid', 'failed', 'cancelled',
                           'expired', 'amount_mismatch', 'refunded', 'partially_refunded'
                         )),

  fulfillment_status   varchar(30)   NOT NULL DEFAULT 'pending'
                         CHECK (fulfillment_status IN (
                           'pending', 'packed', 'shipping', 'delivered', 'returned', 'cancelled'
                         )),

  receiver_name        varchar(150)  NOT NULL,
  receiver_phone       varchar(30)   NOT NULL,
  shipping_address_line text         NOT NULL,
  shipping_ward        varchar(120),
  shipping_district    varchar(120),
  shipping_city        varchar(120)  NOT NULL,
  shipping_province    varchar(120),
  shipping_postal_code varchar(20),
  shipping_country     varchar(120)  NOT NULL DEFAULT 'Vietnam',

  note                 text,

  -- V003: extended enum (thêm SEPAY_QR, SEPAY_CHECKOUT, SEPAY_CARD, APPLE_PAY, GOOGLE_PAY)
  payment_method_code  varchar(30)   NOT NULL
                         CHECK (payment_method_code IN (
                           'COD', 'CARD', 'BANK_TRANSFER', 'VNPAY', 'MOMO', 'PAYPAL',
                           'SEPAY_QR', 'SEPAY_CHECKOUT', 'SEPAY_CARD',
                           'APPLE_PAY', 'GOOGLE_PAY'
                         )),

  subtotal             numeric(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  shipping_fee         numeric(12,2) NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0),
  tax_amount           numeric(12,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  discount_amount      numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  grand_total          numeric(12,2) NOT NULL DEFAULT 0 CHECK (grand_total >= 0),

  placed_at            timestamptz   NOT NULL DEFAULT now(),
  paid_at              timestamptz,
  cancelled_at         timestamptz,
  delivered_at         timestamptz,
  version              bigint        NOT NULL DEFAULT 0,
  created_at           timestamptz   NOT NULL DEFAULT now(),
  updated_at           timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT ck_orders_total_formula
    CHECK (grand_total = subtotal + shipping_fee + tax_amount - discount_amount)
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id           ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_status      ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status    ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON orders(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at        ON orders(created_at DESC);

-- Snapshot thông tin sản phẩm tại thời điểm đặt hàng
CREATE TABLE IF NOT EXISTS order_items (
  id            bigserial      PRIMARY KEY,
  order_id      bigint         NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    bigint         NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id    bigint         REFERENCES product_variants(id) ON DELETE RESTRICT,
  product_name  varchar(255)   NOT NULL,
  variant_name  varchar(255),
  sku           varchar(80),
  thumbnail_url text,
  unit_price    numeric(12,2)  NOT NULL CHECK (unit_price >= 0),
  quantity      int            NOT NULL CHECK (quantity > 0),
  line_total    numeric(12,2)  NOT NULL CHECK (line_total >= 0),
  created_at    timestamptz    NOT NULL DEFAULT now(),
  CONSTRAINT ck_order_items_total_formula
    CHECK (line_total = unit_price * quantity),
  CONSTRAINT fk_order_items_variant_belongs_to_product
    FOREIGN KEY (product_id, variant_id)
    REFERENCES product_variants(product_id, id)
    DEFERRABLE INITIALLY IMMEDIATE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_order_items_id_product_id
  ON order_items(id, product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

CREATE TABLE IF NOT EXISTS order_status_histories (
  id          bigserial   PRIMARY KEY,
  order_id    bigint      NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status_type varchar(20) NOT NULL
                CHECK (status_type IN ('order', 'payment', 'fulfillment')),
  old_status  varchar(30),
  new_status  varchar(30) NOT NULL,
  changed_by  uuid        REFERENCES users(id) ON DELETE SET NULL,
  note        text,
  changed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_status_histories_order_id_changed_at
  ON order_status_histories(order_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS shipments (
  id                 bigserial   PRIMARY KEY,
  order_id           bigint      NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  shipping_method_id bigint      REFERENCES shipping_methods(id) ON DELETE SET NULL,
  shipment_no        varchar(40) NOT NULL UNIQUE,
  carrier            varchar(100),
  tracking_number    varchar(120),
  shipment_status    varchar(30) NOT NULL DEFAULT 'pending'
                       CHECK (shipment_status IN (
                         'pending', 'ready_to_ship', 'shipped', 'in_transit',
                         'delivered', 'failed', 'returned', 'cancelled'
                       )),
  note               text,
  shipped_at         timestamptz,
  delivered_at       timestamptz,
  returned_at        timestamptz,
  version            bigint      NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_shipments_tracking_number
  ON shipments(tracking_number) WHERE tracking_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON shipments(order_id);

-- =============================================================
-- 7. PAYMENT DOMAIN  (Owner: Payment Service)
-- =============================================================
-- Đã merge đầy đủ V003 + V004 (qr_image_base64) + V005 (bank_code, bank_bin)
CREATE TABLE IF NOT EXISTS payments (
  id                      bigserial      PRIMARY KEY,
  order_id                bigint         NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  attempt_no              int            NOT NULL DEFAULT 1 CHECK (attempt_no > 0),

  -- V003: thêm SEPAY
  provider                varchar(50)    NOT NULL
                            CHECK (provider IN (
                              'COD', 'CARD', 'BANK_TRANSFER',
                              'VNPAY', 'MOMO', 'PAYPAL', 'SEPAY'
                            )),

  -- V003: thêm SEPAY_QR, SEPAY_CHECKOUT, SEPAY_CARD, APPLE_PAY, GOOGLE_PAY
  method                  varchar(30)    NOT NULL
                            CHECK (method IN (
                              'COD', 'CARD', 'BANK_TRANSFER',
                              'VNPAY', 'MOMO', 'PAYPAL',
                              'SEPAY_QR', 'SEPAY_CHECKOUT', 'SEPAY_CARD',
                              'APPLE_PAY', 'GOOGLE_PAY'
                            )),

  -- V003: thêm amount_mismatch, partially_refunded
  status                  varchar(30)    NOT NULL DEFAULT 'pending'
                            CHECK (status IN (
                              'pending', 'authorized', 'paid', 'failed',
                              'cancelled', 'expired', 'amount_mismatch',
                              'refunded', 'partially_refunded'
                            )),

  amount                  numeric(12,2)  NOT NULL CHECK (amount >= 0),
  currency                varchar(10)    NOT NULL DEFAULT 'VND',

  -- Cột gốc
  provider_transaction_id varchar(120),
  gateway_response_code   varchar(60),
  gateway_message         text,

  -- V003: SePay integration fields
  provider_order_id       varchar(120),
  invoice_number          varchar(80),
  checkout_url            text,
  qr_code_url             text,
  qr_content              text,
  bank_deep_link          text,
  bank_name               varchar(120),
  bank_account_number     varchar(60),
  account_name            varchar(150),
  transfer_content        varchar(120),
  customer_email          varchar(255),
  expired_at              timestamptz,
  raw_request             jsonb,
  raw_response            jsonb,

  -- V004: QR image base64
  qr_image_base64         text,

  -- V005: VietQR metadata
  bank_code               varchar(40),
  bank_bin                varchar(20),

  paid_at                 timestamptz,
  failed_at               timestamptz,
  version                 bigint         NOT NULL DEFAULT 0,
  created_at              timestamptz    NOT NULL DEFAULT now(),
  updated_at              timestamptz    NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_order_attempt
  ON payments(order_id, attempt_no);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_provider_transaction
  ON payments(provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_invoice_number
  ON payments(invoice_number)
  WHERE invoice_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_order_id_created_at
  ON payments(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status
  ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_status_expired_at
  ON payments(status, expired_at)
  WHERE expired_at IS NOT NULL;

-- V003: thêm provider_transaction_id, transaction_status, currency, received_at
CREATE TABLE IF NOT EXISTS payment_transactions (
  id                      bigserial     PRIMARY KEY,
  payment_id              bigint        NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  provider_transaction_id varchar(120),
  transaction_type        varchar(30)   NOT NULL
                            CHECK (transaction_type IN (
                              'authorize', 'capture', 'refund', 'void', 'webhook_update'
                            )),
  transaction_status      varchar(60)   NOT NULL,   -- free-form từ gateway
  status                  varchar(30)   NOT NULL,
  amount                  numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency                varchar(10)   NOT NULL DEFAULT 'VND',
  external_ref            varchar(120),
  received_at             timestamptz   NOT NULL DEFAULT now(),
  raw_payload             jsonb,
  created_at              timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_id_created_at
  ON payment_transactions(payment_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_transactions_provider_transaction
  ON payment_transactions(provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_transactions_received_at
  ON payment_transactions(received_at DESC);

-- =============================================================
-- 8. REVIEW DOMAIN  (Owner: Review Service / Catalog)
-- =============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id                   bigserial   PRIMARY KEY,
  user_id              uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id           bigint      NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  order_item_id        bigint,
  rating               int         NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment              text,
  image_urls           text[],
  is_verified_purchase boolean     NOT NULL DEFAULT false,
  status               varchar(20) NOT NULL DEFAULT 'visible'
                         CHECK (status IN ('visible', 'hidden', 'pending')),
  version              bigint      NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_reviews_order_item_matches_product
    FOREIGN KEY (order_item_id, product_id)
    REFERENCES order_items(id, product_id)
    DEFERRABLE INITIALLY IMMEDIATE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_reviews_user_order_item
  ON reviews(user_id, order_item_id) WHERE order_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_product_status_created
  ON reviews(product_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS favourites (
  id         bigserial   PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id bigint      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- =============================================================
-- 9. OPERATIONAL / INTEGRATION SUPPORT
-- =============================================================
CREATE TABLE IF NOT EXISTS outbox_events (
  id             bigserial    PRIMARY KEY,
  aggregate_type varchar(60)  NOT NULL,
  aggregate_id   varchar(120) NOT NULL,
  event_type     varchar(120) NOT NULL,
  payload        jsonb        NOT NULL,
  status         varchar(30)  NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'published', 'failed')),
  retry_count    int          NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  next_retry_at  timestamptz,
  last_error     text,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  published_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_outbox_events_status_created_at
  ON outbox_events(status, created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_events_next_retry_at
  ON outbox_events(next_retry_at) WHERE status = 'failed';

-- =============================================================
-- 10. FK ADDITIONS THAT REQUIRE LATER TABLES
-- =============================================================
ALTER TABLE inventory_reservations
  DROP CONSTRAINT IF EXISTS fk_inventory_reservations_order,
  ADD CONSTRAINT fk_inventory_reservations_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE coupon_usages
  DROP CONSTRAINT IF EXISTS fk_coupon_usages_order,
  ADD CONSTRAINT fk_coupon_usages_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

-- =============================================================
-- 11. UPDATE TIMESTAMP TRIGGERS
-- =============================================================
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_addresses_updated_at ON addresses;
CREATE TRIGGER trg_addresses_updated_at
  BEFORE UPDATE ON addresses FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_customer_payment_methods_updated_at ON customer_payment_methods;
CREATE TRIGGER trg_customer_payment_methods_updated_at
  BEFORE UPDATE ON customer_payment_methods FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_brands_updated_at ON brands;
CREATE TRIGGER trg_brands_updated_at
  BEFORE UPDATE ON brands FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories;
CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_product_variants_updated_at ON product_variants;
CREATE TRIGGER trg_product_variants_updated_at
  BEFORE UPDATE ON product_variants FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_inventory_items_updated_at ON inventory_items;
CREATE TRIGGER trg_inventory_items_updated_at
  BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_carts_updated_at ON carts;
CREATE TRIGGER trg_carts_updated_at
  BEFORE UPDATE ON carts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_cart_items_updated_at ON cart_items;
CREATE TRIGGER trg_cart_items_updated_at
  BEFORE UPDATE ON cart_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_coupons_updated_at ON coupons;
CREATE TRIGGER trg_coupons_updated_at
  BEFORE UPDATE ON coupons FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_shipping_methods_updated_at ON shipping_methods;
CREATE TRIGGER trg_shipping_methods_updated_at
  BEFORE UPDATE ON shipping_methods FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_shipments_updated_at ON shipments;
CREATE TRIGGER trg_shipments_updated_at
  BEFORE UPDATE ON shipments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments;
CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_reviews_updated_at ON reviews;
CREATE TRIGGER trg_reviews_updated_at
  BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- 12. DATA MIGRATION  (từ V002 — chạy sau khi import dữ liệu cũ)
-- =============================================================
-- Chỉ cần chạy nếu DB có dữ liệu cũ không có ward/district/country.
-- Với greenfield install (seed từ đầu) thì bỏ qua block này.
-- 
-- BEGIN;
--
-- -- Đặt country mặc định cho địa chỉ thiếu
-- UPDATE public.addresses
-- SET country = 'Vietnam'
-- WHERE country IS NULL OR country = '';
--
-- -- Tách district/ward ra khỏi city nếu city có dạng "District, Ward"
-- UPDATE public.addresses
-- SET
--   district = CASE
--     WHEN city LIKE '%,%' THEN TRIM(SPLIT_PART(city, ',', 1))
--     ELSE district END,
--   ward = CASE
--     WHEN city LIKE '%,%' THEN TRIM(SPLIT_PART(city, ',', 2))
--     ELSE ward END,
--   city = CASE
--     WHEN city LIKE '%,%' AND province IS NOT NULL THEN province
--     WHEN city LIKE '%,%' THEN 'Vietnam'
--     ELSE city END
-- WHERE city IS NOT NULL AND city LIKE '%,%';
--
-- COMMIT;

-- =============================================================
-- 13. IMPLEMENTATION NOTES (Spring Boot)
-- =============================================================
-- 1) Dùng @Version cho optimistic locking trên các bảng có cột version:
--    users, addresses, customer_payment_methods, brands, categories,
--    products, product_variants, inventory_items, carts, cart_items,
--    coupons, shipping_methods, orders, shipments, payments, reviews
--
-- 2) Luồng đặt hàng orchestrate trong Spring:
--    validate cart → price recheck → reserve inventory → create order
--    → create payment attempt → handle callback/webhook → confirm order
--
-- 3) Inventory CHỈ được thay đổi qua Inventory Service.
--
-- 4) Soft-delete sản phẩm (deleted_at) sau khi đã có trong orders.
--
-- 5) Guest cart giữ local trên mobile (Expo SQLite).
--    Sau login, gọi merge endpoint để sync vào server cart.
--
-- 6) Business rules/workflow trong Java, không dùng trigger phức tạp.
--
-- 7) Payment provider hierarchy:
--    provider: COD | CARD | BANK_TRANSFER | VNPAY | MOMO | PAYPAL | SEPAY
--    method:   COD | CARD | BANK_TRANSFER | VNPAY | MOMO | PAYPAL
--              | SEPAY_QR | SEPAY_CHECKOUT | SEPAY_CARD
--              | APPLE_PAY | GOOGLE_PAY
-- =============================================================
