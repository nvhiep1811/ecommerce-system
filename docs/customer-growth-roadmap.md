# Customer Domain Roadmap

This roadmap keeps the current service-based architecture as the core style and adds supporting patterns only where they reduce operational risk.

## Priority

P0:
- Favourites: authenticated customers can add, remove, and view saved products.
- Verified reviews: customers can review each delivered order item once, then update that review instead of creating duplicates.
- Cart stock visibility: cart refreshes product availability before checkout, shows low-stock/out-of-stock states, and prevents checkout for unavailable items.

P1:
- Product search optimization with PostgreSQL `pg_trgm` indexes before introducing Elasticsearch/OpenSearch.
- Cache hot catalogue reads and featured/search pages with short TTLs during flash sale windows.
- Add a dedicated search read model if catalogue queries begin competing with checkout/order writes.

P2:
- Move search to OpenSearch/Elasticsearch only after traffic or relevance needs justify the operational cost.
- Add event-driven projections for product availability, review aggregates, and seller dashboards.
- Use queue-backed asynchronous jobs for heavy fan-out workflows.

## Search Strategy

For the current stage, PostgreSQL remains the source of truth. The schema enables `pg_trgm` and adds a GIN index on `lower(products.name)` for cheaper fuzzy product search.
Phase 2 adds targeted B-tree/partial indexes for the repository queries that are hottest in the current app: category/search product pages, price sorting, seller product lists, favourites, reviews, customer order lists, seller order joins, and outbox relay scans. Existing Supabase databases should apply `backend/db/phase2_data_readiness_indexes.sql`.

Recommended evolution:

1. Keep mobile search debounced and paginated.
2. Cache repeated search/category/featured queries at the API gateway or service level.
3. Add Postgres full-text ranking or trigram similarity when search relevance becomes a product requirement.
4. Introduce OpenSearch only when Postgres search/index maintenance becomes a bottleneck.

This keeps cost and operational complexity low while still giving a clear path to investor-scale traffic.

## Architecture Additions

Layered architecture remains the default inside each service.

Recommended supporting styles:

- Event-driven: publish durable domain events for order paid, inventory changed, review changed, and product updated.
- CQRS/read model: build denormalized read tables for product cards, search, and seller dashboards.
- Pipeline: use CI/CD gates for backend test, mobile lint/typecheck, packaging, and later deployment promotion.
- Microkernel: keep payment providers, bank deeplink builders, notification channels, and future search providers behind small adapters.

Avoid applying space-based architecture now. It is useful for extreme horizontal scaling, but it would add infrastructure and consistency complexity before the product has proven that need.

## Inventory Policy

Cart should not silently delete unavailable products. It should:

- refresh stock when opened,
- show remaining stock,
- warn when stock is low,
- prevent selecting out-of-stock items for checkout,
- let the user remove unavailable items deliberately.

Server-side checkout remains the final authority. The cart UI is an early warning layer, not the source of truth.

Concurrency hardening:

- Checkout reserve uses a single conditional inventory update, `available_qty >= requested_qty`, so only one concurrent order can reserve the final unit.
- If another order takes the stock first, the losing checkout receives a conflict response and the surrounding order transaction rolls back.
- Multi-item reservations are aggregated by product/variant and processed in stable order to reduce deadlock risk.
- Reserved stock is released when pending online payments expire or an order is cancelled before shipment.

## Catalogue Read Cache

The catalog service keeps a short Redis-backed cache for public product page IDs and pagination metadata. Stock is still loaded fresh for each response, so the cache reduces expensive search/count queries without making checkout trust cached inventory. `CATALOG_READ_CACHE_STORE=auto` uses Redis when available and falls back to local memory for developer machines.

Config:

- `CATALOG_READ_CACHE_ENABLED=true`
- `CATALOG_READ_CACHE_STORE=auto` (`auto`, `redis`, or `local`)
- `CATALOG_READ_CACHE_TTL_SECONDS=15`
- `CATALOG_READ_CACHE_MAX_ENTRIES=500`

## Checkout Idempotency

The mobile checkout screen now sends a stable `clientRequestId` for each checkout attempt. Commerce service stores it on `orders.client_request_id` with a unique partial index on `(user_id, client_request_id)`, so retrying a request after a timeout returns the existing order instead of reserving stock and creating payment twice.

For an existing Supabase database, apply `backend/db/phase1_order_idempotency.sql` before running commerce-service with `ddl-auto=validate`.

## Data Readiness Phase 2

Read-heavy service methods are now marked with `@Transactional(readOnly = true)` in catalog and commerce query paths. This gives Hibernate/JDBC clearer intent today and keeps the code ready for a future read-replica/PgBouncer split without changing controller contracts.

Apply `backend/db/phase2_data_readiness_indexes.sql` to existing Supabase/Postgres databases. For very large production tables, run equivalent `CREATE INDEX CONCURRENTLY` statements during a maintenance window because normal index creation can hold stronger locks.
