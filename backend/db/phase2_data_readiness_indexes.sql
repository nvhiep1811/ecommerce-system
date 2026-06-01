-- Apply on an existing PostgreSQL/RDS database before expecting phase2 query plans.
-- These indexes match current repository queries for hot catalog/search, favourites,
-- reviews, order lists, seller order joins, and outbox relay.

CREATE INDEX IF NOT EXISTS idx_products_category_created_published
  ON products(category_id, created_at DESC)
  WHERE active = true AND published = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_category_rating_published
  ON products(category_id, rating_avg DESC, created_at DESC)
  WHERE active = true AND published = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_price_published
  ON products(base_price, created_at DESC)
  WHERE active = true AND published = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_seller_created_not_deleted
  ON products(seller_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_categories_parent_active_name
  ON categories(parent_id, name)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_favourites_user_created
  ON favourites(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_user_created
  ON reviews(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_user_created_at
  ON orders(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_user_status_created_at
  ON orders(user_id, order_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id_id
  ON order_items(order_id, id);

CREATE INDEX IF NOT EXISTS idx_order_items_product_order
  ON order_items(product_id, order_id);

CREATE INDEX IF NOT EXISTS idx_outbox_events_aggregate_status_created
  ON outbox_events(aggregate_type, status, created_at);
