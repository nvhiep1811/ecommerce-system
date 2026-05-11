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
